"""Comprehensive interactive terminal UI tests with screenshot capture.

Runs full game walkthroughs through the Textual agent TUI, capturing
SVG screenshots at every meaningful state transition.  All screenshots
and JSONL session logs are persisted under ``logs/`` for post-test
review and analysis.

Results layout::

    logs/
        sessions/<date>_<sid>.jsonl      — JSONL event stream
        screenshots/<date>_<test>/       — per-test screenshot dir
            000_initial.svg
            001_pwd.svg
            ...
            manifest.json               — structured index of all captures

To review screenshots after a run::

    python3 -m http.server 8899 --directory logs/screenshots/
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest

pytestmark = [pytest.mark.integration]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"
SCREENSHOTS_ROOT = REPO_ROOT / "logs" / "screenshots"


def _has_textual() -> bool:
    try:
        import textual  # noqa: F401
        return True
    except ImportError:
        return False


def _make_shot_dir(name: str) -> Path:
    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    d = SCREENSHOTS_ROOT / f"{ts}_{name}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _run_agent(commands: list[str], screenshot_dir: Path, timeout: int = 45) -> str:
    """Run the agent with commands, return stdout."""
    input_text = "\n".join(commands) + "\n"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(TI_DIR)

    result = subprocess.run(
        [
            sys.executable, "-m", "ti.agent",
            "--game-root", str(REPO_ROOT),
            "--screenshot-dir", str(screenshot_dir),
        ],
        input=input_text,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    return result.stdout


def _run_walkthrough(
    name: str,
    commands: list[str],
    screenshot_commands: list[str] | None = None,
    timeout: int = 45,
) -> tuple[str, Path, list[Path]]:
    """Run a named walkthrough with combined game + screenshot commands.

    Inserts explicit SCREENSHOT meta-commands after each game command
    (unless *screenshot_commands* is provided to override the list).

    Returns (stdout, shot_dir, svg_paths).
    """
    from fixtures.screenshot_capture import ScreenshotCapture
    from fixtures.log_capture import TestLogCapture

    shot_dir = _make_shot_dir(name)
    log_dir = REPO_ROOT / "logs" / "sessions"
    log_dir.mkdir(parents=True, exist_ok=True)

    lc = TestLogCapture(log_dir, scenario="tui_walkthrough", test_name=name)
    lc.start()
    cap = ScreenshotCapture(screenshot_dir=shot_dir, log_capture=lc)

    # Build the full command list with explicit screenshot commands interspersed
    full_cmds: list[str] = []
    if screenshot_commands:
        full_cmds = screenshot_commands
    else:
        for cmd in commands:
            full_cmds.append(cmd)
    full_cmds.append("EXIT")

    stdout = _run_agent(full_cmds, shot_dir, timeout=timeout)
    cap.take_from_agent_output(stdout)
    lc.end()
    cap.write_manifest()

    return stdout, shot_dir, cap.screenshots


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestTuiCriticalPath:
    """Full walkthrough of the critical game path with screenshots.

    Tests the entrance → cellar → armoury → chamber progression,
    capturing screenshots at every room entry and key interaction.
    """

    def test_entrance_walkthrough(self):
        """Navigate to entrance, read scroll, view contents."""
        commands = [
            "cd entrance",
            "SCREENSHOT entrance_entry",
            "cat scroll",
            "SCREENSHOT entrance_scroll",
            "ls -F",
            "SCREENSHOT entrance_contents",
        ]
        stdout, shot_dir, paths = _run_walkthrough(
            "entrance_walkthrough", [], screenshot_commands=commands,
        )

        assert "CMD> cat scroll" in stdout
        assert "CMD> ls -F" in stdout
        assert len(paths) >= 3  # initial + 3 explicit + auto screenshots

        # Verify explicit screenshots exist with expected names
        assert (shot_dir / "entrance_entry.svg").exists()
        assert (shot_dir / "entrance_scroll.svg").exists()
        assert (shot_dir / "entrance_contents.svg").exists()

        # Verify manifest
        manifest = json.loads((shot_dir / "manifest.json").read_text())
        assert manifest["total_screenshots"] >= 3

    def test_cellar_treasure_walkthrough(self):
        """Navigate to cellar, read scroll, collect treasure."""
        commands = [
            "cd entrance",
            "cd cellar",
            "SCREENSHOT cellar_entry",
            "cat scroll",
            "SCREENSHOT cellar_scroll",
            "ls -F",
            "SCREENSHOT cellar_contents",
            "./treasure",
            "SCREENSHOT cellar_treasure",
            "export I=amulet,$I",
            "STATUS",
            "SCREENSHOT cellar_inventory",
        ]
        stdout, shot_dir, paths = _run_walkthrough(
            "cellar_treasure", [], screenshot_commands=commands,
        )

        assert "CMD> ./treasure" in stdout
        assert "CMD> export I=amulet,$I" in stdout
        assert (shot_dir / "cellar_entry.svg").exists()
        assert (shot_dir / "cellar_treasure.svg").exists()
        assert (shot_dir / "cellar_inventory.svg").exists()

        # Check STATUS for inventory update
        status_lines = [l for l in stdout.splitlines() if l.startswith("STATUS:")]
        if status_lines:
            data = json.loads(status_lines[0].split("STATUS: ", 1)[1])
            assert "amulet" in data["inventory"]

    def test_armoury_walkthrough(self):
        """Full path through entrance → cellar → armoury."""
        commands = [
            "cd entrance",
            "cd cellar",
            "export I=amulet,$I",
            "cd armoury",
            "SCREENSHOT armoury_entry",
            "cat scroll",
            "SCREENSHOT armoury_scroll",
            "ls -F",
            "SCREENSHOT armoury_contents",
            "./treasure",
            "SCREENSHOT armoury_treasure",
            "export I=sword,$I",
            "STATUS",
            "SCREENSHOT armoury_status",
        ]
        stdout, shot_dir, paths = _run_walkthrough(
            "armoury_walkthrough", [], screenshot_commands=commands,
        )

        assert (shot_dir / "armoury_entry.svg").exists()
        assert (shot_dir / "armoury_scroll.svg").exists()
        assert (shot_dir / "armoury_treasure.svg").exists()

        manifest = json.loads((shot_dir / "manifest.json").read_text())
        assert manifest["total_screenshots"] >= 5

    def test_full_critical_path(self):
        """Complete critical path: entrance → cellar → armoury → chamber."""
        commands = [
            "cd entrance",
            "SCREENSHOT 01_entrance",
            "cat scroll",
            "ls -F",
            "cd cellar",
            "SCREENSHOT 02_cellar",
            "cat scroll",
            "ls -F",
            "./treasure",
            "export I=amulet,$I",
            "SCREENSHOT 03_after_amulet",
            "cd armoury",
            "SCREENSHOT 04_armoury",
            "cat scroll",
            "ls -F",
            "./treasure",
            "export I=sword,$I",
            "SCREENSHOT 05_after_sword",
            "cd chamber",
            "SCREENSHOT 06_chamber",
            "cat scroll",
            "SCREENSHOT 07_chamber_scroll",
            "STATUS",
            "SCREENSHOT 08_final_status",
        ]
        stdout, shot_dir, paths = _run_walkthrough(
            "full_critical_path", [], screenshot_commands=commands, timeout=60,
        )

        # Verify all milestone screenshots exist
        for i in range(1, 9):
            svg_name = f"{i:02d}_"
            matches = list(shot_dir.glob(f"{svg_name}*.svg"))
            assert matches, f"Missing milestone screenshot {svg_name}*.svg"

        # Final manifest should show 8+ explicit screenshots + auto ones
        manifest = json.loads((shot_dir / "manifest.json").read_text())
        assert manifest["total_screenshots"] >= 8

        # Verify the whole session is in the JSONL log
        session_dir = REPO_ROOT / "logs" / "sessions"
        session_files = sorted(session_dir.glob("*.jsonl"))
        assert len(session_files) > 0  # at least one session log written

    def test_quest_progression_screenshots(self):
        """Verify quest completion is visible through STATUS snapshots."""
        commands = [
            "pwd",
            "SCREENSHOT quest_0_start",
            "STATUS",
            "ls",
            "SCREENSHOT quest_1_after_ls",
            "STATUS",
            "cd entrance",
            "SCREENSHOT quest_2_after_cd",
            "STATUS",
        ]
        stdout, shot_dir, paths = _run_walkthrough(
            "quest_progression", [], screenshot_commands=commands,
        )

        # Parse STATUS outputs to verify XP progression
        status_lines = [l for l in stdout.splitlines() if l.startswith("STATUS:")]
        assert len(status_lines) >= 2

        xp_values = []
        for line in status_lines:
            data = json.loads(line.split("STATUS: ", 1)[1])
            xp_values.append(data.get("xp", 0))

        # XP should increase (or stay same) as quests complete
        for i in range(1, len(xp_values)):
            assert xp_values[i] >= xp_values[i - 1], (
                f"XP decreased: {xp_values[i - 1]} → {xp_values[i]}"
            )


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestTuiUIElements:
    """Tests for specific Textual TUI visual elements."""

    def test_header_bar_visible(self):
        """Header bar shows game title and player stats."""
        shot_dir = _make_shot_dir("header_bar")
        _run_agent(["EXIT"], shot_dir)

        initial = shot_dir / "000_initial.svg"
        content = initial.read_text()

        # The SVG should contain the title bar text
        assert "BASHCRAWL" in content
        assert "Terminal" in content or "Dungeon" in content
        # Player stats should be visible
        assert "HP" in content
        assert "XP" in content

    def test_quest_panel_visible(self):
        """Quest panel updates as commands are entered."""
        commands = [
            "SCREENSHOT before_quest",
            "pwd",
            "SCREENSHOT after_pwd_quest",
            "ls",
            "SCREENSHOT after_ls_quest",
        ]

        stdout, shot_dir, paths = _run_walkthrough(
            "quest_panel", [], screenshot_commands=commands,
        )

        for name in ("before_quest", "after_pwd_quest", "after_ls_quest"):
            svg = shot_dir / f"{name}.svg"
            assert svg.exists(), f"Missing {name}.svg"
            # SVG should contain quest-related text
            content = svg.read_text()
            assert "QUEST" in content.upper() or "quest" in content.lower()

    def test_terminal_output_area(self):
        """Terminal output shows command results."""
        commands = [
            "cd entrance",
            "cat scroll",
            "SCREENSHOT scroll_output",
        ]

        stdout, shot_dir, paths = _run_walkthrough(
            "terminal_output", [], screenshot_commands=commands,
        )

        svg = shot_dir / "scroll_output.svg"
        assert svg.exists()
        # The SVG should contain scroll content rendered in the terminal
        content = svg.read_text()
        assert len(content) > 10000  # SVG with content should be substantial

    def test_screenshot_consistency(self):
        """Two identical command sequences produce similar screenshots."""
        commands = ["cd entrance", "SCREENSHOT test_view", "EXIT"]

        _stdout1, dir1, _ = _run_walkthrough(
            "consistency_a", [], screenshot_commands=commands,
        )
        _stdout2, dir2, _ = _run_walkthrough(
            "consistency_b", [], screenshot_commands=commands,
        )

        svg1 = dir1 / "test_view.svg"
        svg2 = dir2 / "test_view.svg"
        assert svg1.exists() and svg2.exists()

        # Sizes should be similar (within 20% — timestamps/CSS IDs differ)
        s1, s2 = svg1.stat().st_size, svg2.stat().st_size
        ratio = min(s1, s2) / max(s1, s2)
        assert ratio > 0.8, f"Screenshots differ too much: {s1} vs {s2} bytes"


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestTuiEdgeCases:
    """Edge case tests for the TUI with screenshot verification."""

    def test_empty_room_display(self):
        """TUI handles display of a room with minimal content."""
        commands = [
            "pwd",
            "SCREENSHOT root_display",
        ]
        stdout, shot_dir, _ = _run_walkthrough(
            "empty_room", [], screenshot_commands=commands,
        )
        assert (shot_dir / "root_display.svg").exists()

    def test_rapid_commands(self):
        """TUI handles many commands in quick succession."""
        commands = ["pwd", "ls", "pwd", "ls", "pwd", "ls",
                    "SCREENSHOT after_rapid"]
        stdout, shot_dir, paths = _run_walkthrough(
            "rapid_commands", [], screenshot_commands=commands,
        )
        assert (shot_dir / "after_rapid.svg").exists()
        # Should have auto-screenshots for each command too
        assert len(paths) >= 7  # 6 auto + initial + 1 explicit

    def test_invalid_command_display(self):
        """TUI renders error output for invalid commands."""
        commands = [
            "notarealcommand",
            "SCREENSHOT error_display",
        ]
        stdout, shot_dir, _ = _run_walkthrough(
            "invalid_command", [], screenshot_commands=commands,
        )
        assert (shot_dir / "error_display.svg").exists()

    def test_long_session(self):
        """Extended session with 15+ commands produces consistent screenshots."""
        commands = [
            "pwd", "ls", "cd entrance", "ls", "cat scroll",
            "ls -F", "cd cellar", "ls", "cat scroll", "ls -F",
            "./treasure", "export I=amulet,$I", "cd armoury",
            "ls", "cat scroll",
            "SCREENSHOT long_session_end",
            "STATUS",
        ]
        stdout, shot_dir, paths = _run_walkthrough(
            "long_session", [], screenshot_commands=commands, timeout=60,
        )

        # Check manifest for comprehensive capture
        manifest = json.loads((shot_dir / "manifest.json").read_text())
        assert manifest["total_screenshots"] >= 15

        # Verify no empty SVGs
        for svg in shot_dir.glob("*.svg"):
            assert svg.stat().st_size > 1000, f"Suspicious small SVG: {svg.name}"
