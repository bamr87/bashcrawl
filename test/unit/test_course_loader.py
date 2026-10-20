"""scripts/course_loader.py turns authoring slips into located errors, never a crash.

A quoted ``order: "2"`` used to raise a ``TypeError`` from inside the
``(order, id)`` sort with no file named; a non-numeric course ``xp`` reached
the runtime as ``NaN`` and silently paid nothing.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import course_loader  # noqa: E402  (scripts/ is not a package)

pytestmark = pytest.mark.unit

COURSE = """---
id: {id}
title: Test Course
summary: A course.
level: beginner
order: {order}
xp: {xp}
---
Intro.
"""

LESSON = """---
title: First
xp: {xp}
objectives:
  - text: Do it
    when: {{command: pwd}}
    solution: pwd
---
Body.
"""


def _write_course(
    root: Path,
    course_id: str,
    *,
    order: str = "0",
    course_xp: str = "50",
    lesson_xp: str = "25",
) -> Path:
    course_dir = root / "courses" / course_id
    course_dir.mkdir(parents=True)
    (course_dir / "course.md").write_text(
        COURSE.format(id=course_id, order=order, xp=course_xp), encoding="utf-8"
    )
    (course_dir / "01-first.md").write_text(LESSON.format(xp=lesson_xp), encoding="utf-8")
    return course_dir


def test_valid_course_loads_with_integer_order_and_xp(tmp_path: Path) -> None:
    _write_course(tmp_path, "alpha", order="2", course_xp="80")
    courses, errors = course_loader.load_courses(tmp_path)
    assert errors == []
    assert [(c["id"], c["order"], c["xp"]) for c in courses] == [("alpha", 2, 80)]


def test_quoted_order_is_an_authoring_error_not_a_crash(tmp_path: Path) -> None:
    _write_course(tmp_path, "alpha", order='"2"')
    _write_course(tmp_path, "beta", order="1")
    courses, errors = course_loader.load_courses(tmp_path)
    assert "courses/alpha/course.md: order must be an integer" in errors
    # The bad value falls back to 0 so the sort still runs and names the file.
    assert [c["id"] for c in courses] == ["alpha", "beta"]


def test_non_numeric_xp_is_reported_for_courses_and_lessons(tmp_path: Path) -> None:
    _write_course(tmp_path, "alpha", course_xp='"50 XP"', lesson_xp="true")
    courses, errors = course_loader.load_courses(tmp_path)
    assert "courses/alpha/course.md: xp must be a non-negative integer" in errors
    assert "courses/alpha/01-first.md: xp must be a non-negative integer" in errors
    assert courses[0]["xp"] == 50
    assert courses[0]["lessons"][0]["xp"] == 25


def test_build_bundle_names_the_offending_file(tmp_path: Path) -> None:
    _write_course(tmp_path, "alpha", order='"2"')
    with pytest.raises(ValueError, match=r"courses/alpha/course\.md: order must be an integer"):
        course_loader.build_bundle(tmp_path)
