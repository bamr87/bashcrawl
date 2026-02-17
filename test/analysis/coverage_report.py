"""Game coverage report generator.

Analyzes AI test session logs to compute game coverage metrics:
- Percentage of rooms visited
- Percentage of scripts executed
- Percentage of quests completed
- Percentage of scrolls read
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

# Add project paths
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "src" / "terminal-illness"))


# Known game rooms (complete room graph)
ALL_ROOMS = [
    "entrance",
    "entrance/cellar",
    "entrance/cellar/armoury",
    "entrance/cellar/armoury/chamber",
    "entrance/workshop",
    "entrance/.chapel",
    "entrance/.chapel/courtyard",
    "entrance/.chapel/courtyard/aviary",
    "entrance/.chapel/courtyard/aviary/hall",
    "entrance/.chapel/courtyard/aviary/hall/library",
    "entrance/.chapel/graveyard",
    "entrance/.chapel/graveyard/.mausoleum",
    "entrance/.chapel/graveyard/columbarium",
    "entrance/.chapel/graveyard/lower-quadrant",
    "entrance/.chapel/graveyard/royal-tombs",
    "entrance/.vault",
    "entrance/.vault/stronghold",
    "entrance/.vault/stronghold/nursery",
    "entrance/.vault/stronghold/nursery/lab",
    "entrance/.scrap",
    "entrance/.rift",
    "entrance/.rift/arena",
    "entrance/.rift/arena/pit",
    "entrance/.rift/spire",
    "entrance/.rift/spire/mezzanine",
]

# All executable game scripts
ALL_SCRIPTS = [
    "entrance/cellar/treasure",
    "entrance/cellar/armoury/treasure",
    "entrance/cellar/armoury/potion",
    "entrance/cellar/armoury/chamber/treasure",
    "entrance/cellar/armoury/chamber/statue",
    "entrance/cellar/armoury/chamber/spell",
    "entrance/.chapel/courtyard/aviary/hall/monster",
    "entrance/.chapel/graveyard/.mausoleum/spell",
    "entrance/.vault/stronghold/goblet",
    "entrance/.vault/stronghold/nursery/spell",
    "entrance/.vault/stronghold/nursery/lab/ghost",
    "entrance/.rift/arena/pit/treasure",
]

# All scroll files
ALL_SCROLLS = [
    "entrance/scroll",
    "entrance/cellar/scroll",
    "entrance/cellar/armoury/scroll",
    "entrance/cellar/armoury/chamber/scroll",
    "entrance/workshop/scroll",
    "entrance/.chapel/scroll",
    "entrance/.chapel/courtyard/scroll",
    "entrance/.chapel/courtyard/aviary/scroll",
    "entrance/.chapel/courtyard/aviary/hall/scroll",
    "entrance/.chapel/courtyard/aviary/hall/library/scroll",
    "entrance/.chapel/graveyard/scroll",
    "entrance/.chapel/graveyard/.mausoleum/scroll",
    "entrance/.chapel/graveyard/columbarium/scroll",
    "entrance/.chapel/graveyard/lower-quadrant/scroll",
    "entrance/.chapel/graveyard/royal-tombs/scroll",
    "entrance/.vault/scroll",
    "entrance/.vault/stronghold/scroll",
    "entrance/.vault/stronghold/nursery/scroll",
    "entrance/.vault/stronghold/nursery/lab/scroll",
    "entrance/.scrap/scroll",
    "entrance/.rift/scroll",
    "entrance/.rift/arena/scroll",
    "entrance/.rift/arena/pit/scroll",
    "entrance/.rift/spire/scroll",
    "entrance/.rift/spire/mezzanine/scroll",
]

TOTAL_QUESTS = 7


def parse_session(path: Path) -> list[dict[str, Any]]:
    """Parse a JSONL session file."""
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


def normalize_room(room: str) -> str:
    """Normalize room path for comparison."""
    room = room.strip("/")
    # Handle both hidden and unlocked names
    room = room.replace("chapel/", ".chapel/").replace("vault/", ".vault/")
    room = room.replace("rift/", ".rift/").replace("scrap/", ".scrap/")
    if not room.startswith("entrance"):
        room = f"entrance/{room}" if room else "entrance"
    return room


def compute_coverage(session_files: list[Path]) -> dict[str, Any]:
    """Compute game coverage from session JSONL files.

    Returns coverage report dict.
    """
    rooms_visited: set[str] = set()
    scripts_run: set[str] = set()
    scrolls_read: set[str] = set()
    commands_used: Counter = Counter()
    total_turns = 0
    total_sessions = len(session_files)
    quest_completions = 0

    for path in session_files:
        events = parse_session(path)
        for evt in events:
            event_type = evt.get("event", "")

            if event_type == "room_enter":
                room = evt.get("room", "")
                if room:
                    rooms_visited.add(normalize_room(room))

            elif event_type == "command":
                cmd = evt.get("command", "")
                if cmd:
                    base = cmd.split()[0]
                    commands_used[base] += 1
                    total_turns += 1

                    # Track scroll reads
                    if cmd.startswith("cat") and "scroll" in cmd:
                        room = evt.get("room", "")
                        if room:
                            scrolls_read.add(normalize_room(room))

                    # Track script executions
                    if cmd.startswith("./"):
                        room = evt.get("room", "")
                        script = cmd[2:]
                        if room:
                            scripts_run.add(f"{normalize_room(room)}/{script}")

            elif event_type == "encounter":
                enc_type = evt.get("type", "")
                room = evt.get("room", "")
                if room and enc_type:
                    scripts_run.add(f"{normalize_room(room)}/{enc_type}")

            elif event_type == "quest_complete":
                quest_completions += 1

    # Compute percentages
    room_coverage = len(rooms_visited & set(ALL_ROOMS)) / len(ALL_ROOMS) * 100
    script_coverage = len(scripts_run & set(ALL_SCRIPTS)) / len(ALL_SCRIPTS) * 100
    scroll_coverage = len(scrolls_read) / len(ALL_SCROLLS) * 100
    quest_coverage = min(quest_completions, TOTAL_QUESTS) / TOTAL_QUESTS * 100

    return {
        "timestamp": datetime.now().isoformat(),
        "total_sessions": total_sessions,
        "total_turns": total_turns,
        "coverage": {
            "rooms": {
                "visited": sorted(rooms_visited),
                "total": len(ALL_ROOMS),
                "covered": len(rooms_visited & set(ALL_ROOMS)),
                "percentage": round(room_coverage, 1),
            },
            "scripts": {
                "executed": sorted(scripts_run),
                "total": len(ALL_SCRIPTS),
                "covered": len(scripts_run & set(ALL_SCRIPTS)),
                "percentage": round(script_coverage, 1),
            },
            "scrolls": {
                "read": sorted(scrolls_read),
                "total": len(ALL_SCROLLS),
                "covered": len(scrolls_read),
                "percentage": round(scroll_coverage, 1),
            },
            "quests": {
                "completed": quest_completions,
                "total": TOTAL_QUESTS,
                "percentage": round(quest_coverage, 1),
            },
        },
        "commands_used": dict(commands_used.most_common(20)),
        "missing": {
            "rooms": sorted(set(ALL_ROOMS) - rooms_visited),
            "scripts": sorted(set(ALL_SCRIPTS) - scripts_run),
        },
    }


def generate_markdown_report(coverage: dict[str, Any]) -> str:
    """Generate a Markdown coverage report."""
    c = coverage["coverage"]
    lines = [
        "# Bashcrawl Game Coverage Report",
        "",
        f"**Generated:** {coverage['timestamp']}",
        f"**Sessions analyzed:** {coverage['total_sessions']}",
        f"**Total commands executed:** {coverage['total_turns']}",
        "",
        "## Coverage Summary",
        "",
        "| Category | Covered | Total | Percentage |",
        "|----------|---------|-------|------------|",
        f"| Rooms | {c['rooms']['covered']} | {c['rooms']['total']} | {c['rooms']['percentage']}% |",
        f"| Scripts | {c['scripts']['covered']} | {c['scripts']['total']} | {c['scripts']['percentage']}% |",
        f"| Scrolls | {c['scrolls']['covered']} | {c['scrolls']['total']} | {c['scrolls']['percentage']}% |",
        f"| Quests | {c['quests']['completed']} | {c['quests']['total']} | {c['quests']['percentage']}% |",
        "",
        "## Top Commands Used",
        "",
    ]

    for cmd, count in coverage.get("commands_used", {}).items():
        lines.append(f"- `{cmd}`: {count}")

    lines.extend([
        "",
        "## Missing Coverage",
        "",
        "### Rooms Not Visited",
        "",
    ])
    for room in coverage.get("missing", {}).get("rooms", []):
        lines.append(f"- {room}")

    lines.extend([
        "",
        "### Scripts Not Executed",
        "",
    ])
    for script in coverage.get("missing", {}).get("scripts", []):
        lines.append(f"- {script}")

    return "\n".join(lines)


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Bashcrawl game coverage report")
    parser.add_argument(
        "session_dir",
        nargs="?",
        default=str(Path(__file__).parent.parent / "reports" / "ai_sessions"),
        help="Directory containing JSONL session files",
    )
    parser.add_argument(
        "-o", "--output",
        default=str(Path(__file__).parent.parent / "reports" / "analysis" / f"coverage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"),
        help="Output Markdown file path",
    )
    parser.add_argument("--json", action="store_true", help="Output JSON instead of Markdown")
    args = parser.parse_args()

    session_dir = Path(args.session_dir)
    if not session_dir.exists():
        print(f"No session directory found: {session_dir}")
        sys.exit(1)

    session_files = sorted(session_dir.glob("*.jsonl"))
    if not session_files:
        print(f"No JSONL files found in {session_dir}")
        sys.exit(1)

    print(f"Analyzing {len(session_files)} session files...")
    coverage = compute_coverage(session_files)

    if args.json:
        print(json.dumps(coverage, indent=2))
    else:
        report = generate_markdown_report(coverage)
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report)
        print(f"Coverage report written to {output_path}")
        print(f"\nRooms: {coverage['coverage']['rooms']['percentage']}%")
        print(f"Scripts: {coverage['coverage']['scripts']['percentage']}%")
        print(f"Scrolls: {coverage['coverage']['scrolls']['percentage']}%")
        print(f"Quests: {coverage['coverage']['quests']['percentage']}%")


if __name__ == "__main__":
    main()
