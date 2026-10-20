#!/usr/bin/env python3
"""Compile courses/ (Markdown + YAML frontmatter) into the course bundle.

A course is a directory of Markdown files, one file per unit, the way bashOS
keeps one slash command per ``.claude/commands/*.md`` file::

    courses/<id>/course.md        frontmatter: id, title, summary, level,
                                  order, requires, skills, xp; body = intro
    courses/<id>/NN-<lesson>.md   frontmatter: title, teaches, xp, objectives
                                  (+ optional id); body = the lesson text
    courses/<id>/lab/**           practice files, seeded at /lab/<id>/

Each objective is ``{text, when, hint, solution, allow_errors?}``: ``when`` is
a TermForge rule (docs/schemas/rules.v1.md), and ``solution`` is a command
line that meets it, run by termforge/test/courses.test.js to prove that every
lesson can be won.

Consumers: scripts/export_static_web.py (-> web/data/courses.json) and
scripts/validate_content_contracts.py (authoring errors). stdlib + pyyaml.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
COURSES_DIR = ROOT / "courses"
LEVELS = ("beginner", "intermediate", "advanced")
_FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
_LESSON_FILE = re.compile(r"^(\d{2})-([a-z][a-z0-9-]*)\.md$")
_ID = re.compile(r"^[a-z][a-z0-9-]*$")
MAX_LAB_FILE = 64 * 1024


def _is_int(value: Any) -> bool:
    """A real integer: YAML `true` is an int to Python and is not one here."""
    return isinstance(value, int) and not isinstance(value, bool)


def _rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def parse_markdown(path: Path, root: Path = ROOT) -> tuple[dict[str, Any], str]:
    """Split a Markdown file into (frontmatter mapping, body)."""
    text = path.read_text(encoding="utf-8")
    match = _FRONTMATTER.match(text)
    if not match:
        raise ValueError(f"{_rel(path, root)}: missing YAML frontmatter (--- ... ---)")
    meta = yaml.safe_load(match.group(1)) or {}
    if not isinstance(meta, dict):
        raise ValueError(f"{_rel(path, root)}: frontmatter must be a mapping")
    return meta, text[match.end():].strip()


def _lab(course_dir: Path, errors: list[str], root: Path) -> dict[str, Any]:
    lab_dir = course_dir / "lab"
    dirs: list[str] = []
    files: dict[str, str] = {}
    if not lab_dir.is_dir():
        return {"dirs": dirs, "files": files}
    for path in sorted(lab_dir.rglob("*"), key=lambda p: p.as_posix()):
        rel = path.relative_to(lab_dir).as_posix()
        if path.is_dir():
            dirs.append(rel)
            continue
        if path.stat().st_size > MAX_LAB_FILE:
            errors.append(f"{_rel(path, root)}: lab files must stay under {MAX_LAB_FILE} bytes")
            continue
        try:
            files[rel] = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"{_rel(path, root)}: lab files must be UTF-8 text")
    return {"dirs": dirs, "files": files}


def _objective(raw: Any, where: str, errors: list[str]) -> dict[str, Any]:
    if not isinstance(raw, dict):
        errors.append(f"{where}: must be a mapping")
        return {}
    obj = {
        "text": raw.get("text"),
        "when": raw.get("when"),
        "hint": raw.get("hint", ""),
        "solution": raw.get("solution"),
    }
    if raw.get("allow_errors"):
        obj["allow_errors"] = True
    for field in ("text", "solution"):
        if not isinstance(obj[field], str) or not obj[field].strip():
            errors.append(f"{where}: needs {field}")
    unknown = set(raw) - {"text", "when", "hint", "solution", "allow_errors"}
    if unknown:
        errors.append(f"{where}: unknown keys {', '.join(sorted(unknown))}")
    return obj


def load_course(course_dir: Path, errors: list[str], root: Path = ROOT) -> dict[str, Any] | None:
    where = _rel(course_dir, root)
    head = course_dir / "course.md"
    if not head.is_file():
        errors.append(f"{where}: missing course.md")
        return None
    try:
        meta, intro = parse_markdown(head, root)
    except (ValueError, yaml.YAMLError) as exc:
        errors.append(str(exc))
        return None
    course_id = meta.get("id", course_dir.name)
    if course_id != course_dir.name:
        errors.append(f"{where}/course.md: id '{course_id}' must match the directory name")
    if not isinstance(course_id, str) or not _ID.match(course_id):
        errors.append(f"{where}/course.md: id must be kebab-case")
    if meta.get("level") not in LEVELS:
        errors.append(f"{where}/course.md: level must be one of {', '.join(LEVELS)}")
    for field in ("title", "summary"):
        if not isinstance(meta.get(field), str) or not meta[field].strip():
            errors.append(f"{where}/course.md: needs {field}")
    lessons: list[dict[str, Any]] = []
    for path in sorted(course_dir.glob("*.md")):
        if path.name == "course.md":
            continue
        match = _LESSON_FILE.match(path.name)
        lesson_where = f"{where}/{path.name}"
        if not match:
            errors.append(f"{lesson_where}: lesson files are named NN-lesson-id.md")
            continue
        try:
            lmeta, body = parse_markdown(path, root)
        except (ValueError, yaml.YAMLError) as exc:
            errors.append(str(exc))
            continue
        objectives_raw = lmeta.get("objectives")
        if not isinstance(objectives_raw, list) or not objectives_raw:
            errors.append(f"{lesson_where}: needs at least one objective")
            objectives_raw = []
        xp = lmeta.get("xp", 25)
        if not _is_int(xp) or xp < 0:
            errors.append(f"{lesson_where}: xp must be a non-negative integer")
            xp = 25
        lessons.append(
            {
                "id": lmeta.get("id", match.group(2)),
                "title": lmeta.get("title"),
                "teaches": [str(t) for t in lmeta.get("teaches") or []],
                "xp": xp,
                "body": body,
                "objectives": [
                    _objective(raw, f"{lesson_where} objective {i + 1}", errors)
                    for i, raw in enumerate(objectives_raw)
                ],
            }
        )
        if not isinstance(lmeta.get("title"), str) or not lmeta["title"].strip():
            errors.append(f"{lesson_where}: needs a title")
    if not lessons:
        errors.append(f"{where}: needs at least one NN-lesson.md")
    # A quoted number (`order: "2"`) would otherwise crash the (order, id)
    # sort with no file named, and a non-numeric bonus would pay nothing.
    order = meta.get("order", 0)
    if not _is_int(order):
        errors.append(f"{where}/course.md: order must be an integer")
        order = 0
    course_xp = meta.get("xp", 50)
    if not _is_int(course_xp) or course_xp < 0:
        errors.append(f"{where}/course.md: xp must be a non-negative integer")
        course_xp = 50
    return {
        "id": course_id,
        "title": meta.get("title"),
        "summary": meta.get("summary", ""),
        "level": meta.get("level"),
        "order": order,
        "requires": [str(r) for r in meta.get("requires") or []],
        "skills": [str(s) for s in meta.get("skills") or []],
        "xp": course_xp,
        "intro": intro,
        "lab": _lab(course_dir, errors, root),
        "lessons": lessons,
    }


def load_courses(root: Path = ROOT) -> tuple[list[dict[str, Any]], list[str]]:
    """Every course under root/courses, sorted by (order, id), plus errors."""
    errors: list[str] = []
    base = root / "courses"
    courses: list[dict[str, Any]] = []
    if base.is_dir():
        for course_dir in sorted(p for p in base.iterdir() if p.is_dir()):
            course = load_course(course_dir, errors, root)
            if course:
                courses.append(course)
    courses.sort(key=lambda c: (c["order"], c["id"]))
    ids = {c["id"] for c in courses}
    for course in courses:
        for req in course["requires"]:
            if req not in ids:
                errors.append(f"courses/{course['id']}: requires unknown course '{req}'")
    return courses, errors


def build_bundle(root: Path = ROOT) -> dict[str, Any]:
    courses, errors = load_courses(root)
    if errors:
        raise ValueError("course authoring errors:\n  " + "\n  ".join(errors))
    return {"version": 1, "courses": courses}
