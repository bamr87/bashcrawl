"""Integration tests for the blank-slate playtest pipeline (real game, no API).

Drives the scripted runner — the same GameSession + recorder the live
Claude-Code driver uses — then scores the resulting JSONL. A competent path
scores high with no blocked gaps; a floundering path surfaces a content gap.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from analysis.blank_slate_report import load_walkthrough, parse_session, score_session
from ti.playtest.runner import run_session

pytestmark = pytest.mark.integration

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

GOOD_PATH = [
    "pwd", "ls", "cat scroll",
    "cd cellar", "ls", "cat scroll", "./treasure", "export I=amulet,$I",
    "cd armoury", "ls", "cat scroll",
    "cd chamber", "ls", "cat scroll",
]

NAIVE_PATH = ["pwd", "ls", "dance", "sing", "fly", "teleport home"]


def test_good_path_scores_high_with_no_blocked_gaps(tmp_path: Path) -> None:
    log = run_session(GOOD_PATH, game_root=REPO_ROOT, session_id="good", log_dir=tmp_path)
    assert log.is_file()

    score = score_session(parse_session(log), load_walkthrough())
    assert len(score["completeness"]["quests"]["done"]) >= 3
    assert score["self_teaching_pct"] > 0
    assert not any(g["severity"] == "blocked" for g in score["gaps"]), score["gaps"]


def test_naive_path_detects_blocked_content_gap(tmp_path: Path) -> None:
    log = run_session(NAIVE_PATH, game_root=REPO_ROOT, session_id="naive", log_dir=tmp_path)

    score = score_session(parse_session(log), load_walkthrough())
    assert score["gaps"], "expected the floundering run to surface a content gap"
    assert any(g["severity"] == "blocked" for g in score["gaps"])
    assert score["struggle"]["total"] >= 3


def test_runner_leaves_repo_clean(tmp_path: Path) -> None:
    import subprocess

    def dirty() -> str:
        return subprocess.run(
            ["git", "status", "--porcelain", "entrance"],
            cwd=str(REPO_ROOT), capture_output=True, text=True,
        ).stdout.strip()

    before = dirty()
    run_session(
        ["cd cellar", "./treasure"],  # unlocks .chapel -> chapel in the sandbox
        game_root=REPO_ROOT, session_id="clean", log_dir=tmp_path,
    )
    assert dirty() == before
