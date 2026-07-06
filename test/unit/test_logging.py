"""Unit tests for JSONL logging validation.

Tests the log event schema, session file parsing, and the
TestLogCapture utility used throughout the test framework.
"""

import json

import pytest

pytestmark = pytest.mark.unit


class TestJsonlValidation:
    """Tests for JSONL line validation."""

    def test_valid_line(self):
        from fixtures.log_capture import validate_jsonl_line
        line = '{"ts":"2026-02-16T10:00:00","sid":"12345678","event":"room_enter","room":"cellar"}'
        valid, msg = validate_jsonl_line(line)
        assert valid, msg

    def test_missing_ts(self):
        from fixtures.log_capture import validate_jsonl_line
        line = '{"sid":"12345678","event":"room_enter"}'
        valid, msg = validate_jsonl_line(line)
        assert not valid
        assert "ts" in msg

    def test_missing_event(self):
        from fixtures.log_capture import validate_jsonl_line
        line = '{"ts":"2026-02-16T10:00:00","sid":"12345678"}'
        valid, msg = validate_jsonl_line(line)
        assert not valid
        assert "event" in msg

    def test_invalid_json(self):
        from fixtures.log_capture import validate_jsonl_line
        valid, msg = validate_jsonl_line("not json at all")
        assert not valid
        assert "Invalid JSON" in msg

    def test_non_object_json(self):
        from fixtures.log_capture import validate_jsonl_line
        valid, msg = validate_jsonl_line("[1,2,3]")
        assert not valid
        assert "object" in msg


class TestSessionFileParsing:
    """Tests for session file reading."""

    def test_parse_valid_file(self, tmp_path):
        from fixtures.log_capture import parse_session_file
        path = tmp_path / "test.jsonl"
        lines = [
            '{"ts":"2026-02-16T10:00:00","sid":"TEST0001","event":"session_start","mode":"test"}',
            '{"ts":"2026-02-16T10:00:01","sid":"TEST0001","event":"room_enter","room":"entrance"}',
            '{"ts":"2026-02-16T10:00:02","sid":"TEST0001","event":"session_end","duration_sec":2}',
        ]
        path.write_text("\n".join(lines) + "\n")
        events = parse_session_file(path)
        assert len(events) == 3
        assert events[0].event == "session_start"
        assert events[1].event == "room_enter"
        assert events[1].extra.get("room") == "entrance"
        assert events[2].event == "session_end"

    def test_validate_session_file_errors(self, tmp_path):
        from fixtures.log_capture import validate_session_file
        path = tmp_path / "bad.jsonl"
        lines = [
            '{"ts":"2026-02-16T10:00:00","sid":"TEST0001","event":"room_enter"}',
            'not json',
            '{"sid":"TEST0001","event":"room_enter"}',  # missing ts
        ]
        path.write_text("\n".join(lines) + "\n")
        errors = validate_session_file(path)
        assert len(errors) == 2  # line 2 (invalid JSON) + line 3 (missing ts)


class TestLogCapture:
    """Tests for the TestLogCapture utility."""

    def test_capture_starts_session(self, tmp_path):
        from fixtures.log_capture import TestLogCapture
        capture = TestLogCapture(tmp_path, scenario="unit_test")
        capture.start()
        assert len(capture.events) == 1
        assert capture.events[0].event == "session_start"
        assert capture.events[0].extra["scenario"] == "unit_test"

    def test_capture_logs_events(self, tmp_path):
        from fixtures.log_capture import TestLogCapture
        capture = TestLogCapture(tmp_path, scenario="test")
        capture.start()
        capture.log_event("room_enter", room="entrance")
        capture.log_event("encounter", type="treasure", item="amulet", outcome="collected")
        assert len(capture.events) == 3  # session_start + 2 events

    def test_capture_end_writes_summary(self, tmp_path):
        from fixtures.log_capture import TestLogCapture
        capture = TestLogCapture(tmp_path, scenario="test")
        capture.start()
        capture.log_event("room_enter", room="entrance")
        capture.log_event("death", type="ghost", cause="combat")
        capture.end()
        end_event = capture.events[-1]
        assert end_event.event == "session_end"
        assert end_event.extra["rooms_visited"] == 1
        assert end_event.extra["deaths"] == 1

    def test_capture_writes_to_file(self, tmp_path):
        from fixtures.log_capture import TestLogCapture
        capture = TestLogCapture(tmp_path, scenario="test")
        capture.start()
        capture.log_event("room_enter", room="cellar")
        capture.end()
        assert capture.file_path.exists()
        content = capture.file_path.read_text()
        lines = [ln for ln in content.strip().split("\n") if ln]
        assert len(lines) == 3  # start + room + end
        for line in lines:
            data = json.loads(line)
            assert "ts" in data
            assert "sid" in data
            assert "event" in data

    def test_capture_get_rooms_visited(self, tmp_path):
        from fixtures.log_capture import TestLogCapture
        capture = TestLogCapture(tmp_path)
        capture.start()
        capture.log_event("room_enter", room="entrance")
        capture.log_event("room_enter", room="cellar")
        rooms = capture.get_rooms_visited()
        assert rooms == ["entrance", "cellar"]

    def test_capture_get_items_collected(self, tmp_path):
        from fixtures.log_capture import TestLogCapture
        capture = TestLogCapture(tmp_path)
        capture.start()
        capture.log_event("encounter", type="treasure", item="amulet", outcome="collected")
        capture.log_event("encounter", type="monster", outcome="victory")
        items = capture.get_items_collected()
        assert items == ["amulet"]


class TestExistingSessionFiles:
    """Tests that validate existing session log files in the repo."""

    def test_sample_session_valid(self, game_root):
        from fixtures.log_capture import validate_session_file
        sessions_dir = game_root / "logs" / "sessions"
        if not sessions_dir.exists():
            pytest.skip("No logs/sessions/ directory")
        session_files = list(sessions_dir.glob("*.jsonl"))
        if not session_files:
            pytest.skip("No session files found")
        # Validate the first session file
        errors = validate_session_file(session_files[0])
        assert errors == [], f"Session file {session_files[0].name} has errors: {errors}"
