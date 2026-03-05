"""Render game state as simple SVG screenshots.

Generates lightweight SVG images that display the terminal-like output
of a game command — suitable for the screenshot viewer without requiring
a running Textual App.

Each SVG is styled to look like a dark terminal panel with monospaced
text, showing the command, output, game location, inventory, and HP.
"""

from __future__ import annotations

import html
from datetime import datetime
from pathlib import Path


_SVG_TEMPLATE = """\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 {height}" width="800" height="{height}">
  <defs>
    <style>
      .bg {{ fill: #1e1e2e; }}
      .header {{ fill: #313244; }}
      .title {{ font: bold 14px monospace; fill: #cdd6f4; }}
      .prompt {{ font: bold 13px monospace; fill: #a6e3a1; }}
      .output {{ font: 13px monospace; fill: #cdd6f4; }}
      .dim {{ font: 12px monospace; fill: #6c7086; }}
      .stat {{ font: bold 12px monospace; fill: #f9e2af; }}
      .border {{ fill: none; stroke: #45475a; stroke-width: 2; rx: 8; }}
    </style>
  </defs>
  <rect class="bg" width="800" height="{height}" rx="8"/>
  <rect class="border" x="1" y="1" width="798" height="{height_inner}" rx="8"/>
  <rect class="header" x="1" y="1" width="798" height="32" rx="8"/>
  <rect class="header" x="1" y="25" width="798" height="8"/>
  <text class="title" x="16" y="22">{title}</text>
  <text class="dim" x="640" y="22">{timestamp}</text>
{body}
</svg>
"""


def _wrap_lines(text: str, max_width: int = 90) -> list[str]:
    """Word-wrap text to fit within max_width characters."""
    result: list[str] = []
    for raw_line in text.splitlines():
        if len(raw_line) <= max_width:
            result.append(raw_line)
        else:
            while len(raw_line) > max_width:
                # Try to break at a space
                brk = raw_line.rfind(" ", 0, max_width)
                if brk <= 0:
                    brk = max_width
                result.append(raw_line[:brk])
                raw_line = raw_line[brk:].lstrip()
            if raw_line:
                result.append(raw_line)
    return result


def render_command_svg(
    command: str,
    output: str,
    location: str = "",
    inventory: str = "",
    hp: int = 0,
    turn: int = 0,
    title: str = "Bashcrawl Agent Session",
) -> str:
    """Render a single command + output as an SVG string.

    Returns the complete SVG markup as a string.
    """
    timestamp = datetime.now().strftime("%H:%M:%S")

    # Build body lines
    body_parts: list[str] = []
    y = 56

    # Status bar
    status = f"📍 {location or '?'}"
    if inventory:
        status += f"   🎒 {inventory}"
    if hp:
        status += f"   ❤️  HP={hp}"
    if turn:
        status += f"   ⏱ Turn {turn}"

    body_parts.append(f'  <text class="stat" x="16" y="{y}">{html.escape(status)}</text>')
    y += 24

    # Separator
    body_parts.append(
        f'  <line x1="16" y1="{y}" x2="784" y2="{y}" stroke="#45475a" stroke-width="1"/>'
    )
    y += 16

    # Command prompt
    prompt_text = f"$ {command}"
    body_parts.append(f'  <text class="prompt" x="16" y="{y}">{html.escape(prompt_text)}</text>')
    y += 20

    # Output (word-wrapped, capped at 30 lines)
    output_lines = _wrap_lines(output.strip(), max_width=90)
    if len(output_lines) > 30:
        output_lines = output_lines[:28] + ["...", f"({len(output_lines)} lines total)"]

    for line in output_lines:
        body_parts.append(f'  <text class="output" x="16" y="{y}">{html.escape(line)}</text>')
        y += 18

    # Bottom padding
    y += 16
    height = max(y, 120)
    height_inner = height - 2

    return _SVG_TEMPLATE.format(
        height=height,
        height_inner=height_inner,
        title=html.escape(title),
        timestamp=timestamp,
        body="\n".join(body_parts),
    )


def save_command_svg(
    path: Path,
    command: str,
    output: str,
    location: str = "",
    inventory: str = "",
    hp: int = 0,
    turn: int = 0,
    title: str = "Bashcrawl Agent Session",
) -> Path:
    """Render and save a command screenshot SVG to *path*.

    Creates parent directories if needed. Returns the path.
    """
    svg = render_command_svg(
        command=command,
        output=output,
        location=location,
        inventory=inventory,
        hp=hp,
        turn=turn,
        title=title,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg, encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# Test-summary SVG (for non-TUI tests that have no Textual screenshots)
# ---------------------------------------------------------------------------

_OUTCOME_COLORS = {
    "passed": "#a6e3a1",   # green
    "failed": "#f38ba8",   # red
    "error": "#fab387",    # peach
    "skipped": "#f9e2af",  # yellow
}

_OUTCOME_ICONS = {
    "passed": "✅",
    "failed": "❌",
    "error": "⚠️",
    "skipped": "⏭️",
}


def render_test_summary(
    test_name: str,
    outcome: str = "passed",
    duration_sec: float = 0.0,
    markers: list[str] | None = None,
    stdout_preview: str = "",
    test_module: str = "",
    test_class: str = "",
) -> str:
    """Render a summary SVG for a test that did not produce TUI screenshots.

    This generates a minimal dark-themed SVG showing the test identity,
    outcome, timing, markers, and an optional preview of captured stdout.
    Used by the autouse ``screenshot_capture`` fixture when no screenshots
    were taken during the test.

    Returns:
        Complete SVG markup as a string.
    """
    timestamp = datetime.now().strftime("%H:%M:%S")
    color = _OUTCOME_COLORS.get(outcome, "#cdd6f4")
    icon = _OUTCOME_ICONS.get(outcome, "❓")

    body_parts: list[str] = []
    y = 56

    # Outcome badge
    body_parts.append(
        f'  <text class="stat" x="16" y="{y}">'
        f'{icon} Outcome: <tspan fill="{color}">{html.escape(outcome.upper())}</tspan>'
        f'</text>'
    )
    y += 24

    # Duration
    dur_display = f"{duration_sec:.2f}s" if duration_sec else "—"
    body_parts.append(
        f'  <text class="dim" x="16" y="{y}">⏱  Duration: {dur_display}</text>'
    )
    y += 20

    # Markers
    if markers:
        marker_text = ", ".join(markers)
        body_parts.append(
            f'  <text class="dim" x="16" y="{y}">🏷  Markers: {html.escape(marker_text)}</text>'
        )
        y += 20

    # Module / class
    if test_module or test_class:
        loc = test_module or ""
        if test_class:
            loc += f"::{test_class}" if loc else test_class
        body_parts.append(
            f'  <text class="dim" x="16" y="{y}">📂 {html.escape(loc)}</text>'
        )
        y += 20

    # Separator
    y += 4
    body_parts.append(
        f'  <line x1="16" y1="{y}" x2="784" y2="{y}" stroke="#45475a" stroke-width="1"/>'
    )
    y += 16

    # Stdout preview (if any)
    if stdout_preview:
        body_parts.append(
            f'  <text class="prompt" x="16" y="{y}">Captured stdout:</text>'
        )
        y += 20
        preview_lines = _wrap_lines(stdout_preview.strip(), max_width=90)
        if len(preview_lines) > 20:
            preview_lines = preview_lines[:18] + ["...", f"({len(preview_lines)} lines total)"]
        for line in preview_lines:
            body_parts.append(
                f'  <text class="output" x="16" y="{y}">{html.escape(line)}</text>'
            )
            y += 18
    else:
        body_parts.append(
            f'  <text class="dim" x="16" y="{y}">(no captured output)</text>'
        )
        y += 18

    # Bottom padding
    y += 16
    height = max(y, 120)
    height_inner = height - 2

    title = f"Test: {test_name}"
    return _SVG_TEMPLATE.format(
        height=height,
        height_inner=height_inner,
        title=html.escape(title),
        timestamp=timestamp,
        body="\n".join(body_parts),
    )


def save_test_summary_svg(
    path: Path,
    test_name: str,
    outcome: str = "passed",
    duration_sec: float = 0.0,
    markers: list[str] | None = None,
    stdout_preview: str = "",
    test_module: str = "",
    test_class: str = "",
) -> Path:
    """Render and save a test-summary SVG. Returns the path."""
    svg = render_test_summary(
        test_name=test_name,
        outcome=outcome,
        duration_sec=duration_sec,
        markers=markers,
        stdout_preview=stdout_preview,
        test_module=test_module,
        test_class=test_class,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg, encoding="utf-8")
    return path
