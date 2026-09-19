"""Transport-agnostic play session used by the MCP server, agent CLI, and tests.

Holds the sandbox + bash session + recorder for one in-flight game and renders
agent-facing screens. Kept free of any ``mcp`` dependency so it can be driven
directly from tests without the server transport installed.

Two faces, one session:

* **player** (default) — location / HP / inventory / last output. The agent must
  ``ls`` and ``cat scroll`` like a human. Used by the blank-slate playtest.
* **context** — the same game, plus a compact room HUD (listing, teaches,
  next-steps). Full scroll text is on :meth:`state`, not every command reply.
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from .bash_session import BashGameSession
from .context import build_turn, load_room_index, render_compact, render_full
from .recorder import SessionRecorder
from .sandbox import create_sandbox, destroy_sandbox, find_game_root, sandbox_game_dir


def _log_dir() -> Path:
    env = os.environ.get("BASHCRAWL_PLAYTEST_LOG_DIR")
    if env:
        return Path(env)
    try:
        root = find_game_root()
    except FileNotFoundError:
        root = Path.cwd()
    return root / "logs" / "sessions" / "blank_slate"


def _render_player(snapshot: Dict[str, Any], output: str, *, header: str = "") -> str:
    hp = snapshot.get("hp")
    hp_txt = "unknown" if hp is None else str(hp)
    inv = snapshot.get("inventory") or "(empty)"
    lines = []
    if header:
        lines.append(header)
    lines.append(f"Location : {snapshot.get('cwd', '?')}")
    lines.append(f"Health   : {hp_txt}")
    lines.append(f"Inventory: {inv}")
    if snapshot.get("awaiting_input"):
        lines.append(
            "The game is waiting for a prompt answer (usually y or n). "
            "Do not type a new shell command."
        )
    lines.append("")
    body = output.strip() if output.strip() else "(no new output — try 'ls' or 'cat scroll')"
    lines.append(body)
    return "\n".join(lines)


class PlaytestHarness:
    """One in-flight play session: sandbox + bash REPL + audit recorder."""

    def __init__(self) -> None:
        self.sandbox: Optional[Path] = None
        self.session: Optional[BashGameSession] = None
        self.recorder: Optional[SessionRecorder] = None
        self.last_snapshot: Dict[str, Any] = {}
        self.last_output: str = ""
        self.last_command: str = ""
        self.context_mode: bool = False
        self.turn: int = 0
        self._rooms: Dict[str, Dict[str, Any]] = {}

    def game_dir(self) -> Optional[Path]:
        if self.sandbox is None:
            return None
        return sandbox_game_dir(self.sandbox)

    # -- lifecycle ---------------------------------------------------------
    def start(self, fresh: bool = True, context: bool = False) -> str:
        self.close()
        self.context_mode = bool(context)
        self.turn = 0
        self.last_command = ""
        self.sandbox = create_sandbox()
        game = sandbox_game_dir(self.sandbox)
        self._rooms = load_room_index(game)
        self.session = BashGameSession(game)
        self.session.start()

        sid = uuid.uuid4().hex[:12]
        self.recorder = SessionRecorder(sid, _log_dir() / f"{sid}.jsonl")
        snap = self.session.snapshot()
        self.last_snapshot = snap
        self.last_output = ""
        self.recorder.start(snap)

        if self.context_mode:
            intro = (
                "Clean sandbox ready. You are at the dungeon entrance. "
                "Each reply includes a room HUD. Call bashcrawl_state for the "
                "full scroll and hidden entries, or play with real commands."
            )
            packet = self.state(include_scroll=False)
            return intro + "\n\n" + render_compact(packet)

        intro = (
            "You are standing at the entrance of a dark dungeon. Everything you need "
            "to learn will appear on screen when you look around and read what you find. "
            "Use bashcrawl_command to act and bashcrawl_observe to look again."
        )
        return _render_player(snap, "Type a command to look around (for example: ls).", header=intro)

    def close(self) -> None:
        if self.session is not None:
            try:
                if self.recorder is not None:
                    try:
                        self.recorder.end(self.last_snapshot, reason="teardown")
                    except OSError:
                        pass
            finally:
                try:
                    self.session.close()
                finally:
                    self.session = None
        if self.sandbox is not None:
            destroy_sandbox(self.sandbox)
            self.sandbox = None
        self._rooms = {}

    def _require_session(self) -> Optional[str]:
        if self.session is None:
            return "No game in progress. Call bashcrawl_start(fresh=true) first."
        return None

    def _packet(self, *, include_scroll: bool) -> Dict[str, Any]:
        game = self.game_dir()
        snap = self.last_snapshot or (self.session.snapshot() if self.session else {})
        return build_turn(
            game_dir=game or Path("."),
            snapshot=snap,
            rooms=self._rooms,
            last_output=self.last_output,
            last_command=self.last_command,
            turn=self.turn,
            include_scroll=include_scroll,
        )

    def _screen(self, snap: Dict[str, Any], output: str) -> str:
        if self.context_mode:
            return render_compact(self._packet(include_scroll=False))
        return _render_player(snap, output)

    # -- agent tools -------------------------------------------------------
    def observe(self) -> str:
        err = self._require_session()
        if err:
            return err
        snap = self.session.snapshot()
        self.last_snapshot = snap
        return self._screen(snap, self.last_output)

    def command(self, line: str) -> str:
        err = self._require_session()
        if err:
            return err
        before = self.last_snapshot or self.session.snapshot()
        outputs = self.session.run(line)
        after = self.session.snapshot()
        if self.recorder is not None:
            self.recorder.record_command(line, outputs, before, after)
        self.last_snapshot = after
        self.last_output = "\n".join(o.get("text", "") for o in outputs)
        self.last_command = line
        self.turn += 1
        return self._screen(after, self.last_output)

    def state(self, include_scroll: bool = True) -> Dict[str, Any]:
        """Structured turn context (JSON-serializable). Empty dict if no session."""
        if self.session is None:
            return {}
        snap = self.session.snapshot()
        self.last_snapshot = snap
        return self._packet(include_scroll=include_scroll)

    def state_text(self, include_scroll: bool = True) -> str:
        err = self._require_session()
        if err:
            return err
        packet = self.state(include_scroll=include_scroll)
        if include_scroll:
            return render_full(packet)
        return render_compact(packet)

    def state_json(self, include_scroll: bool = True) -> str:
        err = self._require_session()
        if err:
            return json.dumps({"ok": False, "error": err})
        return json.dumps(self.state(include_scroll=include_scroll), indent=2)

    def report_gap(self, note: str) -> str:
        if self.recorder is not None:
            self.recorder.record_gap(note, state=self.last_snapshot)
        return (
            "Noted — thanks for flagging the gap. Make your best attempt and keep going "
            "if you can, or stop if you are truly stuck."
        )
