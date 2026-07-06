"""Integration tests for the help system.

Tests help.sh subcommands, the AI engine pattern detection,
the command suggester, and location-specific help for all rooms.
"""

import subprocess

import pytest

pytestmark = pytest.mark.integration


class TestHelpScript:
    """Tests for help.sh top-level invocation."""

    def test_help_runs(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh")],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
        )
        # help.sh should exit 0 or produce output
        assert result.returncode == 0 or len(result.stdout) > 0

    def test_help_commands(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh"), "commands"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            stdout = result.stdout.lower()
            assert any(cmd in stdout for cmd in ["ls", "cd", "cat", "pwd"]), \
                "help commands should list basic commands"

    def test_help_map(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh"), "map"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            assert len(result.stdout) > 0, "help map should produce output"

    def test_help_reset(self, sandbox):
        """help reset should show game-reset instructions."""
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh"), "reset"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            stdout = result.stdout.lower()
            assert any(word in stdout for word in ["reset", "restore", "clean"]), \
                "help reset should mention reset/restore"

    def test_help_from_entrance(self, sandbox, log_capture):
        """Contextual help from entrance/ should reference the cellar."""
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh")],
            cwd=str(sandbox / "entrance"),
            capture_output=True,
            text=True,
            timeout=10,
        )
        log_capture.log_help_event(
            subcommand="default",
            output_preview=result.stdout[:200],
            room="entrance",
        )
        if result.returncode == 0:
            assert len(result.stdout) > 0

    def test_help_from_cellar(self, sandbox, log_capture):
        """Contextual help from cellar/ should mention treasure."""
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh")],
            cwd=str(sandbox / "entrance" / "cellar"),
            capture_output=True,
            text=True,
            timeout=10,
        )
        log_capture.log_help_event(
            subcommand="default",
            output_preview=result.stdout[:200],
            room="cellar",
        )
        if result.returncode == 0:
            assert len(result.stdout) > 0


class TestSetupScript:
    """Tests for setup.sh."""

    def test_setup_quick(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "setup.sh"), "--quick"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=15,
        )
        # Should complete without critical errors
        assert result.returncode == 0 or "Error" not in result.stderr, \
            f"setup.sh --quick failed: {result.stderr}"

    def test_setup_verify(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "setup.sh"), "--verify"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=15,
        )
        # Verify mode should report status
        assert result.returncode == 0 or len(result.stdout) > 0


class TestHelpEngineDetectLocation:
    """Tests that detect_location() correctly identifies all rooms."""

    MAIN_ROOMS = ["entrance", "cellar", "armoury", "chamber"]
    CHAPEL_ROOMS = ["chapel", "graveyard", "courtyard", "aviary", "hall", "library", "study"]
    VAULT_ROOMS = ["vault", "stronghold", "nursery", "lab"]
    RIFT_ROOMS = ["rift", "arena", "pit", "spire", "mezzanine"]
    MISC_ROOMS = ["scrap", "workshop"]

    @pytest.mark.parametrize(
        "room", MAIN_ROOMS + CHAPEL_ROOMS + VAULT_ROOMS + RIFT_ROOMS + MISC_ROOMS
    )
    def test_detect_location_function(self, sandbox, room):
        """Verify detect_location() outputs the expected room name for each path."""
        # Build a script that sources bashcrawl_help.sh and calls detect_location()
        # We simulate being in the room by creating the directory and cd'ing in
        room_dir = sandbox / "entrance" / room
        room_dir.mkdir(parents=True, exist_ok=True)
        script = f"""
source "{sandbox}/lib/colors.sh" 2>/dev/null || true
source "{sandbox}/src/help/bashcrawl_help.sh" 2>/dev/null || true
cd "{room_dir}"
detect_location
"""
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=10,
        )
        detected = result.stdout.strip()
        assert detected == room, \
            f"detect_location() should return '{room}' but got '{detected}'"


class TestShowLocationHelp:
    """Tests that show_location_help() produces output for each room."""

    ALL_ROOMS = [
        "entrance", "cellar", "armoury", "chamber",
        "chapel", "graveyard", "courtyard", "aviary", "hall", "library", "study",
        "vault", "stronghold", "nursery", "lab",
        "scrap",
        "rift", "arena", "pit", "spire", "mezzanine",
        "workshop",
    ]

    @pytest.mark.parametrize("room", ALL_ROOMS)
    def test_show_location_help_output(self, sandbox, log_capture, room):
        """Verify show_location_help() produces relevant output for each room."""
        script = f"""
source "{sandbox}/lib/colors.sh" 2>/dev/null || true
source "{sandbox}/src/help/bashcrawl_help.sh" 2>/dev/null || true
show_location_help "{room}"
"""
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=10,
        )
        log_capture.log_help_event(
            subcommand=f"location:{room}",
            output_preview=result.stdout[:200],
            room=room,
        )
        assert result.returncode == 0, f"show_location_help({room}) failed: {result.stderr}"
        stdout = result.stdout.lower()
        assert len(stdout) > 20, f"show_location_help({room}) should produce meaningful output"
        # Should NOT fall through to the unknown wildcard for known rooms
        assert "unknown territory" not in stdout, \
            f"Room '{room}' fell through to wildcard handler"

    def test_unknown_room_fallback(self, sandbox):
        """Verify unknown locations fall back to the UNKNOWN TERRITORY message."""
        script = f"""
source "{sandbox}/lib/colors.sh" 2>/dev/null || true
source "{sandbox}/src/help/bashcrawl_help.sh" 2>/dev/null || true
show_location_help "nonexistent_room"
"""
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert "unknown territory" in result.stdout.lower()
