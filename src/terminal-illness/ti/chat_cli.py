"""CLI bridge: ask Merlin a question from the bash terminal.

Usage (called by help.sh):
    cd src/terminal-illness
    python -m ti.chat_cli "how do I list files?"

Reads game state from .ti_save.json if present (for context).
Prints Merlin's response to stdout and exits.

Exit codes:
    0  — success
    1  — question not provided
    2  — API error (still prints fallback, exits 0)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def _find_game_root() -> Path:
    """Walk up from cwd looking for entrance/."""
    candidate = Path.cwd()
    for _ in range(6):
        if (candidate / "entrance").is_dir():
            return candidate
        candidate = candidate.parent
    # Fallback: module root
    return Path(__file__).resolve().parents[3]


def _load_minimal_state(game_root: Path) -> dict:
    """Load the save file for context, or return empty defaults."""
    save_path = game_root / ".ti_save.json"
    if save_path.exists():
        try:
            with save_path.open() as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m ti.chat_cli <question>", file=sys.stderr)
        sys.exit(1)

    question = " ".join(sys.argv[1:]).strip()
    if not question:
        print("Usage: python -m ti.chat_cli <question>", file=sys.stderr)
        sys.exit(1)

    game_root = _find_game_root()
    raw_state = _load_minimal_state(game_root)

    # Build a minimal GameContext from the saved state
    # We do this without a full GameFileSystem to keep the CLI dependency-light
    import os

    try:
        # Try to use the full service machinery
        _run_full(question, game_root, raw_state)
    except ImportError as exc:
        # If textual/anthropic isn't installed in this env, print a fallback
        print(f"Merlin says: Install dependencies to unlock full AI guidance. ({exc})")
        sys.exit(0)


def _run_full(question: str, game_root: Path, raw_state: dict) -> None:
    """Use the full AIChatService + GameContextBuilder pipeline."""
    import sys as _sys
    _sys.path.insert(0, str(game_root / "src" / "terminal-illness"))

    from ti.ai_chat import AIChatService
    from ti.chat_context import GameContext

    # Build a lightweight context from raw JSON (no FS needed for CLI)
    cwd = raw_state.get("current_location", "/entrance")
    inventory = raw_state.get("inventory", "")
    hp = int(raw_state.get("hp", 100))
    player_name = raw_state.get("player_name", "adventurer")

    # Try to read quest text
    try:
        from ti.quests import quest_list
        quests = quest_list()
        qid = int(raw_state.get("current_quest_id", 0))
        quest_text = f"{quests[qid].title}: {quests[qid].objective}" if qid < len(quests) else "All complete"
    except Exception:
        quest_text = "(unknown)"

    # Try to read the scroll in the current room
    scroll_excerpt = ""
    try:
        scroll_path = game_root / cwd.lstrip("/") / "scroll"
        if scroll_path.exists():
            text = scroll_path.read_text(errors="replace")
            scroll_excerpt = text[:600]
    except Exception:
        pass

    # Try to list room contents
    room_contents: list[str] = []
    try:
        room_dir = game_root / cwd.lstrip("/")
        if room_dir.is_dir():
            for entry in room_dir.iterdir():
                name = entry.name + ("/" if entry.is_dir() else ("*" if entry.stat().st_mode & 0o111 else ""))
                room_contents.append(name)
    except Exception:
        pass

    context = GameContext(
        room=cwd,
        inventory=inventory,
        hp=hp,
        quest=quest_text,
        recent_commands=[],
        room_contents=room_contents,
        scroll_excerpt=scroll_excerpt,
        player_name=player_name,
    )

    svc = AIChatService()

    if not svc.is_available():
        print(svc._fallback_response(question, context))
        return

    response = svc.ask_sync(question, context)
    # Strip Rich markup for plain-text terminal output
    import re
    plain = re.sub(r"\[/?[^\]]*\]", "", response)
    print(plain)


if __name__ == "__main__":
    main()
