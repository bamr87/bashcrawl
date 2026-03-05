"""Walkthrough data loader for Bashcrawl test framework.

Loads ``test/datasets/walkthrough.json`` — the single source of truth
for the complete game walkthrough — and provides typed access helpers.

Usage as pytest fixture::

    def test_something(walkthrough):
        for step in walkthrough.critical_path_steps():
            ...

Usage standalone::

    wt = load_walkthrough()
    steps = wt.critical_path_steps()
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DATASETS_DIR = Path(__file__).resolve().parent.parent / "datasets"
WALKTHROUGH_PATH = DATASETS_DIR / "walkthrough.json"


class Walkthrough:
    """Typed accessor for walkthrough.json data."""

    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data

    @property
    def metadata(self) -> dict[str, Any]:
        return self._data["metadata"]

    @property
    def quests(self) -> list[dict[str, Any]]:
        return self._data["quests"]

    @property
    def rooms(self) -> dict[str, dict[str, Any]]:
        return self._data["rooms"]

    @property
    def encounters(self) -> dict[str, dict[str, Any]]:
        return self._data["encounters"]

    def critical_path_steps(self) -> list[dict[str, Any]]:
        """Ordered steps for the main linear path."""
        return self._data["critical_path"]

    def hidden_path_steps(self, area: str) -> list[dict[str, Any]]:
        """Steps for a specific hidden area (chapel, graveyard, vault, scrap, rift)."""
        return self._data["hidden_paths"][area]["steps"]

    def hidden_path_names(self) -> list[str]:
        """All hidden path area names."""
        return list(self._data["hidden_paths"].keys())

    def all_hidden_steps(self) -> list[dict[str, Any]]:
        """All hidden path steps in full_walkthrough_order."""
        steps = []
        for area in self._data["full_walkthrough_order"]:
            if area == "critical_path":
                continue
            steps.extend(self.hidden_path_steps(area))
        return steps

    def full_walkthrough_steps(self) -> list[dict[str, Any]]:
        """All steps in correct dependency order (critical path + hidden paths)."""
        steps = list(self.critical_path_steps())
        steps.extend(self.all_hidden_steps())
        return steps

    def encounter_spec(self, script_path: str) -> dict[str, Any]:
        """Encounter definition for a given script path."""
        return self._data["encounters"][script_path]

    def room_spec(self, room_path: str) -> dict[str, Any]:
        """Room definition for a given room path."""
        return self._data["rooms"][room_path]

    def steps_with_encounters(self) -> list[dict[str, Any]]:
        """All walkthrough steps that trigger an encounter."""
        return [
            s for s in self.full_walkthrough_steps()
            if "encounter" in s
        ]

    def steps_with_screenshots(self) -> list[dict[str, Any]]:
        """All steps that have a screenshot_name defined."""
        return [
            s for s in self.full_walkthrough_steps()
            if "screenshot_name" in s
        ]

    def step_commands(self, section: str = "critical_path") -> list[str]:
        """Extract just the command strings from a section.

        Args:
            section: 'critical_path' or a hidden path name.

        Returns:
            List of command strings.
        """
        if section == "critical_path":
            steps = self.critical_path_steps()
        else:
            steps = self.hidden_path_steps(section)
        return [s["command"] for s in steps]

    def room_names(self) -> list[str]:
        """All room path keys."""
        return list(self._data["rooms"].keys())

    def rooms_with_scrolls(self) -> list[str]:
        """Room paths that have scrolls."""
        return [k for k, v in self._data["rooms"].items() if v.get("scroll")]

    def rooms_with_scripts(self) -> list[str]:
        """Room paths that have executable scripts."""
        return [k for k, v in self._data["rooms"].items() if v.get("scripts")]

    def encounter_names(self) -> list[str]:
        """All encounter script paths."""
        return list(self._data["encounters"].keys())


def load_walkthrough(path: Path | None = None) -> Walkthrough:
    """Load and parse walkthrough.json.

    Args:
        path: Override path to walkthrough.json. Defaults to
            ``test/datasets/walkthrough.json``.

    Returns:
        Walkthrough accessor instance.
    """
    p = path or WALKTHROUGH_PATH
    with open(p) as f:
        data = json.load(f)
    return Walkthrough(data)
