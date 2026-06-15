"""Score a blank-slate playtest session and report content gaps.

Consumes a session JSONL produced by the MCP server (live Claude-Code run) or
the scripted runner (:func:`ti.playtest.runner.run_session`) and measures how
far a no-knowledge agent got using only the game's own content. The headline
number is a **self-teaching completeness %**; the actionable output is a ranked
list of **content gaps** — each tied to the room/quest where the agent stalled,
the command the walkthrough expected there, and what that room's scroll is
supposed to teach.

Run::

    python -m analysis.blank_slate_report logs/sessions/blank_slate/*.jsonl --out report.md

The companion LLM diagnosis (asking Claude whether a scroll is sufficient) lives
behind ``--llm`` and reuses the ``analysis.generate_review`` Anthropic path; it
is off by default so this module stays deterministic and API-free.
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Any, Dict, List, Optional

# Weights for the headline self-teaching score (quests dominate — they are the
# real "did the agent make progress" signal; coverage rounds it out).
_WEIGHTS = {"quests": 0.5, "scrolls": 0.25, "rooms": 0.15, "scripts": 0.1}
_SCROLL_VERBS = {"cat", "less", "head", "tail", "more"}

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_WALKTHROUGH = _REPO_ROOT / "test" / "datasets" / "walkthrough.json"


# -- parsing / normalization (kept local so the module is import-path robust) --
def parse_session(path: Path) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events


def normalize_room(room: str) -> str:
    """Map an in-game room path to its walkthrough key form (hidden-dot form)."""
    room = (room or "").strip("/")
    room = room.replace("chapel/", ".chapel/").replace("vault/", ".vault/")
    room = room.replace("rift/", ".rift/").replace("scrap/", ".scrap/")
    # A bare unlocked room name at the tail (e.g. ".../chapel") too.
    for name in ("chapel", "vault", "rift", "scrap"):
        if room.endswith("/" + name):
            room = room[: -len(name)] + "." + name
    if not room.startswith("entrance"):
        room = f"entrance/{room}" if room else "entrance"
    return room


def load_walkthrough(path: Optional[Path] = None) -> Dict[str, Any]:
    with open(path or _DEFAULT_WALKTHROUGH, encoding="utf-8") as fh:
        return json.load(fh)


def _norm_rooms(walkthrough: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {normalize_room(p): data for p, data in walkthrough.get("rooms", {}).items()}


def _command_verb(command: str) -> str:
    command = (command or "").strip()
    return command.split()[0] if command else ""


def score_session(events: List[Dict[str, Any]], walkthrough: Dict[str, Any]) -> Dict[str, Any]:
    """Compute completeness, struggle, and ranked gaps for one session."""
    rooms = _norm_rooms(walkthrough)
    quests = walkthrough.get("quests", [])
    quest_total = len(quests)
    quest_cmd = {q["id"]: q.get("command") for q in quests}

    scroll_rooms = {r for r, d in rooms.items() if d.get("scroll")}
    script_total = sum(len(d.get("scripts") or []) for d in rooms.values())

    quests_done = sorted({e["quest_id"] for e in events if e.get("event") == "quest_complete"})
    rooms_visited = {
        normalize_room(e.get("room", "")) for e in events if e.get("event") == "room_enter"
    }
    rooms_visited.discard("")

    scrolls_read: set[str] = set()
    scripts_run: set[str] = set()
    for e in events:
        if e.get("event") != "command":
            continue
        cmd = (e.get("command") or "").strip()
        verb = _command_verb(cmd)
        room = normalize_room(e.get("room", ""))
        if verb in _SCROLL_VERBS and "scroll" in cmd:
            scrolls_read.add(room)
        if cmd.startswith("./"):
            scripts_run.add(cmd[2:].split()[0])

    struggles = [e for e in events if e.get("event") == "struggle"]
    by_room: Dict[str, int] = {}
    for e in struggles:
        sroom = normalize_room(e.get("room", ""))
        by_room[sroom] = by_room.get(sroom, 0) + 1

    def pct(num: int, den: int) -> float:
        return round(100.0 * num / den, 1) if den else 0.0

    completeness = {
        "quests": {
            "done": quests_done,
            "total": quest_total,
            "furthest": (max(quests_done) + 1) if quests_done else 0,
            "pct": pct(len(quests_done), quest_total),
        },
        "scrolls": {
            "read": len(scrolls_read & scroll_rooms),
            "total": len(scroll_rooms),
            "pct": pct(len(scrolls_read & scroll_rooms), len(scroll_rooms)),
        },
        "rooms": {
            "visited": len(rooms_visited & set(rooms)),
            "total": len(rooms),
            "pct": pct(len(rooms_visited & set(rooms)), len(rooms)),
        },
        "scripts": {
            "run": len(scripts_run),
            "total": script_total,
            "pct": pct(len(scripts_run), script_total),
        },
    }
    self_teaching = round(
        sum(_WEIGHTS[k] * completeness[k]["pct"] for k in _WEIGHTS), 1
    )

    gaps = _rank_gaps(events, rooms, quest_cmd)

    return {
        "session_id": _session_id(events),
        "self_teaching_pct": self_teaching,
        "completeness": completeness,
        "struggle": {"total": len(struggles), "by_room": by_room},
        "gaps": gaps,
    }


def _rank_gaps(
    events: List[Dict[str, Any]],
    rooms: Dict[str, Dict[str, Any]],
    quest_cmd: Dict[int, Any],
) -> List[Dict[str, Any]]:
    """Turn content_gap events into actionable, severity-ranked findings."""
    # Index of "did the agent make progress after position i" for blocked detection.
    progressed_after = [False] * (len(events) + 1)
    seen = False
    for i in range(len(events) - 1, -1, -1):
        if events[i].get("event") in ("quest_complete", "discovery"):
            seen = True
        progressed_after[i] = seen

    severity_rank = {"blocked": 0, "high": 1, "reported": 2}
    gaps: List[Dict[str, Any]] = []
    for i, e in enumerate(events):
        if e.get("event") != "content_gap":
            continue
        room = normalize_room(e.get("room", ""))
        qid = e.get("quest_id")
        recovered = progressed_after[i + 1] if i + 1 < len(progressed_after) else False
        if not recovered:
            severity = "blocked"
        elif e.get("self_reported"):
            severity = "reported"
        else:
            severity = "high"
        room_meta = rooms.get(room, {})
        gaps.append({
            "room": room,
            "quest_id": qid,
            "expected_command": quest_cmd.get(qid),
            "scroll_teaches": room_meta.get("scroll_teaches", []),
            "has_scroll": bool(room_meta.get("scroll")),
            "reason": e.get("reason"),
            "self_reported": bool(e.get("self_reported")),
            "attempted": e.get("attempted", []),
            "severity": severity,
        })
    gaps.sort(key=lambda g: (severity_rank.get(g["severity"], 9), str(g["room"])))
    return gaps


def _session_id(events: List[Dict[str, Any]]) -> str:
    for e in events:
        if e.get("sid"):
            return e["sid"]
    return "unknown"


def aggregate(scores: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Median completeness + de-duplicated union of gaps across N seeded runs."""
    if not scores:
        return {"runs": 0}
    pcts = [s["self_teaching_pct"] for s in scores]
    seen: Dict[tuple, Dict[str, Any]] = {}
    for s in scores:
        for g in s["gaps"]:
            key = (g["room"], g["quest_id"])
            if key not in seen or _sev(g) < _sev(seen[key]):
                seen[key] = g
    return {
        "runs": len(scores),
        "self_teaching_pct_median": round(statistics.median(pcts), 1),
        "self_teaching_pct_min": min(pcts),
        "self_teaching_pct_max": max(pcts),
        "furthest_quest_median": round(
            statistics.median(s["completeness"]["quests"]["furthest"] for s in scores)
        ),
        "gaps": sorted(seen.values(), key=lambda g: (_sev(g), str(g["room"]))),
    }


def _sev(gap: Dict[str, Any]) -> int:
    return {"blocked": 0, "high": 1, "reported": 2}.get(gap.get("severity"), 9)


def generate_markdown(score: Dict[str, Any]) -> str:
    c = score["completeness"]
    q, sc, rm, scr = c["quests"], c["scrolls"], c["rooms"], c["scripts"]
    lines = [
        f"# Blank-Slate Playtest Report — `{score['session_id']}`",
        "",
        f"**Self-teaching completeness: {score['self_teaching_pct']}%**",
        "",
        "| Track | Progress |",
        "|---|---|",
        f"| Quests | {len(q['done'])}/{q['total']} "
        f"(furthest: quest {q['furthest']}) — {q['pct']}% |",
        f"| Scrolls read | {sc['read']}/{sc['total']} — {sc['pct']}% |",
        f"| Rooms visited | {rm['visited']}/{rm['total']} — {rm['pct']}% |",
        f"| Scripts run | {scr['run']}/{scr['total']} — {scr['pct']}% |",
        "",
        f"Struggles: {score['struggle']['total']} total.",
        "",
        "## Content gaps",
        "",
    ]
    if not score["gaps"]:
        lines.append("_None detected — the agent was never stuck._")
    else:
        for g in score["gaps"]:
            tag = {"blocked": "🚫 BLOCKED", "high": "⚠️ high", "reported": "🔎 reported"}.get(
                g["severity"], g["severity"]
            )
            teaches = ", ".join(g["scroll_teaches"]) or "(no scroll)"
            lines.append(
                f"- **{tag}** in `{g['room']}` (quest {g['quest_id']}). "
                f"Expected `{g['expected_command']}`; the scroll here teaches: {teaches}. "
                f"Reason: {g['reason']}. Tried: {', '.join(g['attempted'][-4:]) or '—'}"
            )
    lines.append("")
    return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Score blank-slate playtest sessions.")
    parser.add_argument("sessions", nargs="+", help="Session JSONL file(s) or a directory.")
    parser.add_argument("--walkthrough", type=Path, default=None)
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of Markdown.")
    parser.add_argument("--out", type=Path, default=None, help="Write the report to this file.")
    args = parser.parse_args(argv)

    files: List[Path] = []
    for s in args.sessions:
        p = Path(s)
        if p.is_dir():
            files.extend(sorted(p.glob("*.jsonl")))
        else:
            files.append(p)
    if not files:
        parser.error("no session files found")

    wt = load_walkthrough(args.walkthrough)
    scores = [score_session(parse_session(f), wt) for f in files]
    payload: Dict[str, Any] = {"sessions": scores}
    if len(scores) > 1:
        payload["aggregate"] = aggregate(scores)

    if args.json:
        text = json.dumps(payload, indent=2)
    else:
        text = "\n\n---\n\n".join(generate_markdown(s) for s in scores)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
