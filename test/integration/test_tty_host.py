"""End-to-end smoke for the TermForge TTY host on a real pseudo-terminal.

``make tty-demo`` is the one player surface nothing else exercised: the
node unit tests cover the compositor and the gem overlay as pure functions,
but not the raw-mode input loop, the alternate-screen frame, or the hand-off
between the HUD and the hidden pixel shooter. This drives ``host-tty.js``
through ``pty.fork`` with a fixed window size, plays a few commands, opens the
gem with ``xyzzy``, starts a wave, leaves with ``q``, and exits with ``^D``.

Skipped when ``node`` is not on PATH (the CI ``test`` job installs it).
"""

from __future__ import annotations

import fcntl
import os
import pty
import re
import select
import shutil
import signal
import struct
import termios
import time
from pathlib import Path

import pytest

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(shutil.which("node") is None, reason="node not installed"),
]

ROOT = Path(os.environ.get("BASHCRAWL_ROOT", Path(__file__).resolve().parents[2])).resolve()
HOST = ROOT / "termforge" / "node" / "host-tty.js"
ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Za-z0-9]|\x1b[=><78cDEM]")
COLS, ROWS = 100, 30


def _strip(raw: bytes) -> str:
    return ANSI_RE.sub("", raw.decode("utf8", "replace"))


class TtyHost:
    """A host-tty.js process on a PTY with a byte recorder."""

    def __init__(self, env: dict[str, str] | None = None) -> None:
        self.raw = bytearray()
        pid, fd = pty.fork()
        if pid == 0:  # child
            os.environ["TERM"] = "xterm-256color"
            os.environ.update(env or {})
            os.chdir(ROOT)
            os.execvp("node", ["node", str(HOST), "--app", "bashcrawl"])
        self.pid, self.fd = pid, fd
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", ROWS, COLS, 0, 0))

    def send(self, text: str) -> None:
        os.write(self.fd, text.encode("utf8"))

    def expect(self, needle: str, timeout: float = 15.0) -> str:
        """Pump output until ``needle`` appears in the ANSI-stripped stream."""
        start_at = len(self.raw)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if needle in _strip(bytes(self.raw[start_at:])):
                return _strip(bytes(self.raw[start_at:]))
            ready, _, _ = select.select([self.fd], [], [], 0.1)
            if ready:
                try:
                    data = os.read(self.fd, 65536)
                except OSError:
                    break
                if not data:
                    break
                self.raw.extend(data)
        tail = _strip(bytes(self.raw[-2000:]))
        raise AssertionError(f"timed out waiting for {needle!r}; tail:\n{tail}")

    def drain(self, seconds: float) -> None:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            ready, _, _ = select.select([self.fd], [], [], 0.05)
            if not ready:
                continue
            try:
                data = os.read(self.fd, 65536)
            except OSError:
                return
            if not data:
                return
            self.raw.extend(data)

    def close(self) -> int | None:
        try:
            pid, status = os.waitpid(self.pid, os.WNOHANG)
            if pid == 0:  # still running
                os.kill(self.pid, signal.SIGTERM)
                _, status = os.waitpid(self.pid, 0)
        except ChildProcessError:
            status = None
        try:
            os.close(self.fd)
        except OSError:
            pass
        return status


@pytest.fixture
def host():
    proc = TtyHost(env={"BASHCRAWL_GEM_SEED": "42"})
    try:
        yield proc
    finally:
        proc.close()


def test_hud_boots_full_screen_with_sidebar(host: TtyHost) -> None:
    text = host.expect("/entrance $")
    assert b"\x1b[?1049h" in host.raw, "HUD mode enters the alternate screen"
    assert "HERO" in text and "QUEST" in text, "sidebar panels render at 100 columns"
    assert "Welcome to Bashcrawl" in text


def test_commands_run_and_repaint(host: TtyHost) -> None:
    host.expect("/entrance $")
    host.send("ls -F\r")
    text = host.expect("cellar/")
    assert "scroll" in text
    host.send("cd cellar\r")
    host.expect("/entrance/cellar $")


def test_xyzzy_opens_the_storm_and_q_returns(host: TtyHost) -> None:
    host.expect("/entrance $")
    host.send("xyzzy\r")
    host.expect("DAEMON STORM")
    host.expect("space starts")
    host.drain(0.5)  # the pixel field follows the text rows
    assert b"\x1b[2J" in host.raw, "the overlay erases the HUD frame underneath"
    assert b"\x1b[38;2;" in host.raw, "truecolor pixels are painted"
    assert "\u2580".encode() in host.raw or "\u2584".encode() in host.raw, "half-block pixels"
    host.send(" ")  # start wave 1
    text = host.expect("wave 1/3")
    assert "SIGHUP" in text
    assert "shells $$$" in text
    host.drain(2.2)  # banner ends, play begins
    host.send("\x1b[C")  # right arrow
    host.send(" ")  # fire
    host.drain(0.3)
    host.send("q")
    text = host.expect("The storm fades")
    assert "starlight" in text, "the unlock line is in the log once the HUD returns"
    host.expect("/entrance $")


def test_secret_words_never_reach_the_shell(host: TtyHost) -> None:
    host.expect("/entrance $")
    host.send("plugh\r")
    host.expect("DAEMON STORM")
    host.send("\x03")  # ^C leaves the storm rather than the host
    host.expect("The storm fades")
    host.send("history\r")
    text = host.expect("/entrance $", timeout=5)
    listed = text.lower().replace("plugh\r", "")
    assert "plugh" not in listed, "secret words are not recorded in history"


def test_ctrl_d_exits_cleanly(host: TtyHost) -> None:
    host.expect("/entrance $")
    host.send("\x04")
    host.expect("Farewell, adventurer.")
    host.drain(0.5)
    assert b"\x1b[?1049l" in host.raw, "leaves the alternate screen on exit"
    status = host.close()
    assert status is not None and os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0
