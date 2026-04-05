"""Integration tests for native terminal (direct bash) walkthrough.

Runs walkthrough.json commands directly as bash subprocesses in a
sandbox, testing the raw game scripts without the TUI or engine layer.
This validates the game content itself works in a real shell.
"""

from __future__ import annotations

import os
import subprocess
import pytest
from pathlib import Path

from fixtures.skips import IS_WINDOWS
from fixtures.logical_paths import resolve_logical_path
from fixtures.walkthrough import load_walkthrough

pytestmark = pytest.mark.integration

_WT = load_walkthrough()


def _bash_run(
    sandbox: Path,
    command: str,
    cwd: Path,
    env: dict[str, str],
    stdin_input: str = "",
) -> subprocess.CompletedProcess:
    """Run a command via bash in the sandbox."""
    return subprocess.run(
        ["bash", "-c", command],
        cwd=str(cwd),
        env=env,
        input=stdin_input,
        capture_output=True,
        text=True,
        timeout=15,
    )


def _make_env(sandbox: Path) -> dict[str, str]:
    """Create a clean environment for native bash testing."""
    env = os.environ.copy()
    env["BASHCRAWL_ROOT"] = str(sandbox)
    env["HOME"] = str(sandbox)
    env.pop("I", None)
    env.pop("HP", None)
    return env


class TestNativeCriticalPath:
    """Walk the critical path using raw bash commands in a sandbox."""

    def test_entrance_scroll_readable(self, sandbox):
        """cat entrance/scroll should produce teaching content."""
        env = _make_env(sandbox)
        cwd = sandbox / "entrance"
        result = _bash_run(sandbox, "cat scroll", cwd, env)
        assert result.returncode == 0
        assert len(result.stdout) > 50, "Entrance scroll should have substantial content"

    def test_cellar_treasure_produces_output(self, sandbox):
        """Running cellar/treasure should mention amulet."""
        env = _make_env(sandbox)
        cwd = sandbox / "entrance" / "cellar"
        result = _bash_run(sandbox, "./treasure", cwd, env)
        assert "amulet" in result.stdout.lower()

    def test_armoury_treasure_produces_output(self, sandbox):
        """Running armoury/treasure should mention sword."""
        env = _make_env(sandbox)
        cwd = sandbox / "entrance" / "cellar" / "armoury"
        result = _bash_run(sandbox, "./treasure", cwd, env)
        assert "sword" in result.stdout.lower()

    def test_potion_interactive(self, sandbox):
        """Potion should respond to y input."""
        env = _make_env(sandbox)
        cwd = sandbox / "entrance" / "cellar" / "armoury"
        result = _bash_run(sandbox, "./potion", cwd, env, stdin_input="y\n")
        stdout = result.stdout.lower()
        assert any(w in stdout for w in ("hp", "health", "15", "potion"))

    def test_statue_with_equipment(self, sandbox):
        """Statue combat with sword and HP."""
        env = _make_env(sandbox)
        env["I"] = "sword,amulet,"
        env["HP"] = "15"
        cwd = sandbox / "entrance" / "cellar" / "armoury" / "chamber"
        result = _bash_run(sandbox, "./statue", cwd, env, stdin_input="y\ny\n")
        assert result.returncode in (0, 1)
        assert len(result.stdout) > 0
        assert "diamonds" in result.stdout.lower(), \
            "Statue with sword should yield diamonds"


class TestNativeScrollReadability:
    """All scrolls readable via cat in native bash."""

    @pytest.mark.parametrize("room_path", _WT.rooms_with_scrolls())
    def test_scroll_cat_succeeds(self, game_root, room_path):
        """cat <room>/scroll should exit 0 and produce content.

        Existence/coverage checks live in TestScrollFiles + walkthrough validator;
        this test focuses only on runtime readability via native `cat`.
        """
        base = resolve_logical_path(game_root, room_path)
        scroll_path = (base / "scroll") if base else (game_root / room_path / "scroll")
        env = os.environ.copy()
        result = subprocess.run(
            ["cat", str(scroll_path)],
            capture_output=True, text=True, timeout=5,
        )
        assert result.returncode == 0
        assert len(result.stdout) > 10


class TestNativeScriptExecutability:
    """All game scripts are executable in native bash."""

    @pytest.mark.skipif(IS_WINDOWS, reason="os.access(X_OK) is always True on Windows")
    @pytest.mark.parametrize("enc_path", list(_WT.encounters.keys()))
    def test_script_is_executable(self, game_root, enc_path):
        """Game scripts should have executable permission."""
        script = resolve_logical_path(game_root, enc_path)
        if script is None or not script.exists():
            pytest.skip(f"Script not found: {enc_path}")
        assert os.access(str(script), os.X_OK), \
            f"{enc_path} should be executable (chmod +x)"
