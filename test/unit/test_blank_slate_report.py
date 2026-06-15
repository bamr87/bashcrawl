"""Unit tests for the blank-slate scorer (pure functions, no game, no API)."""

from __future__ import annotations

import pytest
from analysis.blank_slate_report import (
    load_walkthrough,
    normalize_room,
    score_session,
)

pytestmark = pytest.mark.unit


def _wt() -> dict:
    return load_walkthrough()


def test_score_session_math() -> None:
    events = [
        {"event": "session_start", "sid": "T1"},
        {"event": "room_enter", "room": "entrance"},
        {"event": "command", "command": "pwd", "room": "entrance", "outcome": "progress"},
        {"event": "quest_complete", "quest_id": 0, "room": "entrance"},
        {"event": "command", "command": "cat scroll", "room": "entrance", "outcome": "neutral"},
        {"event": "command", "command": "./treasure", "room": "entrance/cellar",
         "outcome": "progress"},
        {"event": "quest_complete", "quest_id": 1, "room": "entrance/cellar"},
        {"event": "session_end"},
    ]
    score = score_session(events, _wt())
    assert score["session_id"] == "T1"
    assert score["completeness"]["quests"]["done"] == [0, 1]
    assert score["completeness"]["quests"]["furthest"] == 2
    assert score["completeness"]["scrolls"]["read"] >= 1   # cat scroll in entrance
    assert score["completeness"]["scripts"]["run"] >= 1     # ./treasure
    assert 0 <= score["self_teaching_pct"] <= 100


def test_gap_severity_blocked_vs_recovered() -> None:
    base = [{"event": "content_gap", "room": "entrance", "quest_id": 0, "reason": "stuck"}]
    blocked = score_session(base + [{"event": "session_end"}], _wt())
    assert blocked["gaps"][0]["severity"] == "blocked"

    recovered = score_session(
        base + [{"event": "discovery", "command": "grep", "room": "entrance"}],
        _wt(),
    )
    assert recovered["gaps"][0]["severity"] == "high"


def test_self_reported_gap_ranks_below_auto() -> None:
    events = [
        {"event": "content_gap", "room": "entrance", "quest_id": 0,
         "reason": "no idea", "self_reported": True},
        {"event": "discovery", "command": "ls", "room": "entrance"},
    ]
    score = score_session(events, _wt())
    assert score["gaps"][0]["severity"] == "reported"


def test_gap_carries_on_screen_quest_objective() -> None:
    events = [
        {"event": "content_gap", "room": "entrance/cellar", "quest_id": 3,
         "quest_objective": "Use 'cat scroll' to read the ancient knowledge.", "reason": "stuck"},
        {"event": "session_end"},
    ]
    score = score_session(events, _wt())
    assert score["gaps"][0]["quest_objective"] == "Use 'cat scroll' to read the ancient knowledge."


def test_normalize_room_matches_walkthrough_keys() -> None:
    assert normalize_room("/entrance/cellar") == "entrance/cellar"
    assert normalize_room("entrance") == "entrance"
    assert normalize_room("/entrance/chapel/graveyard").startswith("entrance/.chapel")
