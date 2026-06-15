"""JSONL log capture and validation for test sessions.

Provides utilities to:
- Capture JSONL log events during test runs
- Validate log events against the bashcrawl schema
- Tag test-generated logs with metadata
- Copy session logs to the test reports directory
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


# Required fields for every JSONL log event
REQUIRED_FIELDS = {"ts", "sid", "event"}

# Known event types
VALID_EVENTS = {
    "session_start",
    "session_end",
    "room_enter",
    "encounter",
    "death",
    "unlock",
    "help_request",
    "help_action",
    "command",
    "output",
    "screenshot",
    "test",
    "test_result",
    "tutorial_start",
    "launcher_info",
    "launcher_success",
    "launcher_error",
    # Blank-slate playtest instrumentation (ti.playtest.recorder)
    "discovery",
    "struggle",
    "content_gap",
    "quest_complete",
    "feedback",
}


@dataclass
class LogEvent:
    """Parsed JSONL log event."""

    ts: str
    sid: str
    event: str
    extra: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_line(cls, line: str) -> "LogEvent":
        data = json.loads(line.strip())
        return cls(
            ts=data.pop("ts"),
            sid=data.pop("sid"),
            event=data.pop("event"),
            extra=data,
        )

    def to_json(self) -> str:
        d = {"ts": self.ts, "sid": self.sid, "event": self.event, **self.extra}
        return json.dumps(d)


def validate_jsonl_line(line: str) -> tuple[bool, str]:
    """Validate a single JSONL line against the bashcrawl schema.

    Returns (is_valid, error_message).
    """
    try:
        data = json.loads(line.strip())
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}"

    if not isinstance(data, dict):
        return False, f"Expected JSON object, got {type(data).__name__}"

    missing = REQUIRED_FIELDS - set(data.keys())
    if missing:
        return False, f"Missing required fields: {missing}"

    return True, ""


def validate_session_file(path: Path) -> list[tuple[int, str]]:
    """Validate all lines in a JSONL session file.

    Returns list of (line_number, error_message) for invalid lines.
    """
    errors = []
    with open(path) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            valid, msg = validate_jsonl_line(line)
            if not valid:
                errors.append((i, msg))
    return errors


def parse_session_file(path: Path) -> list[LogEvent]:
    """Parse a JSONL session file into LogEvent objects."""
    events = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                events.append(LogEvent.from_line(line))
    return events


class TestLogCapture:
    """Captures and writes JSONL log events for a test session.

    Usage::

        capture = TestLogCapture(log_dir, scenario="full_playthrough")
        capture.start()
        capture.log_event("room_enter", room="entrance")
        capture.log_event("encounter", type="treasure", item="amulet")
        capture.end()
        events = capture.events  # list of LogEvent
    """

    def __init__(
        self,
        log_dir: Path,
        scenario: str = "test",
        test_name: str = "",
        run_id: str = "",
    ) -> None:
        self.log_dir = log_dir
        self.scenario = scenario
        self.test_name = test_name
        self.run_id = run_id
        self.session_id = f"T{int(time.time()) % 100000000:08d}"
        self.events: list[LogEvent] = []
        self._file_path: Path | None = None
        self._start_time: float = 0

    @property
    def file_path(self) -> Path:
        if self._file_path is None:
            datestamp = datetime.now().strftime("%Y-%m-%d")
            self._file_path = self.log_dir / f"{datestamp}_{self.session_id}.jsonl"
        return self._file_path

    def start(self) -> None:
        """Write session_start event."""
        self._start_time = time.time()
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_event(
            "session_start",
            mode="ai_test",
            scenario=self.scenario,
            test_name=self.test_name,
            run_id=self.run_id,
            source="test_framework",
        )

    def end(self, **extra: Any) -> None:
        """Write session_end event with summary metrics."""
        duration = int(time.time() - self._start_time) if self._start_time else 0
        rooms = sum(1 for e in self.events if e.event == "room_enter")
        encounters = sum(1 for e in self.events if e.event == "encounter")
        deaths = sum(1 for e in self.events if e.event == "death")
        help_reqs = sum(1 for e in self.events if e.event == "help_request")
        commands = sum(1 for e in self.events if e.event == "command")
        screenshots = sum(1 for e in self.events if e.event == "screenshot")
        self.log_event(
            "session_end",
            duration_sec=duration,
            rooms_visited=rooms,
            encounters=encounters,
            deaths=deaths,
            help_requests=help_reqs,
            total_commands=commands,
            screenshots_captured=screenshots,
            **extra,
        )

    def log_event(self, event_type: str, **kwargs: Any) -> None:
        """Log a single event."""
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        evt = LogEvent(ts=ts, sid=self.session_id, event=event_type, extra=kwargs)
        self.events.append(evt)
        # Append to file immediately
        with open(self.file_path, "a") as f:
            f.write(evt.to_json() + "\n")

    def log_command(self, command: str, output: str = "", room: str = "") -> None:
        """Log a command execution (convenience wrapper)."""
        extra: dict[str, Any] = {"command": command}
        if output:
            extra["output_preview"] = output[:200]
        if room:
            extra["room"] = room
        self.log_event("command", **extra)

    def log_screenshot(
        self,
        path: str | Path,
        trigger: str = "auto",
        command: str = "",
        room: str = "",
    ) -> None:
        """Log a screenshot capture event.

        Args:
            path: Filesystem path to the saved SVG screenshot.
            trigger: What caused the screenshot — ``"auto"`` (after command),
                ``"explicit"`` (SCREENSHOT meta-command), or ``"initial"``.
            command: The command that triggered the screenshot (if any).
            room: Current game room.
        """
        extra: dict[str, Any] = {
            "screenshot_path": str(path),
            "trigger": trigger,
        }
        if command:
            extra["command"] = command
        if room:
            extra["room"] = room
        # Record file size if it exists
        p = Path(path)
        if p.is_file():
            extra["size_bytes"] = p.stat().st_size
        self.log_event("screenshot", **extra)

    def get_events_by_type(self, event_type: str) -> list[LogEvent]:
        return [e for e in self.events if e.event == event_type]

    def get_rooms_visited(self) -> list[str]:
        return [e.extra.get("room", "") for e in self.events if e.event == "room_enter"]

    def get_items_collected(self) -> list[str]:
        return [
            e.extra.get("item", "")
            for e in self.events
            if e.event == "encounter" and e.extra.get("outcome") == "collected"
        ]

    def log_help_event(
        self,
        subcommand: str = "",
        output_preview: str = "",
        room: str = "",
    ) -> None:
        """Log a help system invocation (convenience wrapper).

        Args:
            subcommand: The help subcommand invoked (e.g. ``"commands"``,
                ``"map"``, ``"tips"``).  Empty string for default help.
            output_preview: First ~200 chars of help output.
            room: Current game room.
        """
        extra: dict[str, Any] = {"subcommand": subcommand or "default"}
        if output_preview:
            extra["output_preview"] = output_preview[:200]
        if room:
            extra["room"] = room
        self.log_event("help_request", **extra)

    def log_test_result(
        self,
        outcome: str,
        duration_sec: float = 0.0,
        markers: list[str] | None = None,
        longrepr: str = "",
    ) -> None:
        """Log the final test outcome (convenience wrapper).

        Args:
            outcome: ``"passed"``, ``"failed"``, ``"error"``, or ``"skipped"``.
            duration_sec: Wall-clock duration of the test.
            markers: List of pytest marker names (e.g. ``["unit"]``).
            longrepr: Failure representation (truncated to 500 chars).
        """
        extra: dict[str, Any] = {"outcome": outcome}
        if duration_sec:
            extra["duration_sec"] = round(duration_sec, 3)
        if markers:
            extra["markers"] = markers
        if longrepr:
            extra["longrepr"] = longrepr[:500]
        self.log_event("test_result", **extra)

    def get_screenshots(self) -> list[dict[str, Any]]:
        """Return all screenshot events with path and metadata."""
        return [
            {
                "path": e.extra.get("screenshot_path", ""),
                "trigger": e.extra.get("trigger", ""),
                "command": e.extra.get("command", ""),
                "room": e.extra.get("room", ""),
                "size_bytes": e.extra.get("size_bytes", 0),
            }
            for e in self.events
            if e.event == "screenshot"
        ]
