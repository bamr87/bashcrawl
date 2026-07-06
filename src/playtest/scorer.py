"""Score blank-slate playtest logs into pass/fail gate metrics.

Reads the JSONL session logs written by :class:`playtest.recorder.SessionRecorder`
and summarizes how far agents got and where they got stuck. Because the
pure-filesystem game has no quest IDs (that was a TUI concept), progress is
measured by **rooms reached** and **scrolls read** rather than quest number.

Usage::

    PYTHONPATH=src python3 -m playtest.scorer --log-dir logs/sessions/blank_slate \\
        --gate-rooms 3 --gate-scrolls 1
"""

from __future__ import annotations

import argparse
import json
import statistics
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List


def _read_session(path: Path) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def _is_scroll_read(command: str) -> bool:
    parts = (command or "").split()
    if len(parts) < 2 or parts[0] not in {"cat", "less", "head", "tail", "more"}:
        return False
    return any(arg.rsplit("/", 1)[-1] == "scroll" for arg in parts[1:])


def summarize_session(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    rooms = {e["room"] for e in events if e.get("event") == "room_enter" and e.get("room")}
    # A scroll read is (room, scroll-file) — `cat scroll` in three rooms is three
    # scrolls, while `head scroll` + `cat scroll` in one room is still one.
    scrolls = {
        (e.get("room"), arg.rsplit("/", 1)[-1])
        for e in events
        if e.get("event") == "command" and _is_scroll_read(e.get("command", ""))
        for arg in e["command"].split()[1:]
        if arg.rsplit("/", 1)[-1] == "scroll"
    }
    verbs = Counter(
        (e.get("command", "").split() or [""])[0]
        for e in events
        if e.get("event") == "command"
    )
    gaps = [e for e in events if e.get("event") == "content_gap"]
    struggles = [e for e in events if e.get("event") == "struggle"]
    end = next((e for e in reversed(events) if e.get("event") == "session_end"), {})
    return {
        "rooms_visited": len(rooms),
        "scrolls_read": len(scrolls),
        "distinct_commands": len([v for v in verbs if v]),
        "gaps": len(gaps),
        "struggles": len(struggles),
        "gap_details": [
            {
                "room": g.get("room"),
                "reason": g.get("reason"),
                "self_reported": g.get("self_reported", False),
                "attempted": g.get("attempted", []),
            }
            for g in gaps
        ],
        "final_cwd": end.get("final_cwd"),
        "final_inventory": end.get("final_inventory"),
    }


def score(log_dir: Path, gate_rooms: int, gate_scrolls: int) -> Dict[str, Any]:
    sessions = [summarize_session(_read_session(p)) for p in sorted(log_dir.glob("*.jsonl"))]
    if not sessions:
        return {"sessions": [], "passed": False, "reason": "no session logs found"}

    med_rooms = statistics.median(s["rooms_visited"] for s in sessions)
    med_scrolls = statistics.median(s["scrolls_read"] for s in sessions)
    gap_rooms = Counter(
        g["room"] for s in sessions for g in s["gap_details"] if g.get("room")
    )
    passed = med_rooms >= gate_rooms and med_scrolls >= gate_scrolls
    return {
        "sessions": sessions,
        "count": len(sessions),
        "median_rooms": med_rooms,
        "median_scrolls": med_scrolls,
        "total_gaps": sum(s["gaps"] for s in sessions),
        "gap_hotspots": gap_rooms.most_common(10),
        "gate_rooms": gate_rooms,
        "gate_scrolls": gate_scrolls,
        "passed": passed,
    }


def _format(report: Dict[str, Any]) -> str:
    if not report.get("sessions"):
        return f"[scorer] {report.get('reason', 'no data')}"
    lines = [
        f"[scorer] {report['count']} session(s)",
        f"  median rooms visited : {report['median_rooms']}  (gate ≥ {report['gate_rooms']})",
        f"  median scrolls read  : {report['median_scrolls']}  (gate ≥ {report['gate_scrolls']})",
        f"  total content gaps   : {report['total_gaps']}",
    ]
    if report["gap_hotspots"]:
        lines.append("  gap hotspots:")
        for room, n in report["gap_hotspots"]:
            lines.append(f"    {n:>3}  {room}")
    lines.append(f"  RESULT: {'PASS' if report['passed'] else 'FAIL'}")
    return "\n".join(lines)


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log-dir", type=Path, required=True)
    parser.add_argument("--gate-rooms", type=int, default=3)
    parser.add_argument("--gate-scrolls", type=int, default=0)
    parser.add_argument("--json", action="store_true", help="emit the raw report as JSON")
    args = parser.parse_args(argv)

    report = score(args.log_dir, args.gate_rooms, args.gate_scrolls)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(_format(report))
    return 0 if report.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
