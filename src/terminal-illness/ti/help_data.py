"""Shared help data loader for bashcrawl.

Reads YAML data files from ``src/help/data/`` that are shared between
the bash help system and the Python terminal-illness wrapper.

Requires: ``pyyaml``
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class RoomHelp:
    """Help content for a single game room."""

    name: str
    emoji: str
    title: str
    description: str
    teaches: List[str] = field(default_factory=list)
    key_files: List[Dict[str, str]] = field(default_factory=list)
    next_steps: str = ""
    essential_commands: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class CommandEntry:
    """A single command reference entry."""

    command: str
    description: str


@dataclass
class CommandCategory:
    """A group of related commands."""

    key: str
    title: str
    commands: List[CommandEntry] = field(default_factory=list)


@dataclass
class Quest:
    """A game quest loaded from quests.yaml."""

    id: int
    title: str
    description: str
    objective: str
    required_commands: List[str] = field(default_factory=list)
    reward: str = ""
    xp: int = 0
    location_check: str = ""


@dataclass
class TutorialLesson:
    """A single tutorial lesson."""

    id: str
    title: str
    command: str
    steps: List[str] = field(default_factory=list)
    explanation: str = ""
    achievement_id: str = ""
    achievement_name: str = ""
    achievement_description: str = ""
    achievement_emoji: str = ""


@dataclass
class QuickRefSection:
    """A section within a quick reference card."""

    title: str
    items: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class QuickRefCard:
    """A quick reference card."""

    key: str
    title: str
    sections: List[QuickRefSection] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


def _find_data_dir() -> Path:
    """Locate the ``src/help/data/`` directory.

    Searches upward from this file's location for the bashcrawl root
    (directory containing ``entrance/``).
    """
    candidate = Path(__file__).resolve().parent
    for _ in range(6):
        candidate = candidate.parent
        if (candidate / "entrance").is_dir():
            data_dir = candidate / "src" / "help" / "data"
            if data_dir.is_dir():
                return data_dir
            break
    # Fallback: relative to cwd
    cwd_data = Path.cwd() / "src" / "help" / "data"
    if cwd_data.is_dir():
        return cwd_data
    raise FileNotFoundError(
        "Cannot locate src/help/data/. Run from the bashcrawl repo root."
    )


def _load_yaml(filename: str, data_dir: Optional[Path] = None) -> Dict[str, Any]:
    """Load and parse a YAML file from the data directory."""
    if data_dir is None:
        data_dir = _find_data_dir()
    path = data_dir / filename
    if not path.exists():
        raise FileNotFoundError(f"YAML data file not found: {path}")
    with open(path) as f:
        return yaml.safe_load(f) or {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def load_rooms(data_dir: Optional[Path] = None) -> Dict[str, RoomHelp]:
    """Load room help data from ``rooms.yaml``.

    Returns a dict mapping room name to :class:`RoomHelp`.
    """
    raw = _load_yaml("rooms.yaml", data_dir)
    rooms: Dict[str, RoomHelp] = {}
    for name, info in raw.get("rooms", {}).items():
        rooms[name] = RoomHelp(
            name=name,
            emoji=info.get("emoji", ""),
            title=info.get("title", name),
            description=info.get("description", ""),
            teaches=info.get("teaches", []),
            key_files=info.get("key_files", []),
            next_steps=info.get("next_steps", ""),
            essential_commands=info.get("essential_commands", []),
        )
    return rooms


def load_commands(data_dir: Optional[Path] = None) -> List[CommandCategory]:
    """Load command reference from ``commands.yaml``."""
    raw = _load_yaml("commands.yaml", data_dir)
    categories: List[CommandCategory] = []
    for key, cat_data in raw.get("categories", {}).items():
        cmds = [
            CommandEntry(command=c["command"], description=c["description"])
            for c in cat_data.get("commands", [])
        ]
        categories.append(
            CommandCategory(key=key, title=cat_data.get("title", key), commands=cmds)
        )
    return categories


def load_quick_ref(data_dir: Optional[Path] = None) -> Dict[str, QuickRefCard]:
    """Load quick reference cards from ``commands.yaml``."""
    raw = _load_yaml("commands.yaml", data_dir)
    cards: Dict[str, QuickRefCard] = {}
    for key, card_data in raw.get("quick_ref", {}).items():
        sections = [
            QuickRefSection(
                title=s.get("title", ""),
                items=s.get("items", []),
            )
            for s in card_data.get("sections", [])
        ]
        cards[key] = QuickRefCard(
            key=key,
            title=card_data.get("title", key),
            sections=sections,
        )
    return cards


def load_quests(data_dir: Optional[Path] = None) -> List[Quest]:
    """Load quest definitions from ``quests.yaml``."""
    raw = _load_yaml("quests.yaml", data_dir)
    quests: List[Quest] = []
    for q in raw.get("quests", []):
        quests.append(
            Quest(
                id=q["id"],
                title=q["title"],
                description=q["description"],
                objective=q["objective"],
                required_commands=q.get("required_commands", []),
                reward=q.get("reward", ""),
                xp=q.get("xp", 0),
                location_check=q.get("location_check", ""),
            )
        )
    return quests


def load_tutorials(data_dir: Optional[Path] = None) -> Dict[str, TutorialLesson]:
    """Load tutorial lessons from ``tutorials.yaml``."""
    raw = _load_yaml("tutorials.yaml", data_dir)
    lessons: Dict[str, TutorialLesson] = {}
    for lesson_id, info in raw.get("lessons", {}).items():
        lessons[lesson_id] = TutorialLesson(
            id=lesson_id,
            title=info.get("title", lesson_id),
            command=info.get("command", ""),
            steps=info.get("steps", []),
            explanation=info.get("explanation", ""),
            achievement_id=info.get("achievement_id", ""),
            achievement_name=info.get("achievement_name", ""),
            achievement_description=info.get("achievement_description", ""),
            achievement_emoji=info.get("achievement_emoji", ""),
        )
    return lessons


def load_map(data_dir: Optional[Path] = None) -> str:
    """Load the dungeon map display string from ``map.yaml``."""
    raw = _load_yaml("map.yaml", data_dir)
    return raw.get("map_display", "")


def load_recommendations(data_dir: Optional[Path] = None) -> Dict[str, Any]:
    """Load AI recommendation patterns from ``recommendations.yaml``."""
    return _load_yaml("recommendations.yaml", data_dir)
