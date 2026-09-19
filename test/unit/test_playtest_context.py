"""Unit tests for playtest turn-context helpers (no bash session required)."""

from __future__ import annotations

from pathlib import Path

from playtest.context import build_turn, inspect_room, norm_room_path, render_compact


def test_norm_room_path_strips_hidden_dots():
    assert norm_room_path("entrance/.chapel/graveyard") == "entrance/chapel/graveyard"
    assert norm_room_path("entrance/chapel") == "entrance/chapel"
    assert norm_room_path("entrance") == "entrance"


def test_inspect_room_classifies_entries(tmp_path: Path):
    room = tmp_path / "entrance"
    room.mkdir()
    (room / "cellar").mkdir()
    (room / "scroll").write_text("hello scroll\n", encoding="utf-8")
    treasure = room / "treasure"
    treasure.write_text("#!/bin/bash\necho hi\n", encoding="utf-8")
    treasure.chmod(0o755)
    (room / "README.md").write_text("overview\n", encoding="utf-8")
    (room / ".secret").write_text("nope\n", encoding="utf-8")
    (room / "portal").symlink_to("cellar")

    info = inspect_room(room)
    assert info["exists"] is True
    assert info["exits"] == ["cellar"]
    assert info["encounters"] == ["treasure"]
    assert info["files"] == ["README.md"]
    assert info["portals"] == ["portal"]
    assert info["scroll_present"] is True
    assert info["scroll"] == "hello scroll\n"
    assert any(h["name"] == ".secret" for h in info["hidden"])
    assert "cellar/" in info["listing"]
    assert "treasure*" in info["listing"]
    assert "portal@" in info["listing"]


def test_build_turn_omits_scroll_until_asked(tmp_path: Path):
    room = tmp_path / "entrance"
    room.mkdir()
    (room / "scroll").write_text("ANCIENT\n", encoding="utf-8")
    snap = {"cwd": "entrance", "inventory": "", "hp": None, "awaiting_input": False}
    compact = build_turn(
        game_dir=tmp_path,
        snapshot=snap,
        last_output="looked",
        turn=2,
        include_scroll=False,
    )
    assert compact["scroll_present"] is True
    assert "scroll" not in compact
    assert compact["output"] == "looked"
    assert compact["turn"] == 2
    full = build_turn(
        game_dir=tmp_path,
        snapshot=snap,
        include_scroll=True,
    )
    assert full["scroll"] == "ANCIENT\n"


def test_render_compact_mentions_listing():
    packet = {
        "turn": 1,
        "location": "entrance",
        "room_title": "THE ENTRANCE HALL",
        "health": None,
        "inventory": "",
        "listing": ["cellar/", "scroll"],
        "awaiting_input": False,
        "teaches": ["pwd"],
        "next_steps": "Explore the cellar/",
        "scroll_present": True,
        "output": "",
    }
    text = render_compact(packet)
    assert "Location : entrance" in text
    assert "cellar/" in text
    assert "THE ENTRANCE HALL" in text
    assert "cat scroll" in text


def test_render_compact_prompt_hides_next_steps():
    packet = {
        "turn": 1,
        "location": "entrance/chapel",
        "room_title": "THE CHAPEL",
        "health": 10,
        "inventory": "amulet,",
        "listing": ["altar*", "courtyard/"],
        "awaiting_input": True,
        "teaches": ["Searching text with grep"],
        "next_steps": "Explore the graveyard",
        "scroll_present": True,
        "output": "Do you want to put the trinket back on the altar? y/n",
    }
    text = render_compact(packet)
    assert "usually y or n" in text
    assert "Do not type a new shell command" in text
    assert "Teaches" not in text
    assert "Next     :" not in text
