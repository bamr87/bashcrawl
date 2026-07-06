"""A persistent interactive-bash REPL that plays the sandboxed game.

The retired harness played by puppeting a Textual TUI. This plays the *real*
dungeon: it keeps one ``bash -i`` process alive per session so ``cd`` and the
game's environment variables (``$I`` inventory, ``$HP`` health) persist across
commands exactly as they do for a human at a terminal.

Robustness rests on three choices, none needing third-party deps:

* **A PTY, not a pipe.** Interactive bash only behaves predictably (prompt after
  every command, working ``read``) when its stdio is a terminal. We allocate a
  pseudo-terminal with ``echo`` disabled so the captured stream is the game's
  output verbatim — no echoed keystrokes to strip.
* **Sentinel prompt.** ``PS1`` is a delimited marker embedding the live ``$PWD``
  / ``$I`` / ``$HP``. Bash re-emits it after every command from its own prompt
  loop, so we never inject a completion marker into stdin (which an encounter's
  ``read`` would otherwise swallow).
* **Idle-timeout pump.** We read until the next sentinel *or* until output goes
  quiet. A quiet stream with no sentinel means a script is blocked on ``read``
  (an interactive ``y/n`` prompt) — the agent's next command is simply fed to it.
"""

from __future__ import annotations

import os
import pty
import re
import select
import signal
import subprocess
import termios
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from .sandbox import game_env

# The status prompt is delimited by US (unit separator, 0x1f) — a control byte
# that never appears in the game's plain-text scrolls. Crucially it is NOT one of
# readline's prompt markers (SOH/STX, 0x01/0x02), which bash *strips* from PS1.
#
# Forgery defense: PS1's *stored* value splices ``${_BC_Z}`` (an empty variable)
# into both marker words, so commands that print the raw value — ``env``,
# ``set``, ``echo $PS1`` — emit ``BC${_BC_Z}STATUS…`` which never matches the
# regex. Only bash's prompt display (which expands PS1) produces the real
# ``BCSTATUS…BCREADY`` sentinel.
_SEP = "\x1f"
_PS1 = f"BC${{_BC_Z}}STATUS{_SEP}${{PWD}}{_SEP}${{I}}{_SEP}${{HP}}{_SEP}BC${{_BC_Z}}READY\n"
_SENTINEL_RE = re.compile(
    rf"BCSTATUS{_SEP}(.*?){_SEP}(.*?){_SEP}(.*?){_SEP}BCREADY\r?\n?",
    re.DOTALL,
)


class BashGameSession:
    """Drive one sandboxed game through a long-lived ``bash -i`` subprocess."""

    def __init__(
        self,
        game_dir: Path,
        *,
        start_dir: str = "entrance",
        overall_timeout: float = 12.0,
        idle_timeout: float = 0.25,
        pending_grace: float = 2.0,
    ) -> None:
        self.game_dir = Path(game_dir).resolve()
        self.start_dir = start_dir
        self.overall_timeout = overall_timeout
        self.idle_timeout = idle_timeout
        # How long the stream must stay quiet (with no closing sentinel) before
        # we conclude a script is blocked on `read` rather than merely slow.
        self.pending_grace = pending_grace
        self._proc: Optional[subprocess.Popen] = None
        self._fd: int = -1
        self._pwd: str = ""
        self._inv: str = ""
        self._hp: str = ""
        self._pending = False  # a prior command is blocked on `read`
        self._last_items: List[str] = []

    # -- lifecycle ---------------------------------------------------------
    def start(self) -> None:
        entrance = self.game_dir / self.start_dir
        env = game_env(self.game_dir)
        env.update(
            PS1=_PS1,
            PS2="",
            PROMPT_COMMAND="",
            _BC_Z="",  # expands to nothing in the prompt; keeps PS1's raw value unmatchable
            TERM="dumb",
            HISTFILE="/dev/null",
            BASH_SILENCE_DEPRECATION_WARNING="1",
        )
        master, slave = pty.openpty()
        _disable_echo(slave)
        self._proc = subprocess.Popen(
            ["bash", "--norc", "--noprofile", "-i"],
            cwd=str(entrance),
            env=env,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            start_new_session=True,
            close_fds=True,
        )
        os.close(slave)
        self._fd = master
        # Drain bash's startup noise and the first prompt so the initial
        # pwd/$I/$HP are populated.
        self._pump()
        self._last_items = self._list_room()

    def close(self) -> None:
        if self._proc is None:
            return
        try:
            if self._proc.poll() is None:
                os.write(self._fd, b"exit\n")
        except OSError:
            pass
        try:
            self._proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(self._proc.pid), signal.SIGKILL)
            except (OSError, ProcessLookupError):
                pass
        try:
            os.close(self._fd)
        except OSError:
            pass
        self._proc = None

    @property
    def alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    # -- command I/O -------------------------------------------------------
    def run(self, line: str) -> List[Dict[str, str]]:
        """Send one line, return its output as ``[{kind, text}]`` records."""
        if not self.alive:
            return [{"kind": "error", "text": "the game session has ended"}]
        # One command -> one closing sentinel: collapse embedded newlines so a
        # multi-line MCP payload cannot produce several prompts in one turn.
        collapsed = "; ".join(part for part in line.splitlines() if part.strip()) or ""
        self._drain()
        try:
            os.write(self._fd, (collapsed + "\n").encode("utf-8", "replace"))
        except OSError:
            return [{"kind": "error", "text": "could not send command to the game"}]
        return _as_records(self._pump())

    def _drain(self) -> None:
        """Discard stale PTY output left by a previously timed-out command.

        A command that outlived ``overall_timeout`` (or resumed after we
        declared it pending) may have deposited output + a real sentinel after
        our last read. Absorb it now — updating pwd/$I/$HP from any sentinel —
        so the next command's reply is never shifted one turn behind.
        """
        while True:
            try:
                ready, _, _ = select.select([self._fd], [], [], 0)
            except (OSError, ValueError):
                return
            if not ready:
                return
            try:
                data = os.read(self._fd, 65536)
            except OSError:
                return
            if not data:
                return
            text = data.decode("utf-8", "replace")
            matches = list(_SENTINEL_RE.finditer(text))
            if matches:
                last = matches[-1]
                self._pwd, self._inv, self._hp = last.group(1), last.group(2), last.group(3)
                self._pending = False

    def _pump(self) -> str:
        """Read until the shell's closing sentinel arrives at the END of output.

        A sentinel is only trusted when it is the tail of the stream — anything
        after it means more output is in flight. If the stream stays quiet for
        ``pending_grace`` with no closing sentinel, the running script is
        blocked on ``read`` (an interactive prompt): report awaiting-input.
        Updates cached pwd/$I/$HP; returns gameplay text (sentinels stripped).
        """
        buf = bytearray()
        deadline = time.monotonic() + self.overall_timeout
        quiet_since: float | None = None

        def tail_match(raw: str):
            m = None
            for m_i in _SENTINEL_RE.finditer(raw):
                m = m_i
            if m is not None and not raw[m.end():].strip():
                return m
            return None

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                ready, _, _ = select.select([self._fd], [], [], min(self.idle_timeout, remaining))
            except (OSError, ValueError):
                break
            if not ready:
                # Quiet. A slow command (sleep, big find) may resume — only give
                # up on the sentinel after pending_grace of sustained silence.
                now = time.monotonic()
                if quiet_since is None:
                    quiet_since = now
                elif now - quiet_since >= self.pending_grace:
                    break
                continue
            quiet_since = None
            try:
                data = os.read(self._fd, 65536)
            except OSError:  # PTY raises EIO when the child exits
                break
            if not data:
                break
            buf += data
            if tail_match(buf.decode("utf-8", "replace")):
                break

        raw = buf.decode("utf-8", "replace")
        closing = tail_match(raw)
        if closing is not None:
            self._pwd, self._inv, self._hp = closing.group(1), closing.group(2), closing.group(3)
            self._pending = False
        else:
            self._pending = True  # an encounter (or slow script) is waiting on us
        return _SENTINEL_RE.sub("", raw).replace("\r\n", "\n").replace("\r", "")

    def _run_internal(self, line: str) -> str:
        """Run a probe command whose output is not shown to the agent."""
        if not self.alive or self._pending:
            return ""
        self._drain()
        try:
            os.write(self._fd, (line + "\n").encode("utf-8"))
        except OSError:
            return ""
        return self._pump()

    def _list_room(self) -> List[str]:
        out = self._run_internal("ls -1a 2>/dev/null")
        return [ln for ln in (l.strip() for l in out.splitlines()) if ln and ln not in (".", "..")]

    # -- observation -------------------------------------------------------
    def rel_cwd(self) -> str:
        """Current directory relative to the game root (e.g. ``entrance/cellar``)."""
        try:
            return str(Path(self._pwd).resolve().relative_to(self.game_dir))
        except (ValueError, OSError):
            return self._pwd or self.start_dir

    def snapshot(self, *, refresh_items: bool = True) -> Dict[str, Any]:
        if refresh_items and not self._pending:
            self._last_items = self._list_room()
        hp: Any = None
        if self._hp.strip().lstrip("-").isdigit():
            hp = int(self._hp.strip())
        return {
            "cwd": self.rel_cwd(),
            "inventory": self._inv,
            "hp": hp,
            "room_items": list(self._last_items),
            "awaiting_input": self._pending,
        }


def _disable_echo(fd: int) -> None:
    """Turn off terminal echo so captured output excludes typed input."""
    try:
        attrs = termios.tcgetattr(fd)
        attrs[3] = attrs[3] & ~termios.ECHO & ~termios.ECHONL  # lflags
        termios.tcsetattr(fd, termios.TCSANOW, attrs)
    except (termios.error, OSError):
        pass


def _as_records(text: str) -> List[Dict[str, str]]:
    text = text.strip("\n")
    if not text:
        return []
    lowered = text.lower()
    kind = "output"
    if any(
        marker in lowered
        for marker in (
            "command not found",
            "no such file or directory",
            "permission denied",
            "not a directory",
        )
    ):
        kind = "error"
    return [{"kind": kind, "text": text}]
