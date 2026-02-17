"""Markdown generator — renders DemoResult into a comprehensive walkthrough.

Produces a fully self-contained Markdown document with:
- Table of contents
- Chapter introductions
- Annotated terminal snapshots (prompt + command + output)
- Concept callouts and state summaries
- Command reference appendix
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from demo.runner import DemoResult, TerminalSnapshot
from demo.script import CHAPTERS, DemoStep


class MarkdownGenerator:
    """Renders a demo playthrough into a Markdown walkthrough document.

    Parameters
    ----------
    result
        The completed ``DemoResult`` from a demo run.
    steps
        The ``DemoStep`` list that was executed.
    """

    def __init__(self, result: DemoResult, steps: list[DemoStep]) -> None:
        self.result = result
        self.steps = steps
        self._chapter_lookup = {ch["name"]: ch for ch in CHAPTERS}

    def render(self) -> str:
        """Generate the full Markdown document."""
        parts: list[str] = []

        parts.append(self._render_header())
        parts.append(self._render_toc())
        parts.append(self._render_prerequisites())

        # Group steps & snapshots by chapter
        chapters_seen: list[str] = []
        chapter_groups: dict[str, list[tuple[DemoStep, TerminalSnapshot]]] = {}

        for step, snap in zip(self.steps, self.result.snapshots):
            ch = step.chapter
            if ch not in chapter_groups:
                chapter_groups[ch] = []
                chapters_seen.append(ch)
            chapter_groups[ch].append((step, snap))

        for idx, chapter_name in enumerate(chapters_seen, 1):
            pairs = chapter_groups[chapter_name]
            parts.append(self._render_chapter(idx, chapter_name, pairs))

        parts.append(self._render_command_reference())
        parts.append(self._render_summary())

        return "\n".join(parts)

    # -- sections ----------------------------------------------------------

    def _render_header(self) -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        duration = f"{self.result.total_duration:.1f}s"
        errors = len(self.result.errors)
        return f"""\
# Bashcrawl: Complete Game Walkthrough

> **Auto-generated** from a test demo run on {now}
>
> Duration: {duration} | Steps: {len(self.result.snapshots)} | \
Rooms: {len(self.result.rooms_visited)} | Errors: {errors}

---

Bashcrawl is an educational text-based adventure game that teaches
terminal (shell) commands through immersive fantasy gameplay.
Directories are rooms, files named `scroll` are lessons, and
executable scripts are interactive encounters with treasures,
potions, monsters, and spells.

This walkthrough demonstrates a complete playthrough — every command
a player would type, the terminal output they would see, and an
explanation of what each command teaches.

"""

    def _render_toc(self) -> str:
        lines = ["## Table of Contents\n"]

        # Collect unique chapters in order
        seen: list[str] = []
        for step in self.steps:
            if step.chapter not in seen:
                seen.append(step.chapter)

        for idx, ch in enumerate(seen, 1):
            anchor = self._anchor(ch)
            lines.append(f"{idx}. [Chapter {idx}: {ch}](#{anchor})")

        lines.append(f"{len(seen) + 1}. "
                      "[Command Reference](#command-reference)")
        lines.append(f"{len(seen) + 2}. "
                      "[Session Summary](#session-summary)")
        lines.append("")
        lines.append("---\n")
        return "\n".join(lines)

    def _render_prerequisites(self) -> str:
        return """\
## Prerequisites

Before playing Bashcrawl, ensure you have:

1. **A terminal** — Terminal.app (macOS), GNOME Terminal (Linux),
   or Windows Subsystem for Linux (WSL)
2. **Bash shell** — Most systems include it by default
3. **Git** — To clone the repository

```bash
# Clone the game
git clone https://github.com/bashcrawl/bashcrawl.git
cd bashcrawl

# Make game files executable
bash setup.sh

# Start playing!
cd entrance
cat scroll
```

---

"""

    def _render_chapter(
        self,
        idx: int,
        chapter_name: str,
        pairs: list[tuple[DemoStep, TerminalSnapshot]],
    ) -> str:
        lines: list[str] = []

        # Chapter heading
        lines.append(f"## Chapter {idx}: {chapter_name}\n")

        # Chapter intro
        ch_meta = self._chapter_lookup.get(chapter_name)
        if ch_meta:
            lines.append(f"{ch_meta['intro']}\n")

        # Each step
        prev_section = ""
        for step, snap in pairs:
            # Section heading (only if changed)
            if step.section != prev_section:
                lines.append(f"### {step.section}\n")
                prev_section = step.section

            # Explanation
            lines.append(f"{step.explanation}\n")

            # Terminal snapshot
            lines.append(self._render_terminal_block(step, snap))

            # Concept callout
            if step.concepts:
                concepts_str = ", ".join(f"`{c}`" for c in step.concepts)
                lines.append(f"> **Concepts:** {concepts_str}\n")

            # Setup callout
            if step.is_setup:
                lines.append(
                    "> 🎮 **Player Action:** Run this command to "
                    "update your game state.\n"
                )

            # Error note
            if snap.stderr and snap.exit_code != 0:
                lines.append(
                    f"> ⚠️ **Note:** {snap.stderr.strip()}\n"
                )

        # State summary at chapter end
        last_snap = pairs[-1][1]
        lines.append(self._render_state_box(last_snap))
        lines.append("---\n")

        return "\n".join(lines)

    def _render_terminal_block(
        self, step: DemoStep, snap: TerminalSnapshot
    ) -> str:
        """Render a terminal code block with prompt, command, and output."""
        lines: list[str] = ["```bash"]

        # Show prompt + command
        prompt = snap.prompt or "player@bashcrawl:~$ "
        lines.append(f"{prompt}{step.command}")

        # Show stdin input if any (as a comment)
        if step.stdin_input:
            for response in step.stdin_input.strip().split("\n"):
                lines.append(f"# (input) {response}")

        # Show output (trimmed)
        output = snap.stdout.rstrip()
        if output:
            # Limit very long outputs to keep the doc readable
            output_lines = output.split("\n")
            if len(output_lines) > 60:
                shown = output_lines[:50]
                shown.append(f"... ({len(output_lines) - 50} more lines) ...")
                shown.extend(output_lines[-5:])
                output = "\n".join(shown)
            lines.append(output)

        lines.append("```\n")
        return "\n".join(lines)

    def _render_state_box(self, snap: TerminalSnapshot) -> str:
        """Render a state summary box."""
        inventory = snap.inventory or "(empty)"
        # Clean up display
        inv_display = ", ".join(
            item for item in inventory.split(",") if item.strip()
        ) or "(empty)"

        return f"""\
<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `{snap.cwd_after}` |
| **Inventory** | {inv_display} |
| **HP** | {snap.hp} |

</details>

"""

    def _render_command_reference(self) -> str:
        """Generate a command reference appendix."""
        lines = ["## Command Reference\n"]
        lines.append(
            "All terminal commands demonstrated in this walkthrough, "
            "organized by category.\n"
        )

        # Collect unique concepts by category
        categories: dict[str, list[str]] = {
            "Navigation": [],
            "File Viewing": [],
            "File Management": [],
            "Execution": [],
            "Variables & Arithmetic": [],
            "Text Processing": [],
            "Links": [],
            "Other": [],
        }

        concept_to_category = {
            "cd": "Navigation",
            "cd ..": "Navigation",
            "pwd": "Navigation",
            "working directory": "Navigation",
            "directory navigation": "Navigation",
            "nested directories": "Navigation",
            "deep navigation": "Navigation",
            "parent directory": "Navigation",
            "relative paths": "Navigation",
            "..": "Navigation",
            "ls": "File Viewing",
            "listing files": "File Viewing",
            "ls -F": "File Viewing",
            "file type indicators": "File Viewing",
            "executable indicator *": "File Viewing",
            "cat": "File Viewing",
            "reading files": "File Viewing",
            "echo": "File Viewing",
            "mkdir": "File Management",
            "touch": "File Management",
            "cp": "File Management",
            "rm": "File Management",
            "rmdir": "File Management",
            "echo >": "File Management",
            "mv": "File Management",
            "rename files": "File Management",
            "file creation": "File Management",
            "file duplication": "File Management",
            "chmod": "Execution",
            "./": "Execution",
            "permissions": "Execution",
            "paths": "Execution",
            "executing scripts": "Execution",
            "interactive scripts": "Execution",
            "read": "Execution",
            "stdin": "Execution",
            "export": "Variables & Arithmetic",
            "environment variables": "Variables & Arithmetic",
            "inventory": "Variables & Arithmetic",
            "variable expansion": "Variables & Arithmetic",
            "numeric variables": "Variables & Arithmetic",
            "let": "Variables & Arithmetic",
            "bash arithmetic": "Variables & Arithmetic",
            "unset": "Variables & Arithmetic",
            "variables": "Variables & Arithmetic",
            "$USER": "Variables & Arithmetic",
            "POSIX": "Variables & Arithmetic",
            "string concatenation": "Variables & Arithmetic",
            "grep": "Text Processing",
            "grep -r": "Text Processing",
            "grep --quiet": "Text Processing",
            "here-strings": "Text Processing",
            "sed": "Text Processing",
            "command substitution": "Text Processing",
            "$()": "Text Processing",
            "string manipulation": "Text Processing",
            "sort": "Text Processing",
            "uniq": "Text Processing",
            "pipe |": "Text Processing",
            "text processing": "Text Processing",
            "ln -s": "Links",
            "ln -f": "Links",
            "symlinks": "Links",
            "portals": "Links",
            "tab completion": "Other",
            "command history": "Other",
            "arrow keys": "Other",
            "hidden files": "Other",
            "ls -a": "Other",
            "dot-directories": "Other",
            "find": "Other",
        }

        seen_concepts: set[str] = set()
        for step in self.steps:
            for concept in step.concepts:
                if concept not in seen_concepts:
                    seen_concepts.add(concept)
                    cat = concept_to_category.get(concept, "Other")
                    if concept not in categories.get(cat, []):
                        categories.setdefault(cat, []).append(concept)

        for cat_name, concepts in categories.items():
            if not concepts:
                continue
            lines.append(f"### {cat_name}\n")
            lines.append("| Command / Concept | Description |")
            lines.append("|-------------------|-------------|")
            for c in concepts:
                desc = self._concept_description(c)
                lines.append(f"| `{c}` | {desc} |")
            lines.append("")

        lines.append("---\n")
        return "\n".join(lines)

    def _render_summary(self) -> str:
        """Render the session summary."""
        r = self.result
        rooms = ", ".join(f"`{room}`" for room in r.rooms_visited) or "none"
        items = ", ".join(r.items_collected) or "none"
        encounters = ", ".join(r.encounters) or "none"

        errors_section = ""
        if r.errors:
            error_list = "\n".join(f"- {e}" for e in r.errors)
            errors_section = f"\n### Errors\n\n{error_list}\n"

        return f"""\
## Session Summary

| Metric | Value |
|--------|-------|
| **Total Steps** | {len(r.snapshots)} |
| **Duration** | {r.total_duration:.1f} seconds |
| **Rooms Visited** | {len(r.rooms_visited)} |
| **Items Collected** | {len(r.items_collected)} |
| **Encounters** | {len(r.encounters)} |
| **Success** | {"✅ Yes" if r.success else "❌ No"} |

### Rooms Visited

{rooms}

### Items Collected

{items}

### Encounters

{encounters}
{errors_section}
---

*Generated by Bashcrawl Demo Test Framework*
"""

    # -- helpers -----------------------------------------------------------

    @staticmethod
    def _anchor(text: str) -> str:
        """Convert chapter name to a Markdown anchor."""
        return text.lower().replace(" ", "-").replace("(", "").replace(")", "")

    @staticmethod
    def _concept_description(concept: str) -> str:
        """Return a brief description for a concept."""
        descriptions = {
            "cd": "Change directory — navigate between rooms",
            "cd ..": "Move to parent directory — go back one level",
            "pwd": "Print working directory — show current location",
            "ls": "List directory contents — see what's in a room",
            "ls -F": "List with type indicators (`/` dirs, `*` executables)",
            "cat": "Display file contents — read scrolls and files",
            "echo": "Print text or variable values to the terminal",
            "mkdir": "Create a new directory",
            "touch": "Create an empty file or update timestamps",
            "cp": "Copy files or directories",
            "rm": "Remove (delete) files",
            "rmdir": "Remove empty directories",
            "mv": "Move or rename files and directories",
            "chmod": "Change file permissions",
            "./": "Execute a script in the current directory",
            "export": "Set environment variables for child processes",
            "let": "Perform integer arithmetic in bash",
            "unset": "Remove an environment variable",
            "grep": "Search for patterns in text",
            "grep -r": "Search recursively through directories",
            "grep --quiet": "Silent search — exit code only",
            "sed": "Stream editor — find and replace in text",
            "sort": "Sort lines of text",
            "uniq": "Remove duplicate consecutive lines",
            "ln -s": "Create a symbolic link (shortcut)",
            "ln -f": "Force-create a link, overwriting existing",
            "pipe |": "Send output of one command as input to another",
            "read": "Read user input from stdin",
            "find": "Search for files by name or attributes",
            "tab completion": "Press TAB to auto-complete commands/filenames",
            "command history": "Use UP/DOWN arrows to recall commands",
            "$USER": "Environment variable containing your username",
            "POSIX": "Portable Operating System Interface standard",
            "$()": "Command substitution — capture command output",
            "echo >": "Redirect output to a file (overwrite)",
        }
        return descriptions.get(concept, concept)
