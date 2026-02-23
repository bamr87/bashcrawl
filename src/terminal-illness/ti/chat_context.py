"""Game context builder for the Merlin AI chat assistant.

Assembles a snapshot of the current game state to inject into
the AI system prompt so Merlin has relevant dungeon context.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .filesystem import GameFileSystem
    from .game_state import GameState


# ---------------------------------------------------------------------------
# Context snapshot dataclass
# ---------------------------------------------------------------------------

class GameContext:
    """Snapshot of game state passed to the AI service."""

    def __init__(
        self,
        room: str,
        inventory: str,
        hp: int,
        quest: str,
        recent_commands: List[str],
        room_contents: List[str],
        scroll_excerpt: str,
        player_name: str,
    ) -> None:
        self.room = room
        self.inventory = inventory
        self.hp = hp
        self.quest = quest
        self.recent_commands = recent_commands
        self.room_contents = room_contents
        self.scroll_excerpt = scroll_excerpt
        self.player_name = player_name

    def as_dict(self) -> dict:
        return {
            "room": self.room,
            "inventory": self.inventory or "(empty)",
            "hp": self.hp,
            "quest": self.quest,
            "recent_commands": ", ".join(self.recent_commands[-8:]) if self.recent_commands else "(none)",
            "room_contents": ", ".join(self.room_contents[:15]) if self.room_contents else "(empty)",
            "scroll_excerpt": self.scroll_excerpt or "(no scroll in this room)",
            "player_name": self.player_name or "Anonymous",
        }


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------

class GameContextBuilder:
    """Builds a GameContext snapshot from live game state."""

    SCROLL_MAX_CHARS = 600  # keep prompt lean

    def build(
        self,
        state: "GameState",
        fs: "GameFileSystem",
        recent_commands: List[str],
    ) -> GameContext:
        """Assemble a full context snapshot."""
        cwd = state.current_location or "/entrance"

        # Directory listing (show hidden files so Merlin can guide players to discover them)
        try:
            room_contents = fs.ls(cwd, "", show_hidden=True)
        except Exception:
            room_contents = []

        # Quest description
        quest_text = self._get_quest_text(state)

        # Scroll excerpt from the current room
        scroll_excerpt = self._load_scroll(fs, cwd)

        return GameContext(
            room=cwd,
            inventory=state.inventory or "",
            hp=state.hp,
            quest=quest_text,
            recent_commands=list(recent_commands),
            room_contents=room_contents,
            scroll_excerpt=scroll_excerpt,
            player_name=state.player_name or "Anonymous",
        )

    # ------------------------------------------------------------------
    # Stuck detection
    # ------------------------------------------------------------------

    @staticmethod
    def detect_stuck(recent_commands: List[str], threshold: int = 3) -> bool:
        """Return True if the player appears to be stuck.

        Triggers when the last `threshold` commands are identical,
        or when only 1-2 distinct commands appear in the last 6 commands.
        """
        if len(recent_commands) < threshold:
            return False

        tail = recent_commands[-threshold:]
        if len(set(tail)) == 1:
            return True  # same command repeated

        last_six = recent_commands[-6:]
        if len(last_six) >= 6 and len(set(last_six)) <= 2:
            return True  # only 2 distinct commands in recent history

        return False

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_quest_text(self, state: "GameState") -> str:
        try:
            from .quests import quest_list
            quests = quest_list()
            idx = state.current_quest_id
            if idx < len(quests):
                q = quests[idx]
                return f"{q.title}: {q.objective}"
            return "All quests complete — explore freely!"
        except Exception:
            return "(unknown)"

    def _load_scroll(self, fs: "GameFileSystem", cwd: str) -> str:
        """Read the scroll file in the current room, if present."""
        try:
            # Ask filesystem for the scroll's real path
            scroll_path = Path(fs._game_root) / cwd.lstrip("/") / "scroll"
            if scroll_path.exists() and scroll_path.is_file():
                text = scroll_path.read_text(errors="replace")
                # Trim to keep prompt manageable
                if len(text) > self.SCROLL_MAX_CHARS:
                    text = text[: self.SCROLL_MAX_CHARS] + "\n…(truncated)"
                return text.strip()
        except Exception:
            pass
        return ""
