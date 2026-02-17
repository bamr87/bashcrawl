"""Session comparison tool.

Compares an AI test session against a golden session to identify:
- Missing events (actions the golden session has but test doesn't)
- Unexpected events (actions the test has but golden doesn't)
- Ordering differences
- Coverage gaps
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def load_events(path: Path) -> list[dict[str, Any]]:
    """Load events from a JSONL file."""
    events = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return events


def extract_event_signature(event: dict[str, Any]) -> str:
    """Create a comparable signature for an event."""
    event_type = event.get("event", "")
    room = event.get("room", "")
    item = event.get("item", "")
    etype = event.get("type", "")
    parts = [event_type]
    if room:
        parts.append(f"room={room}")
    if etype:
        parts.append(f"type={etype}")
    if item:
        parts.append(f"item={item}")
    return "|".join(parts)


def compare_sessions(
    test_path: Path,
    golden_path: Path,
) -> dict[str, Any]:
    """Compare a test session against a golden session.

    Returns a comparison report.
    """
    test_events = load_events(test_path)
    golden_events = load_events(golden_path)

    # Extract event signatures
    test_sigs = [extract_event_signature(e) for e in test_events]
    golden_sigs = [extract_event_signature(e) for e in golden_events]

    test_sig_set = set(test_sigs)
    golden_sig_set = set(golden_sigs)

    missing = golden_sig_set - test_sig_set
    unexpected = test_sig_set - golden_sig_set
    common = golden_sig_set & test_sig_set

    # Extract room sequences
    test_rooms = [
        e.get("room", "") for e in test_events
        if e.get("event") == "room_enter"
    ]
    golden_rooms = [
        e.get("room", "") for e in golden_events
        if e.get("event") == "room_enter"
    ]

    # Event type distribution
    test_types = {}
    for e in test_events:
        t = e.get("event", "unknown")
        test_types[t] = test_types.get(t, 0) + 1

    golden_types = {}
    for e in golden_events:
        t = e.get("event", "unknown")
        golden_types[t] = golden_types.get(t, 0) + 1

    return {
        "test_file": str(test_path),
        "golden_file": str(golden_path),
        "test_events": len(test_events),
        "golden_events": len(golden_events),
        "similarity": round(len(common) / max(len(golden_sig_set), 1) * 100, 1),
        "missing_from_test": sorted(missing),
        "unexpected_in_test": sorted(unexpected),
        "common_events": len(common),
        "room_sequences": {
            "test": test_rooms,
            "golden": golden_rooms,
        },
        "event_distributions": {
            "test": test_types,
            "golden": golden_types,
        },
    }


def generate_diff_report(comparison: dict[str, Any]) -> str:
    """Generate a Markdown diff report."""
    lines = [
        "# Session Comparison Report",
        "",
        f"**Test session:** {comparison['test_file']}",
        f"**Golden session:** {comparison['golden_file']}",
        f"**Similarity:** {comparison['similarity']}%",
        "",
        f"| Metric | Test | Golden |",
        f"|--------|------|--------|",
        f"| Total events | {comparison['test_events']} | {comparison['golden_events']} |",
        f"| Common events | {comparison['common_events']} | — |",
        "",
        "## Missing from Test",
        "",
    ]
    for sig in comparison["missing_from_test"]:
        lines.append(f"- `{sig}`")

    lines.extend([
        "",
        "## Unexpected in Test",
        "",
    ])
    for sig in comparison["unexpected_in_test"]:
        lines.append(f"- `{sig}`")

    lines.extend([
        "",
        "## Room Sequences",
        "",
        f"**Test:** {' → '.join(comparison['room_sequences']['test'][:20])}",
        f"**Golden:** {' → '.join(comparison['room_sequences']['golden'][:20])}",
    ])

    return "\n".join(lines)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Compare test session vs golden session")
    parser.add_argument("test_session", help="Path to test session JSONL")
    parser.add_argument("golden_session", help="Path to golden session JSONL")
    parser.add_argument("-o", "--output", help="Output Markdown file")
    args = parser.parse_args()

    comparison = compare_sessions(Path(args.test_session), Path(args.golden_session))
    report = generate_diff_report(comparison)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(report)
        print(f"Comparison report: {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
