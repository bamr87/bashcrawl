from __future__ import annotations

from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, TypedDict
import json


SAVE_FILE_NAME = ".ti_save.json"


class OutputEntry(TypedDict):
    kind: str  # command | output | success | error | info | magic
    text: str


@dataclass
class GameState:
    current_quest_id: int = 0
    completed_quest_ids: List[int] = field(default_factory=list)
    learned_commands: List[str] = field(default_factory=list)
    current_location: str = "/entrance"
    player_name: Optional[str] = None
    experience_points: int = 0
    session_history: List[OutputEntry] = field(default_factory=list)
    mode: str = "classic"  # classic | dynamic
    # Game variables mirroring bash env vars
    inventory: str = ""  # comma-separated items (mirrors $I)
    hp: int = 0  # health points (mirrors $HP)
    env_vars: Dict[str, str] = field(default_factory=dict)

    @property
    def game_env(self) -> Dict[str, str]:
        """Return env vars dict suitable for subprocess calls."""
        env: Dict[str, str] = dict(self.env_vars)
        if self.inventory:
            env["I"] = self.inventory
        if self.hp > 0:
            env["HP"] = str(self.hp)
        return env

    def set_env(self, key: str, value: str) -> None:
        """Set a game environment variable, updating inventory/hp if applicable."""
        if key == "I":
            self.inventory = value
        elif key == "HP":
            try:
                self.hp = int(value)
            except ValueError:
                pass
        else:
            self.env_vars[key] = value

    def save(self, save_path: Optional[Path] = None) -> None:
        target = save_path or Path.cwd() / SAVE_FILE_NAME
        data = asdict(self)
        target.write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, save_path: Optional[Path] = None) -> GameState:
        target = save_path or Path.cwd() / SAVE_FILE_NAME
        if not target.exists():
            return cls()
        try:
            data = json.loads(target.read_text())
            return cls(
                current_quest_id=data.get("current_quest_id", 0),
                completed_quest_ids=list(data.get("completed_quest_ids", [])),
                learned_commands=list(data.get("learned_commands", [])),
                current_location=data.get("current_location", "/entrance"),
                player_name=data.get("player_name"),
                experience_points=int(data.get("experience_points", 0)),
                session_history=list(data.get("session_history", [])),
                mode=data.get("mode", "classic"),
                inventory=data.get("inventory", ""),
                hp=int(data.get("hp", 0)),
                env_vars=dict(data.get("env_vars", {})),
            )
        except Exception:
            return cls()

    def log(self, kind: str, text: str) -> None:
        self.session_history.append({"kind": kind, "text": text})
        # Trim history for memory efficiency
        if len(self.session_history) > 1000:
            self.session_history = self.session_history[-1000:]

