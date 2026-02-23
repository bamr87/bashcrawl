"""JSONL session log parser and in-memory store."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, date
from pathlib import Path
from typing import Any


@dataclass
class LogEvent:
    """A single event from a JSONL session file."""
    ts: str
    sid: str
    event: str
    extra: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_line(cls, line: str) -> LogEvent | None:
        """Parse a single JSONL line into a LogEvent."""
        line = line.strip()
        if not line:
            return None
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            return None
        ts = data.pop("ts", "")
        sid = data.pop("sid", "")
        event = data.pop("event", "")
        return cls(ts=ts, sid=sid, event=event, extra=data)

    def to_dict(self) -> dict:
        """Serialize to a JSON-friendly dict."""
        d = {"ts": self.ts, "sid": self.sid, "event": self.event}
        d.update(self.extra)
        return d


@dataclass
class Session:
    """Parsed representation of a single JSONL session file."""
    sid: str
    file_path: Path
    file_date: date
    mode: str = ""
    events: list[LogEvent] = field(default_factory=list)
    start_time: str = ""
    end_time: str = ""
    duration_sec: int | None = None
    rooms_visited: list[str] = field(default_factory=list)
    encounters: list[dict] = field(default_factory=list)
    deaths: list[dict] = field(default_factory=list)
    items_collected: list[str] = field(default_factory=list)
    screenshots: list[dict] = field(default_factory=list)
    is_test: bool = False
    shell: str = ""
    os_name: str = ""
    event_count: int = 0
    rooms_count: int = 0
    encounters_count: int = 0
    deaths_count: int = 0
    screenshots_count: int = 0

    def to_summary(self) -> dict:
        """Return a summary dict for list views."""
        return {
            "sid": self.sid,
            "date": self.file_date.isoformat(),
            "mode": self.mode,
            "start_time": self.start_time,
            "duration_sec": self.duration_sec,
            "event_count": self.event_count,
            "rooms_count": self.rooms_count,
            "encounters_count": self.encounters_count,
            "deaths_count": self.deaths_count,
            "screenshots_count": self.screenshots_count,
            "items": self.items_collected,
            "is_test": self.is_test,
            "rooms": self.rooms_visited,
        }

    def to_detail(self) -> dict:
        """Return full detail dict."""
        d = self.to_summary()
        d["shell"] = self.shell
        d["os_name"] = self.os_name
        d["end_time"] = self.end_time
        d["encounters"] = self.encounters
        d["deaths"] = self.deaths
        d["screenshots"] = self.screenshots
        d["events"] = [e.to_dict() for e in self.events]
        return d


def _parse_session_file(file_path: Path) -> Session | None:
    """Parse a single JSONL session file into a Session object."""
    name = file_path.stem  # e.g. "2026-02-16_71266674" or "2026-02-21_T71701918"
    parts = name.split("_", 1)
    if len(parts) != 2:
        return None

    try:
        file_date = datetime.strptime(parts[0], "%Y-%m-%d").date()
    except ValueError:
        return None

    sid = parts[1]
    is_test = sid.startswith("T")

    events: list[LogEvent] = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                ev = LogEvent.from_line(line)
                if ev:
                    events.append(ev)
    except OSError:
        return None

    if not events:
        return None

    session = Session(
        sid=sid,
        file_path=file_path,
        file_date=file_date,
        events=events,
        is_test=is_test,
        event_count=len(events),
    )

    # Extract metadata from events
    rooms = []
    encounters = []
    deaths = []
    items = []
    screenshots = []

    for ev in events:
        if ev.event == "session_start":
            session.mode = ev.extra.get("mode", "")
            session.shell = ev.extra.get("shell", "")
            session.os_name = ev.extra.get("os", "")
            session.start_time = ev.ts
        elif ev.event == "session_end":
            session.end_time = ev.ts
            session.duration_sec = ev.extra.get("duration_sec")
        elif ev.event == "room_enter":
            room = ev.extra.get("room", "")
            if room and room not in rooms:
                rooms.append(room)
        elif ev.event == "command":
            room = ev.extra.get("room", "")
            if room and room not in rooms:
                rooms.append(room)
        elif ev.event == "encounter":
            enc = {
                "type": ev.extra.get("type", ""),
                "outcome": ev.extra.get("outcome", ""),
                "item": ev.extra.get("item", ""),
                "ts": ev.ts,
            }
            encounters.append(enc)
            if enc["item"]:
                items.append(enc["item"])
        elif ev.event == "death":
            deaths.append({
                "type": ev.extra.get("type", ""),
                "cause": ev.extra.get("cause", ""),
                "ts": ev.ts,
            })
        elif ev.event == "screenshot":
            screenshots.append({
                "path": ev.extra.get("screenshot_path", ""),
                "trigger": ev.extra.get("trigger", ""),
                "command": ev.extra.get("command", ""),
                "size_bytes": ev.extra.get("size_bytes", 0),
                "ts": ev.ts,
            })

    if not session.start_time and events:
        session.start_time = events[0].ts

    session.rooms_visited = rooms
    session.rooms_count = len(rooms)
    session.encounters = encounters
    session.encounters_count = len(encounters)
    session.deaths = deaths
    session.deaths_count = len(deaths)
    session.items_collected = items
    session.screenshots = screenshots
    session.screenshots_count = len(screenshots)

    return session


class SessionStore:
    """In-memory cache of all parsed sessions."""

    def __init__(self, sessions_dir: Path):
        self.sessions_dir = sessions_dir
        self.sessions: dict[str, Session] = {}

    def load_all(self) -> None:
        """Parse all JSONL files in the sessions directory."""
        if not self.sessions_dir.is_dir():
            return
        for jsonl_file in sorted(self.sessions_dir.glob("*.jsonl")):
            session = _parse_session_file(jsonl_file)
            if session:
                self.sessions[session.sid] = session

    def get(self, sid: str) -> Session | None:
        """Get a session by SID."""
        return self.sessions.get(sid)

    def list_sessions(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
        mode: str | None = None,
        has_screenshots: bool | None = None,
        min_events: int | None = None,
        sort_by: str = "date",
        order: str = "desc",
        page: int = 1,
        per_page: int = 25,
    ) -> tuple[list[Session], int]:
        """Return filtered, sorted, paginated list of sessions plus total count."""
        results = list(self.sessions.values())

        # Filter
        if date_from:
            results = [s for s in results if s.file_date >= date_from]
        if date_to:
            results = [s for s in results if s.file_date <= date_to]
        if mode:
            results = [s for s in results if s.mode == mode]
        if has_screenshots is True:
            results = [s for s in results if s.screenshots_count > 0]
        elif has_screenshots is False:
            results = [s for s in results if s.screenshots_count == 0]
        if min_events and min_events > 0:
            results = [s for s in results if s.event_count >= min_events]

        total = len(results)

        # Sort
        reverse = order == "desc"
        if sort_by == "date":
            results.sort(key=lambda s: (s.file_date, s.start_time), reverse=reverse)
        elif sort_by == "duration":
            results.sort(key=lambda s: s.duration_sec or 0, reverse=reverse)
        elif sort_by == "events":
            results.sort(key=lambda s: s.event_count, reverse=reverse)
        elif sort_by == "rooms":
            results.sort(key=lambda s: s.rooms_count, reverse=reverse)

        # Paginate
        start = (page - 1) * per_page
        end = start + per_page
        return results[start:end], total

    def get_modes(self) -> list[str]:
        """Return unique modes across all sessions."""
        modes = set()
        for s in self.sessions.values():
            if s.mode:
                modes.add(s.mode)
        return sorted(modes)

    def get_all_sessions(self) -> list[Session]:
        """Return all sessions sorted by date desc."""
        return sorted(self.sessions.values(),
                      key=lambda s: (s.file_date, s.start_time), reverse=True)

    def refresh(self) -> int:
        """Re-scan for new files. Returns count of new sessions loaded."""
        if not self.sessions_dir.is_dir():
            return 0
        new_count = 0
        for jsonl_file in self.sessions_dir.glob("*.jsonl"):
            sid = jsonl_file.stem.split("_", 1)[1] if "_" in jsonl_file.stem else jsonl_file.stem
            if sid not in self.sessions:
                session = _parse_session_file(jsonl_file)
                if session:
                    self.sessions[session.sid] = session
                    new_count += 1
        return new_count
