"""Screenshot directory and manifest parser."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class Screenshot:
    """A single screenshot SVG file."""
    name: str
    path: str
    trigger: str = ""
    command: str = ""
    room: str = ""
    ts: str = ""
    size_bytes: int = 0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "path": self.path,
            "trigger": self.trigger,
            "command": self.command,
            "room": self.room,
            "ts": self.ts,
            "size_bytes": self.size_bytes,
        }


@dataclass
class ScreenshotSession:
    """A directory of screenshots from a single test/session run."""
    dir_name: str
    dir_path: Path
    test_name: str = ""
    timestamp: str = ""
    total_screenshots: int = 0
    total_size_bytes: int = 0
    screenshots: list[Screenshot] = field(default_factory=list)
    has_manifest: bool = False
    linked_session_sids: list[str] = field(default_factory=list)

    def to_summary(self) -> dict:
        return {
            "dir_name": self.dir_name,
            "test_name": self.test_name,
            "timestamp": self.timestamp,
            "total_screenshots": self.total_screenshots,
            "total_size_bytes": self.total_size_bytes,
            "has_manifest": self.has_manifest,
            "linked_session_sids": self.linked_session_sids,
            "first_screenshot": self.screenshots[0].name if self.screenshots else None,
        }

    def to_detail(self) -> dict:
        d = self.to_summary()
        d["screenshots"] = [s.to_dict() for s in self.screenshots]
        return d


def _parse_screenshot_dir(dir_path: Path) -> ScreenshotSession | None:
    """Parse a screenshot directory, preferring manifest.json if available."""
    dir_name = dir_path.name
    # Parse name: "2026-02-21_095855_full_critical_path"
    parts = dir_name.split("_", 2)
    timestamp = ""
    test_name = dir_name
    if len(parts) >= 3:
        timestamp = f"{parts[0]} {parts[1][:2]}:{parts[1][2:4]}:{parts[1][4:]}"
        test_name = parts[2]
    elif len(parts) == 2:
        timestamp = parts[0]
        test_name = parts[1]

    session = ScreenshotSession(
        dir_name=dir_name,
        dir_path=dir_path,
        test_name=test_name,
        timestamp=timestamp,
    )

    manifest_path = dir_path / "manifest.json"
    if manifest_path.is_file():
        session.has_manifest = True
        try:
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
            session.total_screenshots = manifest.get("total_screenshots", 0)
            session.total_size_bytes = manifest.get("total_size_bytes", 0)
            for s in manifest.get("screenshots", []):
                ss = Screenshot(
                    name=s.get("name", ""),
                    path=s.get("path", ""),
                    trigger=s.get("trigger", ""),
                    command=s.get("command", ""),
                    room=s.get("room", ""),
                    ts=s.get("ts", ""),
                    size_bytes=s.get("size_bytes", 0),
                )
                session.screenshots.append(ss)
        except (json.JSONDecodeError, OSError):
            pass

    # If no manifest or empty, scan directory for SVGs
    if not session.screenshots:
        svg_files = sorted(dir_path.glob("*.svg"))
        total_size = 0
        for svg in svg_files:
            size = svg.stat().st_size
            total_size += size
            session.screenshots.append(Screenshot(
                name=svg.name,
                path=str(svg),
                size_bytes=size,
            ))
        session.total_screenshots = len(session.screenshots)
        session.total_size_bytes = total_size

    return session if session.screenshots else None


class ScreenshotStore:
    """In-memory index of all screenshot sessions."""

    def __init__(self, screenshots_dir: Path):
        self.screenshots_dir = screenshots_dir
        self.sessions: dict[str, ScreenshotSession] = {}

    def load_all(self) -> None:
        """Parse all screenshot directories."""
        if not self.screenshots_dir.is_dir():
            return
        for child in sorted(self.screenshots_dir.iterdir()):
            if child.is_dir() and not child.name.startswith("."):
                ss = _parse_screenshot_dir(child)
                if ss:
                    self.sessions[ss.dir_name] = ss

    def cross_reference(self, session_store: Any) -> None:
        """Link screenshot sessions to JSONL session SIDs."""
        # Build reverse index: screenshot_path → screenshot_session dir_name
        for sid, session in session_store.sessions.items():
            for sc_event in session.screenshots:
                sc_path = sc_event.get("path", "")
                for dir_name, sc_session in self.sessions.items():
                    if dir_name in sc_path:
                        if sid not in sc_session.linked_session_sids:
                            sc_session.linked_session_sids.append(sid)
                        break

    def get(self, dir_name: str) -> ScreenshotSession | None:
        return self.sessions.get(dir_name)

    def list_sessions(
        self,
        test_name: str | None = None,
        sort_by: str = "date",
        order: str = "desc",
        page: int = 1,
        per_page: int = 25,
    ) -> tuple[list[ScreenshotSession], int]:
        """Return filtered, sorted, paginated screenshot sessions."""
        results = list(self.sessions.values())

        if test_name:
            q = test_name.lower()
            results = [s for s in results if q in s.test_name.lower()]

        total = len(results)

        reverse = order == "desc"
        if sort_by == "date":
            results.sort(key=lambda s: s.dir_name, reverse=reverse)
        elif sort_by == "count":
            results.sort(key=lambda s: s.total_screenshots, reverse=reverse)
        elif sort_by == "size":
            results.sort(key=lambda s: s.total_size_bytes, reverse=reverse)

        start = (page - 1) * per_page
        end = start + per_page
        return results[start:end], total

    def find_by_session_sid(self, sid: str) -> list[ScreenshotSession]:
        """Find screenshot sessions linked to a JSONL session SID."""
        return [s for s in self.sessions.values() if sid in s.linked_session_sids]
