"""Scripted, in-process playtest runner — the deterministic driver.

Drives a fresh sandboxed game from a fixed list of commands using the *same*
:class:`~ti.session.GameSession` + :class:`~ti.playtest.recorder.SessionRecorder`
the MCP server uses for live Claude-Code sessions. The JSONL it produces is
therefore identical in shape to a live run, so the offline scorer and the
deterministic test suite exercise the exact code path that ships — with zero
API cost and no flakiness.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from ..session import GameSession
from .recorder import SessionRecorder
from .sandbox import create_sandbox, destroy_sandbox, find_game_root, sandbox_game_dir


def run_session(
    commands: List[str],
    *,
    game_root: Optional[Path] = None,
    session_id: str = "scripted",
    log_dir: Optional[Path] = None,
    stuck_threshold: int = 3,
) -> Path:
    """Play ``commands`` against a fresh sandbox; return the durable JSONL log path.

    The sandbox is always discarded; the log is written to ``log_dir`` (or
    ``<repo>/logs/sessions/blank_slate/``), which lives outside the sandbox so it
    survives cleanup.
    """
    source_root = Path(game_root) if game_root else find_game_root()
    target_dir = Path(log_dir) if log_dir else source_root / "logs" / "sessions" / "blank_slate"
    log_path = target_dir / f"{session_id}.jsonl"

    sandbox = create_sandbox(source_root)
    try:
        game_dir = sandbox_game_dir(sandbox)
        session = GameSession.load(game_dir, save_path=game_dir / ".playtest_save.json")
        recorder = SessionRecorder(session_id, log_path, stuck_threshold=stuck_threshold)
        recorder.start(session.snapshot())
        for command in commands:
            before = session.snapshot()
            result, outputs = session.execute_line(command)
            after = session.snapshot()
            recorder.record_command(command, outputs, before, after)
            if result == "exit":
                break
        recorder.end(session.snapshot(), reason="scripted_end")
    finally:
        destroy_sandbox(sandbox)
    return log_path
