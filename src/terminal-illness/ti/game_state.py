from __future__ import annotations

from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, TypedDict
import json


# Unified save file shared with the Bash emulator (lib/state.sh)
SAVE_FILE_NAME = ".bashcrawl_save.json"

# Legacy file name for backwards compatibility / migration
_LEGACY_SAVE_NAME = ".ti_save.json"


class OutputEntry(TypedDict):
    kind: str  # command | output | success | error | info | magic
    text: str


@dataclass
class GameState:
    current_quest_id: int = 0
    completed_quest_ids: List[int] = field(default_factory=list)
    learned_commands: List[str] = field(default_factory=list)
    current_location: str = "entrance"
    player_name: Optional[str] = None
    experience_points: int = 0
    session_history: List[OutputEntry] = field(default_factory=list)
    mode: str = "classic"  # classic | dynamic
    # Game variables mirroring bash env vars
    inventory: str = ""  # comma-separated items (mirrors $I)
    hp: int = 100  # health points (mirrors $HP) — default 100
    hp_set: bool = False  # True once HP is explicitly set via gameplay
    env_vars: Dict[str, str] = field(default_factory=dict)
    # Bash-side fields preserved for round-trip compatibility
    game_level: str = "novice"
    game_started: str = "false"
    session_count: int = 0
    last_session: str = ""
    scrolls_read: str = ""

    @property
    def game_env(self) -> Dict[str, str]:
        """Return env vars dict suitable for subprocess calls.

        HP is only passed to subprocesses when it has been explicitly set
        during gameplay (e.g. via a potion).  This matches the bash game
        where ``$HP`` starts unset, and scripts like ``./potion`` check
        ``${HP:-0} -gt 0`` to detect first use.
        """
        env: Dict[str, str] = dict(self.env_vars)
        if self.inventory:
            env["I"] = self.inventory
        if self.hp_set and self.hp > 0:
            env["HP"] = str(self.hp)
        return env

    def set_env(self, key: str, value: str) -> None:
        """Set a game environment variable, updating inventory/hp if applicable."""
        if key == "I":
            self.inventory = value
        elif key == "HP":
            try:
                self.hp = int(value)
                self.hp_set = True
            except ValueError:
                pass
        else:
            self.env_vars[key] = value

    def save(self, save_path: Optional[Path] = None) -> None:
        target = save_path or Path.cwd() / SAVE_FILE_NAME
        data = asdict(self)
        # Normalise location: strip leading "/" for bash compatibility
        loc = data.get("current_location", "entrance")
        if loc.startswith("/"):
            loc = loc.lstrip("/") or "entrance"
        data["current_location"] = loc
        # Serialise list fields as comma-separated strings for bash interop
        if isinstance(data.get("completed_quest_ids"), list):
            data["completed_quest_ids"] = ",".join(
                str(x) for x in data["completed_quest_ids"]
            )
        if isinstance(data.get("learned_commands"), list):
            data["learned_commands"] = ",".join(data["learned_commands"])
        # Merge any extra keys that were in the file but not in our dataclass
        if hasattr(self, "_extra_keys"):
            data.update(self._extra_keys)
        target.write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, save_path: Optional[Path] = None) -> GameState:
        target = save_path or Path.cwd() / SAVE_FILE_NAME

        # Migration: try legacy .ti_save.json if the unified file is missing
        if not target.exists():
            legacy = target.parent / _LEGACY_SAVE_NAME
            if legacy.exists():
                target = legacy
            else:
                return cls()

        try:
            data = json.loads(target.read_text())

            # Normalise location: strip leading "/"
            loc = data.get("current_location", "entrance")
            if isinstance(loc, str) and loc.startswith("/"):
                loc = loc.lstrip("/") or "entrance"

            # Handle completed_quest_ids: may be comma-string (bash) or list (python)
            raw_completed = data.get("completed_quest_ids", [])
            if isinstance(raw_completed, str):
                completed = [int(x) for x in raw_completed.split(",") if x.strip()]
            else:
                completed = list(raw_completed)

            # Handle learned_commands: may be comma-string (bash) or list (python)
            raw_learned = data.get("learned_commands", [])
            if isinstance(raw_learned, str):
                learned = [x.strip() for x in raw_learned.split(",") if x.strip()]
            else:
                learned = list(raw_learned)

            gs = cls(
                current_quest_id=int(data.get("current_quest_id", 0)),
                completed_quest_ids=completed,
                learned_commands=learned,
                current_location=loc,
                player_name=data.get("player_name") or None,
                experience_points=int(data.get("experience_points", 0)),
                session_history=list(data.get("session_history", [])),
                mode=data.get("mode", "classic"),
                inventory=data.get("inventory", ""),
                hp=int(data.get("hp", 100)),
                hp_set=bool(data.get("hp_set", False)),
                env_vars=dict(data.get("env_vars", {})),
                game_level=data.get("game_level", "novice"),
                game_started=str(data.get("game_started", "false")),
                session_count=int(data.get("session_count", 0)),
                last_session=data.get("last_session", ""),
                scrolls_read=data.get("scrolls_read", ""),
            )

            # Preserve unknown keys for round-trip with bash
            known = {f.name for f in cls.__dataclass_fields__.values()}
            gs._extra_keys = {k: v for k, v in data.items() if k not in known}

            return gs
        except Exception:
            return cls()

    def log(self, kind: str, text: str) -> None:
        self.session_history.append({"kind": kind, "text": text})
        # Trim history for memory efficiency
        if len(self.session_history) > 1000:
            self.session_history = self.session_history[-1000:]

