"""Walkthrough-driven TUI tests with screenshot capture.

Parameterized from ``test/datasets/walkthrough.json`` — the solutions manual.
Runs game commands through the Textual agent TUI, capturing SVG screenshots
named by each walkthrough step's ``screenshot_name`` field.

Results layout::

    logs/
        sessions/<date>_<sid>.jsonl      — JSONL event stream
        screenshots/<date>_<test>/       — per-test screenshot dir
            001_entrance_pwd.svg
            002_entrance_ls.svg
            ...
            manifest.json               — structured index with walkthrough step refs
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from fixtures.walkthrough import Walkthrough, load_walkthrough

_IS_WINDOWS = sys.platform == "win32"

# Walkthrough tests run ti.agent with long subprocess timeouts; CI passes
# --timeout=60 on integration, which is too low for some steps. Allow 180s per test.
# Windows: skip entirely — many agent subprocesses × long timeouts makes the job
# appear to hang; headless Textual on Windows is not a supported target.
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        _IS_WINDOWS,
        reason="TUI walkthrough skipped on Windows CI (slow/fragile); covered on Linux/macOS",
    ),
    pytest.mark.timeout(180),
]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"

# Module-level walkthrough for parametrize decorators (loaded once)
_WT = load_walkthrough()


def _has_textual() -> bool:
    try:
        import textual  # noqa: F401
        return True
    except ImportError:
        return False


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


def _build_walkthrough_commands(steps: list[dict]) -> list[str]:
    """Convert walkthrough steps into TUI agent commands with SCREENSHOT calls.

    Interactive commands (those with stdin fields) are skipped since
    the TUI agent can't provide stdin to game scripts.
    """
    cmds: list[str] = []
    for step in steps:
        cmd = step["command"]
        # Skip interactive commands — the TUI agent can't pipe stdin to scripts
        if step.get("stdin"):
            continue
        cmds.append(cmd)
        # Insert a named screenshot after each step
        if "screenshot_name" in step:
            cmds.append(f"SCREENSHOT {step['screenshot_name']}")
    cmds.append("EXIT")
    return cmds


def _run_walkthrough(
    name: str,
    steps: list[dict],
    shot_dir: Path,
    timeout: int = 45,
) -> tuple[str, Path, list[Path], dict]:
    """Run a named walkthrough driven by walkthrough.json steps.

    Returns (stdout, shot_dir, svg_paths, manifest_data).
    """
    from fixtures.screenshot_capture import ScreenshotCapture
    from fixtures.log_capture import TestLogCapture

    log_dir = REPO_ROOT / "logs" / "sessions"
    log_dir.mkdir(parents=True, exist_ok=True)

    lc = TestLogCapture(log_dir, scenario="tui_walkthrough", test_name=name)
    lc.start()
    cap = ScreenshotCapture(screenshot_dir=shot_dir, log_capture=lc)

    cmds = _build_walkthrough_commands(steps)
    stdout = _run_agent(cmds, shot_dir, timeout=timeout)
    cap.take_from_agent_output(stdout)
    lc.end()

    # Enrich manifest with walkthrough step references
    for meta_entry in cap.metadata:
        svg_stem = Path(meta_entry.get("name", "")).stem
        matching = [s for s in steps if s.get("screenshot_name") == svg_stem]
        if matching:
            meta_entry["walkthrough_step_id"] = matching[0]["step_id"]
            meta_entry["walkthrough_room"] = matching[0]["room"]

    cap.write_manifest()
    manifest_data = json.loads((shot_dir / "manifest.json").read_text())

    return stdout, shot_dir, cap.screenshots, manifest_data


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestTuiCriticalPath:
    """Full critical path walkthrough driven by walkthrough.json."""

    def test_full_critical_path(self, screenshot_dir):
        """Walk the complete critical path, screenshot every step."""
        steps = _WT.critical_path_steps()
        stdout, shot_dir, paths, manifest = _run_walkthrough(
            "full_critical_path_walkthrough", steps, screenshot_dir, timeout=90,
        )

        # Every step with a screenshot_name (and no stdin) should produce an SVG
        expected_shots = [
            s["screenshot_name"] for s in steps
            if "screenshot_name" in s and not s.get("stdin")
        ]
        for name in expected_shots:
            assert (shot_dir / f"{name}.svg").exists(), f"Missing screenshot: {name}.svg"

        assert manifest["total_screenshots"] >= len(expected_shots)

        # Verify commands were echoed to stdout (TUI renders output in
        # screenshots, not in stdout — so we check CMD> lines instead)
        # Skip interactive commands (stdin) that are omitted from agent input
        for step in steps:
            if step.get("stdin"):
                continue
            cmd = step["command"]
            assert f"CMD> {cmd}" in stdout, (
                f"Step {step['step_id']}: expected 'CMD> {cmd}' in agent output"
            )

    def test_quest_progression_via_status(self, screenshot_dir):
        """Walk critical path with STATUS checks after quest-completing steps."""
        quest_steps = [s for s in _WT.critical_path_steps() if s.get("quest_completed")]
        # Build commands: game command → STATUS after each quest step
        cmds: list[str] = []
        for step in _WT.critical_path_steps():
            cmds.append(step["command"])
            if step.get("quest_completed"):
                cmds.append("STATUS")
                cmds.append(f"SCREENSHOT quest_{step['quest_completed']['id']}")
        cmds.append("EXIT")

        stdout = _run_agent(cmds, screenshot_dir, timeout=60)

        # XP should be non-decreasing
        status_lines = [l for l in stdout.splitlines() if l.startswith("STATUS:")]
        xp_values = []
        for line in status_lines:
            data = json.loads(line.split("STATUS: ", 1)[1])
            xp_values.append(data.get("xp", 0))

        for i in range(1, len(xp_values)):
            assert xp_values[i] >= xp_values[i - 1], (
                f"XP decreased: {xp_values[i - 1]} → {xp_values[i]}"
            )


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestTuiHiddenPaths:
    """Hidden path walkthroughs driven by walkthrough.json."""

    @pytest.mark.parametrize("area", _WT.hidden_path_names())
    def test_hidden_path(self, area: str, screenshot_dir):
        """Walk a hidden area path with screenshots."""
        # Must first walk critical path to unlock hidden areas
        cp_steps = _WT.critical_path_steps()
        hidden_steps = _WT.hidden_path_steps(area)
        all_steps = cp_steps + hidden_steps

        stdout, shot_dir, paths, manifest = _run_walkthrough(
            f"hidden_{area}_walkthrough", all_steps, screenshot_dir, timeout=120,
        )

        # Check hidden-area-specific screenshots exist
        expected_shots = [
            s["screenshot_name"] for s in hidden_steps
            if "screenshot_name" in s and not s.get("stdin")
        ]
        for name in expected_shots:
            assert (shot_dir / f"{name}.svg").exists(), f"Missing screenshot: {name}.svg"


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestTuiUIElements:
    """Tests for specific Textual TUI visual elements."""

    def test_header_bar_visible(self, screenshot_dir):
        """Header bar shows game title and player stats."""
        _run_agent(["EXIT"], screenshot_dir)

        initial = screenshot_dir / "000_initial.svg"
        content = initial.read_text()

        assert "BASHCRAWL" in content
        assert "Terminal" in content or "Dungeon" in content
        assert "HP" in content
        assert "XP" in content

    def test_quest_panel_visible(self, screenshot_dir):
        """Quest panel updates as commands are entered."""
        commands = [
            "SCREENSHOT before_quest",
            "pwd",
            "SCREENSHOT after_pwd_quest",
            "ls",
            "SCREENSHOT after_ls_quest",
            "EXIT",
        ]

        stdout = _run_agent(commands, screenshot_dir)

        for name in ("before_quest", "after_pwd_quest", "after_ls_quest"):
            svg = screenshot_dir / f"{name}.svg"
            assert svg.exists(), f"Missing {name}.svg"
            content = svg.read_text()
            assert "QUEST" in content.upper() or "quest" in content.lower()

    def test_terminal_output_area(self, screenshot_dir):
        """Terminal output shows command results."""
        commands = [
            "cd entrance",
            "cat scroll",
            "SCREENSHOT scroll_output",
            "EXIT",
        ]

        stdout = _run_agent(commands, screenshot_dir)

        svg = screenshot_dir / "scroll_output.svg"
        assert svg.exists()
        content = svg.read_text()
        assert len(content) > 10000  # SVG with content should be substantial

    def test_screenshot_consistency(self, screenshot_dir):
        """Two identical command sequences produce similar screenshots."""
        commands = ["cd entrance", "SCREENSHOT test_view", "EXIT"]

        dir1 = screenshot_dir / "run_a"
        dir1.mkdir(exist_ok=True)
        stdout1 = _run_agent(commands, dir1)
        dir2 = screenshot_dir / "run_b"
        dir2.mkdir(exist_ok=True)
        stdout2 = _run_agent(commands, dir2)

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

    def test_empty_room_display(self, screenshot_dir):
        """TUI handles display of a room with minimal content."""
        commands = ["pwd", "SCREENSHOT root_display", "EXIT"]
        _run_agent(commands, screenshot_dir)
        assert (screenshot_dir / "root_display.svg").exists()

    def test_rapid_commands(self, screenshot_dir):
        """TUI handles many commands in quick succession."""
        commands = ["pwd", "ls", "pwd", "ls", "pwd", "ls",
                    "SCREENSHOT after_rapid", "EXIT"]
        _run_agent(commands, screenshot_dir)
        assert (screenshot_dir / "after_rapid.svg").exists()

    def test_invalid_command_display(self, screenshot_dir):
        """TUI renders error output for invalid commands."""
        commands = ["notarealcommand", "SCREENSHOT error_display", "EXIT"]
        _run_agent(commands, screenshot_dir)
        assert (screenshot_dir / "error_display.svg").exists()

    def test_long_session(self, screenshot_dir):
        """Extended session with 15+ commands produces consistent screenshots."""
        commands = [
            "pwd", "ls", "cd entrance", "ls", "cat scroll",
            "ls -F", "cd cellar", "ls", "cat scroll", "ls -F",
            "./treasure", "export I=amulet,$I", "cd armoury",
            "ls", "cat scroll",
            "SCREENSHOT long_session_end",
            "STATUS",
            "EXIT",
        ]
        _run_agent(commands, screenshot_dir, timeout=60)

        assert (screenshot_dir / "long_session_end.svg").exists()
