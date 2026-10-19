"""bin/bashcrawl — the one dispatch table for every surface.

Runs the real launcher with a throwaway $HOME. Only the bash-only subcommands
are exercised (help, courses, lab, doctor, play without a TTY, reset --dry);
the node/python surfaces have their own suites. CI's macOS job runs the same
subcommands under stock /bin/bash 3.2.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = ROOT / "bin" / "bashcrawl"


def run(
    *args: str, home: Path, extra_env: dict[str, str] | None = None
) -> subprocess.CompletedProcess:
    env = {**os.environ, "HOME": str(home), **(extra_env or {})}
    env.pop("BASHCRAWL_SAVE_FILE", None)
    env.pop("BASHCRAWL_LABS", None)
    return subprocess.run(
        ["bash", str(LAUNCHER), *args],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=60,
        check=False,
    )


def test_help_is_the_default_and_unknown_commands_fail(tmp_path: Path) -> None:
    default = run(home=tmp_path)
    assert default.returncode == 0
    for sub in ("play", "tty", "serve", "hub", "web", "courses", "lab", "doctor", "reset"):
        assert sub in default.stdout
    bad = run("frobnicate", home=tmp_path)
    assert bad.returncode == 2
    assert "unknown command: frobnicate" in bad.stderr


def test_courses_lists_every_course_in_order(tmp_path: Path) -> None:
    out = run("courses", home=tmp_path)
    assert out.returncode == 0, out.stderr
    rows = [line for line in out.stdout.splitlines() if line.startswith("  ") and "lessons" in line]
    ids = [line.split()[0] for line in rows]
    expected = sorted(p.name for p in (ROOT / "courses").iterdir() if (p / "course.md").is_file())
    assert sorted(ids) == expected
    assert ids[0] == "navigator", "courses are listed by their order field"
    assert "Finding Your Way" in out.stdout


def test_lab_copies_the_course_lab_and_never_deletes_learner_work(tmp_path: Path) -> None:
    out = run("lab", "navigator", home=tmp_path)
    assert out.returncode == 0, out.stderr
    lab = tmp_path / ".bashcrawl" / "labs" / "navigator"
    assert (lab / "south" / ".cave" / "gem.txt").read_text().startswith("You found the hidden gem!")
    (lab / "my-notes.txt").write_text("mine\n")

    again = run("lab", "navigator", home=tmp_path)
    assert again.returncode == 2
    assert "already exists" in again.stderr

    fresh = run("lab", "navigator", "--fresh", home=tmp_path)
    assert fresh.returncode == 0, fresh.stderr
    moved = [p for p in lab.parent.iterdir() if p.name.startswith("navigator.bak-")]
    assert len(moved) == 1 and (moved[0] / "my-notes.txt").read_text() == "mine\n"
    assert not (lab / "my-notes.txt").exists()

    custom = run("lab", "reading", str(tmp_path / "here"), home=tmp_path)
    assert custom.returncode == 0
    assert (tmp_path / "here" / "ballad.txt").is_file()
    for bad in ("../etc", "Nope", "no-such-course"):
        assert run("lab", bad, home=tmp_path).returncode == 2


def test_doctor_reports_one_verdict_per_check(tmp_path: Path) -> None:
    out = run("doctor", home=tmp_path)
    assert out.returncode in (0, 1), out.stdout + out.stderr
    verdicts = [line for line in out.stdout.splitlines() if line.startswith("[")]
    names = [line[7:].split()[0] for line in verdicts]
    assert names == ["bash", "encounters", "node", "python", "web-data", "courses", "game", "save"]
    assert all(line[:6] in ("[ OK ]", "[WARN]", "[CRIT]") for line in verdicts)
    assert "[ OK ] web-data" in out.stdout
    assert str(tmp_path) in out.stdout, "doctor reports the save path under $HOME"


def test_play_without_a_tty_points_at_the_entrance(tmp_path: Path) -> None:
    out = run("play", home=tmp_path)
    assert out.returncode == 0, out.stderr
    assert "cd " in out.stdout and "/entrance && cat scroll" in out.stdout


def _entrance_status() -> str:
    return subprocess.run(
        ["git", "status", "--porcelain", "--ignored", "entrance"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    ).stdout


def test_reset_dry_run_changes_nothing(tmp_path: Path) -> None:
    before = _entrance_status()
    out = run("reset", "--dry", home=tmp_path)
    assert out.returncode == 0, out.stderr
    assert _entrance_status() == before
