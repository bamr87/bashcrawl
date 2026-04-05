"""Unit tests for screenshot capture and logging integration.

Tests the ScreenshotCapture helper, TestLogCapture screenshot events,
and the bash ``bc_log_screenshot`` function.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from fixtures.skips import requires_bash

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# ScreenshotCapture tests
# ---------------------------------------------------------------------------


class TestScreenshotCapture:
    """Tests for fixtures.screenshot_capture.ScreenshotCapture."""

    def _make_capture(self, tmp_path, log_capture=None):
        from fixtures.screenshot_capture import ScreenshotCapture

        d = tmp_path / "shots"
        d.mkdir(exist_ok=True)
        return ScreenshotCapture(screenshot_dir=d, log_capture=log_capture)

    def test_initial_state(self, tmp_path):
        cap = self._make_capture(tmp_path)
        assert cap.count == 0
        assert cap.screenshots == []

    def test_record_external_path(self, tmp_path):
        """record() should track an existing file without saving."""
        cap = self._make_capture(tmp_path)
        svg = tmp_path / "external.svg"
        svg.write_text("<svg>test</svg>")
        cap.record(svg, trigger="manual", command="ls")
        assert cap.count == 1
        assert cap.screenshots[0] == svg

    def test_record_logs_to_capture(self, tmp_path):
        from fixtures.log_capture import TestLogCapture

        lc = TestLogCapture(tmp_path / "logs", scenario="test")
        lc.start()
        cap = self._make_capture(tmp_path, log_capture=lc)
        svg = tmp_path / "shot.svg"
        svg.write_text("<svg></svg>")
        cap.record(svg, trigger="test", command="pwd", room="entrance")

        screenshots = lc.get_screenshots()
        assert len(screenshots) == 1
        assert screenshots[0]["trigger"] == "test"
        assert screenshots[0]["command"] == "pwd"
        assert screenshots[0]["room"] == "entrance"
        assert screenshots[0]["path"] == str(svg)

    def test_auto_naming_counter(self, tmp_path):
        """take() should auto-increment filenames when no name given."""
        from unittest.mock import MagicMock

        cap = self._make_capture(tmp_path)
        app = MagicMock()
        # Simulate save_screenshot by creating the file
        def fake_save(path):
            Path(path).write_text("<svg>fake</svg>")
        app.save_screenshot = fake_save

        p1 = cap.take(app)
        p2 = cap.take(app)
        assert "001_screenshot" in p1.name
        assert "002_screenshot" in p2.name
        assert cap.count == 2

    def test_take_with_custom_name(self, tmp_path):
        from unittest.mock import MagicMock

        cap = self._make_capture(tmp_path)
        app = MagicMock()
        def fake_save(path):
            Path(path).write_text("<svg>named</svg>")
        app.save_screenshot = fake_save

        p = cap.take(app, name="after_cd", command="cd cellar", room="cellar")
        assert p.name == "after_cd.svg"
        assert p.exists()

    def test_take_logs_screenshot_event(self, tmp_path):
        from unittest.mock import MagicMock
        from fixtures.log_capture import TestLogCapture

        lc = TestLogCapture(tmp_path / "logs", scenario="test")
        lc.start()
        cap = self._make_capture(tmp_path, log_capture=lc)
        app = MagicMock()
        def fake_save(path):
            Path(path).write_text("<svg>data</svg>")
        app.save_screenshot = fake_save

        cap.take(app, name="test_shot", command="ls", room="entrance", trigger="auto")

        events = lc.get_events_by_type("screenshot")
        assert len(events) == 1
        assert events[0].extra["trigger"] == "auto"
        assert events[0].extra["command"] == "ls"

    def test_take_from_agent_output(self, tmp_path):
        """take_from_agent_output should parse SCREENSHOT: lines."""
        cap = self._make_capture(tmp_path)
        # Create fake files that the "agent" would have produced
        svg1 = tmp_path / "001_ls.svg"
        svg2 = tmp_path / "002_cd_cellar.svg"
        svg1.write_text("<svg>1</svg>")
        svg2.write_text("<svg>2</svg>")

        agent_stdout = f"""READY>
Some game output here
SCREENSHOT: {svg1}
More output
SCREENSHOT: {svg2}
READY>
"""
        paths = cap.take_from_agent_output(agent_stdout)
        assert len(paths) == 2
        assert cap.count == 2
        assert paths[0] == svg1
        assert paths[1] == svg2

    def test_take_from_agent_output_no_screenshots(self, tmp_path):
        cap = self._make_capture(tmp_path)
        paths = cap.take_from_agent_output("READY>\nSome output\nREADY>\n")
        assert paths == []
        assert cap.count == 0


# ---------------------------------------------------------------------------
# TestLogCapture screenshot integration
# ---------------------------------------------------------------------------


class TestLogCaptureScreenshots:
    """Tests for screenshot event support in TestLogCapture."""

    def test_screenshot_is_valid_event(self):
        from fixtures.log_capture import VALID_EVENTS
        assert "screenshot" in VALID_EVENTS

    def test_log_screenshot_basic(self, tmp_path):
        from fixtures.log_capture import TestLogCapture

        lc = TestLogCapture(tmp_path, scenario="test")
        lc.start()
        svg = tmp_path / "shot.svg"
        svg.write_text("<svg>x</svg>")
        lc.log_screenshot(path=svg, trigger="auto", command="pwd", room="entrance")

        events = lc.get_events_by_type("screenshot")
        assert len(events) == 1
        e = events[0]
        assert e.extra["screenshot_path"] == str(svg)
        assert e.extra["trigger"] == "auto"
        assert e.extra["command"] == "pwd"
        assert e.extra["room"] == "entrance"
        assert e.extra["size_bytes"] > 0

    def test_log_screenshot_missing_file(self, tmp_path):
        """log_screenshot should work even if the file doesn't exist."""
        from fixtures.log_capture import TestLogCapture

        lc = TestLogCapture(tmp_path, scenario="test")
        lc.start()
        lc.log_screenshot(path="/nonexistent/shot.svg", trigger="test")
        events = lc.get_events_by_type("screenshot")
        assert len(events) == 1
        assert "size_bytes" not in events[0].extra

    def test_get_screenshots_accessor(self, tmp_path):
        from fixtures.log_capture import TestLogCapture

        lc = TestLogCapture(tmp_path, scenario="test")
        lc.start()
        for i in range(3):
            svg = tmp_path / f"shot{i}.svg"
            svg.write_text(f"<svg>{i}</svg>")
            lc.log_screenshot(path=svg, trigger="auto", command=f"cmd{i}", room=f"room{i}")

        screenshots = lc.get_screenshots()
        assert len(screenshots) == 3
        assert screenshots[0]["command"] == "cmd0"
        assert screenshots[2]["room"] == "room2"

    def test_session_end_includes_screenshot_count(self, tmp_path):
        from fixtures.log_capture import TestLogCapture

        lc = TestLogCapture(tmp_path, scenario="test")
        lc.start()
        svg = tmp_path / "s.svg"
        svg.write_text("<svg/>")
        lc.log_screenshot(path=svg, trigger="auto")
        lc.log_screenshot(path=svg, trigger="auto")
        lc.end()

        end_event = lc.events[-1]
        assert end_event.event == "session_end"
        assert end_event.extra["screenshots_captured"] == 2

    def test_screenshot_events_in_jsonl_file(self, tmp_path):
        """Screenshot events should be persisted to the JSONL file."""
        from fixtures.log_capture import TestLogCapture

        lc = TestLogCapture(tmp_path, scenario="test")
        lc.start()
        svg = tmp_path / "x.svg"
        svg.write_text("<svg>file</svg>")
        lc.log_screenshot(path=svg, trigger="manual", command="cat scroll")
        lc.end()

        lines = [l for l in lc.file_path.read_text().strip().splitlines() if l]
        screenshot_lines = [
            json.loads(l) for l in lines if '"event":"screenshot"' in l or '"event": "screenshot"' in l
        ]
        # Fallback: parse all and filter
        if not screenshot_lines:
            screenshot_lines = [
                json.loads(l) for l in lines if json.loads(l).get("event") == "screenshot"
            ]
        assert len(screenshot_lines) == 1
        assert screenshot_lines[0]["trigger"] == "manual"


# ---------------------------------------------------------------------------
# conftest fixture tests
# ---------------------------------------------------------------------------


class TestScreenshotFixtures:
    """Tests that the pytest fixtures are properly wired."""

    def test_screenshot_dir_exists(self, screenshot_dir):
        assert screenshot_dir.exists()
        assert screenshot_dir.is_dir()
        # Should be under logs/screenshots/
        assert "logs" in str(screenshot_dir)
        assert "screenshots" in str(screenshot_dir)

    def test_screenshot_capture_fixture(self, screenshot_capture):
        assert screenshot_capture is not None
        assert screenshot_capture.count == 0

    def test_screenshot_capture_records_to_log(self, screenshot_capture, log_capture, screenshot_dir):
        svg = screenshot_dir / "test.svg"
        svg.write_text("<svg>fixture test</svg>")
        screenshot_capture.record(svg, trigger="fixture_test", command="test")
        assert screenshot_capture.count == 1

        screenshots = log_capture.get_screenshots()
        assert len(screenshots) == 1
        assert screenshots[0]["trigger"] == "fixture_test"

    def test_manifest_written_on_teardown(self, tmp_path):
        """write_manifest creates a JSON manifest of all captures."""
        from fixtures.screenshot_capture import ScreenshotCapture

        d = tmp_path / "shots"
        d.mkdir()
        cap = ScreenshotCapture(screenshot_dir=d)
        svg = d / "test.svg"
        svg.write_text("<svg>manifest test</svg>")
        cap.record(svg, trigger="test", command="pwd", room="entrance")

        manifest_path = cap.write_manifest()
        assert manifest_path is not None
        assert manifest_path.exists()

        import json
        manifest = json.loads(manifest_path.read_text())
        assert manifest["total_screenshots"] == 1
        assert len(manifest["screenshots"]) == 1
        assert manifest["screenshots"][0]["command"] == "pwd"


# ---------------------------------------------------------------------------
# Bash bc_log_screenshot tests
# ---------------------------------------------------------------------------


@requires_bash
@pytest.mark.bash
class TestBashLogScreenshot:
    """Tests for lib/log.sh bc_log_screenshot function."""

    def test_bc_log_screenshot_creates_event(self, game_root, tmp_path):
        """Calling bc_log_screenshot should write a screenshot JSONL event."""
        log_dir = tmp_path / "logs" / "sessions"
        log_dir.mkdir(parents=True)

        # Create a fake SVG file to reference
        svg = tmp_path / "test_shot.svg"
        svg.write_text("<svg>test</svg>")

        # Source log.sh first, then override _BC_LOG_DIR (sourcing sets it)
        script = f"""
export BASHCRAWL_ROOT="{game_root}"
source "{game_root}/lib/log.sh"
_BC_LOG_DIR="{log_dir}"
bc_session_start "test"
bc_log_screenshot "{svg}" "manual" "cat scroll"
bc_session_end
"""
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"

        # Find the session file
        session_files = list(log_dir.glob("*.jsonl"))
        assert len(session_files) == 1, f"Expected 1 session file, found {len(session_files)}"

        lines = [l.strip() for l in session_files[0].read_text().strip().splitlines() if l.strip()]
        events = [json.loads(l) for l in lines]

        screenshot_events = [e for e in events if e.get("event") == "screenshot"]
        assert len(screenshot_events) == 1
        se = screenshot_events[0]
        assert se["screenshot_path"] == str(svg)
        assert se["trigger"] == "manual"
        assert se["command"] == "cat scroll"
        assert "size_bytes" in se

    def test_bc_log_screenshot_counted_in_session_end(self, game_root, tmp_path):
        """bc_session_end should include screenshots_captured count."""
        log_dir = tmp_path / "logs" / "sessions"
        log_dir.mkdir(parents=True)
        svg = tmp_path / "s.svg"
        svg.write_text("<svg/>")

        script = f"""
export BASHCRAWL_ROOT="{game_root}"
source "{game_root}/lib/log.sh"
_BC_LOG_DIR="{log_dir}"
bc_session_start "test"
bc_log_screenshot "{svg}" "auto" "ls"
bc_log_screenshot "{svg}" "auto" "pwd"
bc_session_end
"""
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"

        session_files = list(log_dir.glob("*.jsonl"))
        lines = [l.strip() for l in session_files[0].read_text().strip().splitlines() if l.strip()]
        events = [json.loads(l) for l in lines]

        end_events = [e for e in events if e.get("event") == "session_end"]
        assert len(end_events) == 1
        assert end_events[0]["screenshots_captured"] == 2

    def test_bc_log_screenshot_noop_when_off(self, game_root, tmp_path):
        """bc_log_screenshot should be a no-op when BASHCRAWL_LOG=off."""
        log_dir = tmp_path / "logs" / "sessions"
        log_dir.mkdir(parents=True)

        script = f"""
export BASHCRAWL_LOG=off
export BASHCRAWL_ROOT="{game_root}"
source "{game_root}/lib/log.sh"
_BC_LOG_DIR="{log_dir}"
bc_log_screenshot "{tmp_path}/s.svg" "auto" "ls"
"""
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0
        session_files = list(log_dir.glob("*.jsonl"))
        assert len(session_files) == 0
