"""Markdown feedback report loader."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path


@dataclass
class FeedbackReport:
    """A parsed Markdown feedback report."""
    file_path: Path
    session_sid: str
    file_date: date
    content_md: str = ""
    title: str = ""
    mode: str = ""
    duration: str = ""
    metrics: dict = field(default_factory=dict)

    def to_summary(self) -> dict:
        return {
            "session_sid": self.session_sid,
            "date": self.file_date.isoformat(),
            "mode": self.mode,
            "duration": self.duration,
            "metrics": self.metrics,
        }

    def to_detail(self) -> dict:
        d = self.to_summary()
        d["content_md"] = self.content_md
        return d


def _parse_feedback_file(file_path: Path) -> FeedbackReport | None:
    """Parse a feedback Markdown file."""
    name = file_path.stem  # e.g. "2026-02-16_71266674"
    parts = name.split("_", 1)
    if len(parts) != 2:
        return None

    try:
        file_date = datetime.strptime(parts[0], "%Y-%m-%d").date()
    except ValueError:
        return None

    sid = parts[1]

    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    report = FeedbackReport(
        file_path=file_path,
        session_sid=sid,
        file_date=file_date,
        content_md=content,
    )

    # Extract metadata from Markdown
    mode_match = re.search(r"\*\*Mode:\*\*\s*(.+)", content)
    if mode_match:
        report.mode = mode_match.group(1).strip()

    duration_match = re.search(r"\*\*Duration:\*\*\s*(.+)", content)
    if duration_match:
        report.duration = duration_match.group(1).strip()

    # Parse metrics table
    metrics = {}
    table_pattern = re.findall(r"\|\s*(.+?)\s*\|\s*(\d+)\s*\|", content)
    for label, value in table_pattern:
        label = label.strip()
        if label and label != "Metric" and label != "---":
            metrics[label] = int(value)
    report.metrics = metrics

    return report


class FeedbackStore:
    """In-memory store of feedback reports."""

    def __init__(self, feedback_dir: Path):
        self.feedback_dir = feedback_dir
        self.reports: dict[str, FeedbackReport] = {}

    def load_all(self) -> None:
        """Parse all feedback Markdown files."""
        if not self.feedback_dir.is_dir():
            return
        for md_file in sorted(self.feedback_dir.glob("*.md")):
            report = _parse_feedback_file(md_file)
            if report:
                self.reports[report.session_sid] = report

    def get(self, sid: str) -> FeedbackReport | None:
        return self.reports.get(sid)

    def list_reports(self) -> list[FeedbackReport]:
        return sorted(self.reports.values(),
                      key=lambda r: r.file_date, reverse=True)
