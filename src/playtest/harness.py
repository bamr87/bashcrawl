"""Transport-agnostic play session used by the MCP server (and tests).

Holds the sandbox + bash session + recorder for one in-flight game and renders
agent-facing screens. Kept free of any ``mcp`` dependency so it can be driven
directly from tests without the server transport installed.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from .bash_session import BashGameSession
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


def _render(snapshot: Dict[str, Any], output: str, *, header: str = "") -> str:
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
        lines.append("The game is waiting for your answer — reply with your next command.")
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

    # -- lifecycle ---------------------------------------------------------
    def start(self, fresh: bool = True) -> str:
        self.close()
        self.sandbox = create_sandbox()
        self.session = BashGameSession(sandbox_game_dir(self.sandbox))
        self.session.start()

        sid = uuid.uuid4().hex[:12]
        self.recorder = SessionRecorder(sid, _log_dir() / f"{sid}.jsonl")
        snap = self.session.snapshot()
        self.last_snapshot = snap
        self.last_output = ""
        self.recorder.start(snap)

        intro = (
            "You are standing at the entrance of a dark dungeon. Everything you need "
            "to learn will appear on screen when you look around and read what you find. "
            "Use bashcrawl_command to act and bashcrawl_observe to look again."
        )
        return _render(snap, "Type a command to look around (for example: ls).", header=intro)

    def close(self) -> None:
        if self.session is not None:
            try:
                if self.recorder is not None:
                    try:
                        self.recorder.end(self.last_snapshot, reason="teardown")
                    except OSError:
                        pass  # unwritable log dir must not leak the bash child
            finally:
                try:
                    self.session.close()
                finally:
                    self.session = None
        if self.sandbox is not None:
            destroy_sandbox(self.sandbox)
            self.sandbox = None

    # -- agent tools -------------------------------------------------------
    def observe(self) -> str:
        if self.session is None:
            return "No game in progress. Call bashcrawl_start(fresh=true) first."
        snap = self.session.snapshot()
        self.last_snapshot = snap
        return _render(snap, self.last_output)

    def command(self, line: str) -> str:
        if self.session is None:
            return "No game in progress. Call bashcrawl_start(fresh=true) first."
        before = self.last_snapshot or self.session.snapshot()
        outputs = self.session.run(line)
        after = self.session.snapshot()
        if self.recorder is not None:
            self.recorder.record_command(line, outputs, before, after)
        self.last_snapshot = after
        self.last_output = "\n".join(o.get("text", "") for o in outputs)
        return _render(after, self.last_output)

    def report_gap(self, note: str) -> str:
        if self.recorder is not None:
            self.recorder.record_gap(note, state=self.last_snapshot)
        return (
            "Noted — thanks for flagging the gap. Make your best attempt and keep going "
            "if you can, or stop if you are truly stuck."
        )
