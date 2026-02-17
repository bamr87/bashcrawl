"""AI-powered test review generator.

Sends test session data to Claude for analysis and generates
a structured review for human consumption.

Evaluates:
- Did the AI player behave realistically?
- Are there game bugs or confusing content?
- Is the progression path clear?
- Any broken mechanics?
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


def load_session_summary(session_dir: Path) -> dict[str, Any]:
    """Load and summarize all test sessions."""
    sessions = []
    for path in sorted(session_dir.glob("*.jsonl")):
        events = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        if not events:
            continue

        rooms = [e.get("room", "") for e in events if e.get("event") == "room_enter"]
        commands = [e.get("command", "") for e in events if e.get("event") == "command"]
        encounters = [e for e in events if e.get("event") == "encounter"]
        deaths = [e for e in events if e.get("event") == "death"]
        errors = [e for e in events if e.get("command", "").startswith("./") and "error" in str(e)]

        sessions.append({
            "file": path.name,
            "events": len(events),
            "rooms_visited": rooms,
            "unique_rooms": list(set(rooms)),
            "commands": commands[:50],  # Limit for API token budget
            "encounters": encounters,
            "deaths": deaths,
            "total_commands": len(commands),
        })

    return {
        "total_sessions": len(sessions),
        "sessions": sessions,
    }


def generate_review_prompt(summary: dict[str, Any], coverage: dict[str, Any] | None = None) -> str:
    """Build the Claude review prompt."""
    session_details = json.dumps(summary, indent=2)[:8000]  # Token budget

    coverage_section = ""
    if coverage:
        coverage_section = f"""
## Coverage Data
- Rooms covered: {coverage.get('coverage', {}).get('rooms', {}).get('percentage', 'N/A')}%
- Scripts covered: {coverage.get('coverage', {}).get('scripts', {}).get('percentage', 'N/A')}%
- Scrolls read: {coverage.get('coverage', {}).get('scrolls', {}).get('percentage', 'N/A')}%
- Quests completed: {coverage.get('coverage', {}).get('quests', {}).get('percentage', 'N/A')}%
"""

    return f"""You are reviewing automated test results for Bashcrawl, an educational text-based adventure game that teaches terminal commands.

An AI agent played through the game simulating a real user. Analyze the test session data and provide a structured review.

{coverage_section}

## Session Data
{session_details}

## Review Instructions

Please analyze and provide:

1. **Player Behavior Assessment**
   - Did the AI behave like a realistic beginner?
   - Was the command progression natural?
   - Did it get stuck anywhere? Why?

2. **Game Bug Detection**
   - Any scripts that failed unexpectedly?
   - Any rooms that were unreachable?
   - Any confusing scroll text or broken instructions?

3. **Progression Quality**
   - Was the difficulty curve appropriate?
   - Were quest instructions clear enough?
   - Any dead ends or confusion points?

4. **Recommendations**
   - Improvements to scroll content
   - Improvements to game mechanics
   - Additional test scenarios needed

5. **Test Quality Score** (1-10)
   - How thorough was the test coverage?
   - What areas need more testing?

Format your response as structured Markdown with headers.
"""


def generate_review(
    session_dir: Path,
    output_path: Path,
    coverage_path: Path | None = None,
) -> str:
    """Generate an AI review of test results.

    Requires ANTHROPIC_API_KEY environment variable.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "# Review Unavailable\n\nANTHROPIC_API_KEY not set. Cannot generate AI review."

    try:
        import anthropic
    except ImportError:
        return "# Review Unavailable\n\n`anthropic` package not installed."

    # Load data
    summary = load_session_summary(session_dir)
    if summary["total_sessions"] == 0:
        return "# Review Unavailable\n\nNo test sessions found to review."

    coverage = None
    if coverage_path and coverage_path.exists():
        with open(coverage_path) as f:
            coverage = json.load(f)

    # Build prompt
    prompt = generate_review_prompt(summary, coverage)

    # Call Claude
    client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        review_text = response.content[0].text
    except Exception as e:
        review_text = f"# Review Error\n\nFailed to generate review: {e}"

    # Add metadata header
    full_report = (
        f"# Bashcrawl AI Test Review\n\n"
        f"**Generated:** {datetime.now().isoformat()}\n"
        f"**Sessions reviewed:** {summary['total_sessions']}\n"
        f"**Model:** claude-sonnet-4-20250514\n\n"
        f"---\n\n"
        f"{review_text}"
    )

    # Write to file
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(full_report)

    return full_report


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate AI review of test results")
    parser.add_argument(
        "session_dir",
        nargs="?",
        default=str(Path(__file__).parent.parent / "reports" / "ai_sessions"),
        help="Directory containing JSONL session files",
    )
    parser.add_argument(
        "-o", "--output",
        default=str(
            Path(__file__).parent.parent / "reports" / "analysis"
            / f"review_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        ),
    )
    parser.add_argument("--coverage", help="Path to coverage JSON file")
    args = parser.parse_args()

    review = generate_review(
        session_dir=Path(args.session_dir),
        output_path=Path(args.output),
        coverage_path=Path(args.coverage) if args.coverage else None,
    )
    print(review[:500])
    print(f"\nFull review: {args.output}")


if __name__ == "__main__":
    main()
