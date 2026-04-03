"""Pure-Python game session facade over TerminalEngine + GameState + GameFileSystem.

Used by the Textual TUI, JSON stdio bridge, MCP server, and tests. No Textual
dependency in this module.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .filesystem import GameFileSystem
from .game_state import GameState
from .quests import quest_list
from .terminal_engine import TerminalEngine


def snapshot_state(
    state: GameState,
    fs: GameFileSystem,
    engine: TerminalEngine,
) -> Dict[str, Any]:
    """Structured game state for APIs (shared by GameSession and HeadlessSession)."""
    cwd = engine.cwd()
    quests = quest_list()
    q_idx = state.current_quest_id
    quest_title = ""
    quest_objective = ""
    if q_idx < len(quests):
        q = quests[q_idx]
        quest_title = q.title
        quest_objective = q.objective
    try:
        items = fs.ls(cwd, "")
    except Exception:
        items = []
    return {
        "cwd": cwd,
        "hp": state.hp,
        "xp": state.experience_points,
        "inventory": state.inventory,
        "mode": state.mode,
        "player_name": state.player_name,
        "current_quest_id": state.current_quest_id,
        "completed_quest_ids": list(state.completed_quest_ids),
        "quest_title": quest_title,
        "quest_objective": quest_objective,
        "quest_total": len(quests),
        "room_items": items,
    }


def resolve_web_session_save_path(game_root: Path) -> Optional[Path]:
    """Return per-PID save path when ``BASHCRAWL_WEB_MODE=1``, else ``None``."""
    if os.environ.get("BASHCRAWL_WEB_MODE") != "1":
        return None
    session_id = f"web-{os.getpid()}"
    sessions_dir = game_root / ".game_data" / "sessions" / session_id
    sessions_dir.mkdir(parents=True, exist_ok=True)
    return sessions_dir / ".bashcrawl_save.json"


class GameSession:
    """Owns filesystem, saved state, and the command engine."""

    def __init__(
        self,
        state: GameState,
        fs: GameFileSystem,
        *,
        output_callback: Optional[Callable[[str, str], None]] = None,
        on_quest_complete: Optional[Callable[[], None]] = None,
    ) -> None:
        self.state = state
        self.fs = fs
        self._engine = TerminalEngine(
            state=state,
            fs=fs,
            output_callback=output_callback,
            on_quest_complete=on_quest_complete,
        )

    @property
    def engine(self) -> TerminalEngine:
        return self._engine

    @property
    def game_root(self) -> Path:
        return self.fs.root

    @classmethod
    def load(
        cls,
        game_root: Path,
        *,
        save_path: Optional[Path] = None,
        output_callback: Optional[Callable[[str, str], None]] = None,
        on_quest_complete: Optional[Callable[[], None]] = None,
        ensure_web_save_path: bool = False,
    ) -> GameSession:
        """Load or create state; optionally apply web-mode save path."""
        fs = GameFileSystem(game_root)
        resolved_save = save_path
        if ensure_web_save_path and resolved_save is None:
            resolved_save = resolve_web_session_save_path(game_root)
        state = GameState.load(save_path=resolved_save)
        if resolved_save:
            state._save_path = resolved_save  # type: ignore[attr-defined]
        return cls(
            state,
            fs,
            output_callback=output_callback,
            on_quest_complete=on_quest_complete,
        )

    def snapshot(self) -> Dict[str, Any]:
        """Structured game state for APIs (stdio, MCP, agents)."""
        return snapshot_state(self.state, self.fs, self._engine)

    def get_room(self) -> Dict[str, Any]:
        """Current directory and listing."""
        cwd = self._engine.cwd()
        try:
            items = self.fs.ls(cwd, "")
        except Exception:
            items = []
        return {"cwd": cwd, "items": items}

    def get_completions(self, text: str) -> List[str]:
        return self._engine.get_completions(text)

    def save(self) -> None:
        self.state.save()

    def execute_line(self, command: str) -> Tuple[Optional[str], List[Dict[str, str]]]:
        """Run a command; capture engine outputs without changing the permanent callback.

        Returns ``(exit_token, outputs)`` where ``exit_token`` is ``\"exit\"`` or
        ``None``, and ``outputs`` is ``[{\"kind\": ..., \"text\": ...}, ...]``.
        """
        buf: List[Tuple[str, str]] = []
        engine = self._engine
        prev = engine._output_callback

        def collect(kind: str, message: str) -> None:
            buf.append((kind, message))
            if prev is not None:
                prev(kind, message)

        engine._output_callback = collect
        try:
            result = engine.execute(command)
        finally:
            engine._output_callback = prev

        outputs = [{"kind": k, "text": m} for k, m in buf]
        return result, outputs


def commands_help_text() -> str:
    """Short reference of built-in commands (for MCP resource)."""
    return (
        "Built-in commands: help, pwd, ls, cd, mkdir, touch, cat, grep, rm, cp, mv, "
        "export, echo, save, load, merlin, exit. "
        "Run game scripts with ./name (e.g. ./treasure). "
        "Use Tab in the TUI for completions."
    )
