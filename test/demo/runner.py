"""Demo runner — drives Bashcrawl through ``main.sh`` batch mode.

Pipes all commands to ``bash main.sh`` via stdin and captures the
combined prompt + output stream.  This produces output that matches the
real interactive experience — game prompts, area context, quest
completions, and full game-script output all appear exactly as a player
would see them.

Design
------
* ``main.sh`` auto-detects piped stdin (``[[ ! -t 0 ]]``) and enters
  ``run_batch`` mode, which prints ``$(generate_prompt)${input}`` before
  each command's output.
* Game scripts that call ``read`` consume subsequent stdin lines, so
  ``DemoStep.stdin_input`` lines are interleaved directly after the
  command that triggers them.
* ANSI colour codes are stripped from the captured output so that the
  generated Markdown is plain-text friendly while still describing the
  original decorated prompts.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from fixtures.screenshot_capture import ScreenshotCapture


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

# Regex to match ANSI escape sequences (colours, cursor movement, etc.)
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07")


@dataclass
class TerminalSnapshot:
    """A single captured interaction — one command and its result."""

    command: str
    stdin_input: Optional[str] = None
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    cwd_before: str = ""
    cwd_after: str = ""
    inventory: str = ""
    hp: int = 0
    env_snapshot: dict[str, str] = field(default_factory=dict)
    prompt: str = ""
    duration: float = 0.0


@dataclass
class DemoResult:
    """Complete result of a demo playthrough."""

    snapshots: list[TerminalSnapshot] = field(default_factory=list)
    total_duration: float = 0.0
    rooms_visited: list[str] = field(default_factory=list)
    items_collected: list[str] = field(default_factory=list)
    encounters: list[str] = field(default_factory=list)
    success: bool = True
    errors: list[str] = field(default_factory=list)
    raw_output: str = ""
    screenshot_paths: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Output parsing helpers
# ---------------------------------------------------------------------------

# Prompt pattern emitted by main.sh generate_prompt().
# Examples:
#   🏠 bashcrawl [lobby] ⚔️  cd entrance
#   🚪 entrance [starting hall] ⚔️  ls
#   📍 chamber [unknown] ⚔️  cat scroll
# We match: <emoji(s)> <dirname> [description] ⚔️  <command text>
_PROMPT_RE = re.compile(
    r"^("                              # --- start of prompt capture ---
    r"[^\x00-\x7F]+"                   # leading emoji cluster
    r"[\uFE0F]?"                       # optional variation selector
    r"\s+\S+"                          # space + dirname
    r"\s+\[.*?\]"                      # space + [description]
    r"\s+⚔️\s+"                        # space + ⚔️ + trailing space(s)
    r")"                               # --- end of prompt capture ---
    r"(.+)$",                          # command text
    re.MULTILINE,
)


def strip_ansi(text: str) -> str:
    """Remove ANSI escape codes from *text*."""
    return _ANSI_RE.sub("", text)


def _parse_prompt_line(line: str) -> tuple[str, str] | None:
    """Try to split *line* into (prompt, command).

    Returns ``None`` if the line is not a prompt line.
    """
    m = _PROMPT_RE.match(line)
    if m:
        return m.group(1), m.group(2).rstrip()
    return None


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


class DemoRunner:
    """Drive the full game through ``main.sh`` batch mode.

    All commands are piped to a single ``bash main.sh`` process so that
    the game's real environment, state management, and command dispatch
    are exercised.

    Parameters
    ----------
    game_root
        Path to the sandbox game root (the directory containing
        ``entrance/``, ``main.sh``, etc.).
    """

    def __init__(
        self,
        game_root: Path,
        screenshot_capture: "ScreenshotCapture | None" = None,
    ) -> None:
        self.game_root = game_root.resolve()
        self._screenshot_capture = screenshot_capture

    # -- public API --------------------------------------------------------

    def run_full_demo(self, steps: list["DemoStep"]) -> DemoResult:
        """Execute all steps through ``main.sh`` and return results."""
        from demo.script import DemoStep  # noqa: F811

        t0 = time.monotonic()

        # Build the command stream: each command on its own line.
        # For steps with stdin_input, the extra stdin lines follow
        # immediately so that the game script's ``read`` calls consume
        # them before the REPL reads the next command.
        lines: list[str] = []
        for step in steps:
            lines.append(step.command)
            if step.stdin_input:
                for part in step.stdin_input.rstrip("\n").split("\n"):
                    lines.append(part)

        # Append exit so main.sh terminates cleanly
        lines.append("exit")

        input_text = "\n".join(lines) + "\n"

        # Ensure a clean game state in the sandbox
        for fname in (".game_state", ".game_history"):
            p = self.game_root / fname
            if p.exists():
                p.unlink()

        env = self._build_env()

        proc = subprocess.run(
            ["bash", str(self.game_root / "main.sh")],
            cwd=str(self.game_root),
            env=env,
            input=input_text,
            capture_output=True,
            text=True,
            timeout=120,
        )

        duration = time.monotonic() - t0
        raw = proc.stdout or ""
        raw_stderr = proc.stderr or ""

        # Strip ANSI codes for parsing
        clean = strip_ansi(raw)

        # Sanitize sandbox paths
        clean = self._sanitize_output(clean)
        raw_stderr = strip_ansi(self._sanitize_output(raw_stderr))

        # Parse the output into per-command snapshots
        snapshots = self._parse_output(clean, steps)

        # Derive metrics from snapshots
        result = self._build_result(snapshots, steps, clean, duration)
        result.raw_output = clean

        # Parse SCREENSHOT: lines from output (if agent mode was used)
        if self._screenshot_capture:
            self._screenshot_capture.take_from_agent_output(raw)
            result.screenshot_paths = [
                str(p) for p in self._screenshot_capture.screenshots
            ]

        return result

    def run_step(self, step: "DemoStep") -> TerminalSnapshot:
        """Run a single step — delegates to ``run_full_demo``."""
        result = self.run_full_demo([step])
        if result.snapshots:
            return result.snapshots[0]
        return TerminalSnapshot(command=step.command, exit_code=1)

    # -- output parsing ----------------------------------------------------

    def _parse_output(
        self, output: str, steps: list["DemoStep"]
    ) -> list[TerminalSnapshot]:
        """Split combined output into per-command snapshots.

        Strategy: scan for prompt lines that echo a command.  Everything
        between two prompt lines is the output of the first command.
        We match prompt-echoed commands to ``DemoStep`` commands in
        order, skipping any spurious prompt lines (e.g. stdin lines
        echoed as commands).
        """
        # Find all prompt-line positions
        prompt_hits: list[tuple[int, int, str, str]] = []
        for m in _PROMPT_RE.finditer(output):
            prompt_hits.append(
                (m.start(), m.end(), m.group(1), m.group(2).rstrip())
            )

        snapshots: list[TerminalSnapshot] = []
        step_idx = 0

        for i, (start, end, prompt_text, echoed_cmd) in enumerate(prompt_hits):
            if step_idx >= len(steps):
                break

            step = steps[step_idx]

            # Try to match this echoed command to the current step
            if not self._commands_match(echoed_cmd, step.command):
                # Could be a stdin line echoed as a command, or
                # an internal command — skip it
                continue

            # Determine the output block: from end-of-prompt-line
            # to the start of the next prompt line (or end of output).
            newline_pos = output.find("\n", end)
            body_start = newline_pos + 1 if newline_pos != -1 else len(output)
            body_end = (
                prompt_hits[i + 1][0]
                if i + 1 < len(prompt_hits)
                else len(output)
            )
            body = output[body_start:body_end].rstrip("\n")

            # Clean up the body — strip trailing blank lines and the
            # shutdown message
            body = self._clean_body(body)

            snap = TerminalSnapshot(
                command=step.command,
                stdin_input=step.stdin_input,
                stdout=body + "\n" if body else "",
                prompt=prompt_text.rstrip(),
                exit_code=0,
            )
            snapshots.append(snap)
            step_idx += 1

        # Fill in any unmatched steps with empty snapshots
        while step_idx < len(steps):
            step = steps[step_idx]
            snapshots.append(TerminalSnapshot(
                command=step.command,
                stdin_input=step.stdin_input,
                stdout="",
                exit_code=0,
            ))
            step_idx += 1

        return snapshots

    @staticmethod
    def _clean_body(body: str) -> str:
        """Remove shutdown/info noise from command output."""
        lines = body.split("\n")
        cleaned: list[str] = []
        for line in lines:
            # Skip main.sh info/shutdown lines
            if line.startswith("ℹ️") or line.startswith("✅"):
                continue
            # Skip "zsh: command not found" from leftover stdin
            if "command not found" in line:
                continue
            cleaned.append(line)
        # Strip trailing blank lines
        while cleaned and not cleaned[-1].strip():
            cleaned.pop()
        return "\n".join(cleaned)

    @staticmethod
    def _commands_match(echoed: str, expected: str) -> bool:
        """Check if the echoed command matches what we sent.

        Handles minor differences like shell expansion of ``$I``.
        """
        if echoed == expected:
            return True
        # Normalize whitespace
        if echoed.split() == expected.split():
            return True
        # export I=sword,$I might echo differently after expansion
        if expected.startswith("export ") and echoed.startswith("export "):
            # Compare up to the = sign
            exp_var = expected.split("=", 1)[0]
            ech_var = echoed.split("=", 1)[0]
            if exp_var == ech_var:
                return True
        # let with/without quotes
        if expected.startswith("let ") and echoed.startswith("let "):
            exp_expr = expected[4:].strip().strip("\"'")
            ech_expr = echoed[4:].strip().strip("\"'")
            if exp_expr == ech_expr:
                return True
        # Command substitution
        if "$(" in expected and "$(" in echoed:
            return True
        # ln, cp, mv, touch, mkdir — fuzzy
        for prefix in ("ln ", "cp ", "mv ", "touch ", "mkdir "):
            if expected.startswith(prefix) and echoed.startswith(prefix):
                return True
        return False

    # -- result building ---------------------------------------------------

    def _build_result(
        self,
        snapshots: list[TerminalSnapshot],
        steps: list["DemoStep"],
        full_output: str,
        duration: float,
    ) -> DemoResult:
        """Derive rooms, items, encounters, errors from snapshots."""
        result = DemoResult()
        result.snapshots = snapshots
        result.total_duration = duration

        # Track rooms from cd commands
        rooms: list[str] = []
        path_parts: list[str] = []

        for i, step in enumerate(steps):
            cmd = step.command.strip()
            snap = snapshots[i] if i < len(snapshots) else None

            # Track rooms
            if cmd.startswith("cd "):
                target = cmd[3:].strip()
                if target == "~" or target == "":
                    path_parts = []
                else:
                    segments = target.split("/")
                    for seg in segments:
                        if seg == "..":
                            if path_parts:
                                path_parts.pop()
                        elif seg and seg != ".":
                            path_parts.append(seg)
                room = "/".join(path_parts) if path_parts else "."
                if room not in rooms and room != ".":
                    rooms.append(room)
                if snap:
                    snap.cwd_after = room

            # Track inventory from export I= commands
            if cmd.startswith("export I="):
                val = cmd[len("export I="):]
                # Remove variable references and split
                val = re.sub(r'\$\{?I\}?', '', val)
                val = re.sub(r'\$\(.*?\)', '', val)
                for item in val.replace(",", " ").split():
                    item = item.strip()
                    if item and item not in result.items_collected:
                        result.items_collected.append(item)

            # Track encounters from ./ commands
            if cmd.startswith("./"):
                script_name = cmd.lstrip("./").strip()
                result.encounters.append(script_name)

            # Check expected_contains
            if step.expected_contains and snap:
                for expected in step.expected_contains:
                    if expected not in snap.stdout:
                        result.errors.append(
                            f"Step '{cmd}': expected '{expected}' in output"
                        )

        result.rooms_visited = rooms
        result.success = len(result.errors) == 0
        return result

    # -- helpers -----------------------------------------------------------

    def _build_env(self) -> dict[str, str]:
        """Build the subprocess environment."""
        env = os.environ.copy()
        env["HOME"] = str(self.game_root)
        env["BASHCRAWL_ROOT"] = str(self.game_root)
        env["TERM"] = "dumb"  # suppress colour in some tools
        # Don't inherit game state from the real user
        for k in ("I", "HP", "GAME_LEVEL", "CURRENT_AREA",
                   "BASHCRAWL_MODE", "CURRENT_PATH"):
            env.pop(k, None)
        return env

    def _sanitize_output(self, text: str) -> str:
        """Replace sandbox temp paths with clean display paths."""
        if not text:
            return text
        sandbox_str = str(self.game_root)
        text = text.replace(sandbox_str, "~")
        # Handle /private prefix on macOS temp dirs
        if sandbox_str.startswith("/private"):
            text = text.replace(sandbox_str[8:], "~")
        else:
            text = text.replace(f"/private{sandbox_str}", "~")
        return text
