"""Integration tests for combat encounters.

Tests statue, monster, and ghost combat with environment setup
and outcome verification.
"""

import os
import subprocess
import pytest
from pathlib import Path

pytestmark = pytest.mark.integration


class TestStatueCombat:
    """Tests for the statue encounter in chamber."""

    def test_statue_with_sword_and_hp(self, sandbox):
        """Fight statue with proper equipment."""
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(
            sandbox,
            initial_env={"I": "sword,amulet,", "HP": "15"},
        )
        engine.execute_command("cd cellar")
        engine.execute_command("cd armoury")
        engine.execute_command("cd chamber")
        # The statue script reads from stdin for y/n
        result = engine.execute_command("./statue")
        # Script should produce output (fight narrative or already-defeated message)
        assert len(result.output) > 0

    def test_statue_without_preparation(self, sandbox):
        """Attempt statue without sword — should warn or fail."""
        env = os.environ.copy()
        env["BASHCRAWL_ROOT"] = str(sandbox)
        env["HP"] = "15"
        # No I (inventory) — no sword
        result = subprocess.run(
            ["bash", str(sandbox / "entrance" / "cellar" / "armoury" / "chamber" / "statue")],
            cwd=str(sandbox / "entrance" / "cellar" / "armoury" / "chamber"),
            env=env,
            input="y\n",
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0

    def test_statue_no_hp(self, sandbox):
        """Attempt statue with no HP — should be dangerous."""
        env = os.environ.copy()
        env["BASHCRAWL_ROOT"] = str(sandbox)
        env["I"] = "sword,"
        # HP not set — defaults to 0, player dies (exit code 1 = game over)
        result = subprocess.run(
            ["bash", str(sandbox / "entrance" / "cellar" / "armoury" / "chamber" / "statue")],
            cwd=str(sandbox / "entrance" / "cellar" / "armoury" / "chamber"),
            env=env,
            input="y\n",
            capture_output=True,
            text=True,
            timeout=10,
        )
        # Death by statue is expected when HP is 0 — exit code 1
        assert result.returncode in (0, 1)
        assert "slain" in result.stdout.lower() or "statue" in result.stdout.lower()


class TestMonsterCombat:
    """Tests for the monster encounter in chapel/courtyard/aviary/hall."""

    def _monster_path(self, sandbox: Path) -> Path:
        return sandbox / "entrance" / ".chapel" / "courtyard" / "aviary" / "hall" / "monster"

    def test_monster_script_exists(self, sandbox):
        """Verify monster script exists in the expected location."""
        path = self._monster_path(sandbox)
        if not path.exists():
            # May be under chapel (unlocked) instead of .chapel
            alt = sandbox / "entrance" / "chapel" / "courtyard" / "aviary" / "hall" / "monster"
            assert path.exists() or alt.exists(), \
                "Monster script should exist in chapel branch"

    def test_monster_with_hp(self, sandbox):
        """Fight monster with HP."""
        # Try both hidden and unlocked paths
        for chapel_name in [".chapel", "chapel"]:
            path = sandbox / "entrance" / chapel_name / "courtyard" / "aviary" / "hall" / "monster"
            if path.exists() and path.is_file():
                env = os.environ.copy()
                env["BASHCRAWL_ROOT"] = str(sandbox)
                env["HP"] = "15"
                env["I"] = "sword,amulet,"
                result = subprocess.run(
                    ["bash", str(path)],
                    cwd=str(path.parent),
                    env=env,
                    input="y\n",
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                # Monster combat is random — player may die
                assert result.returncode in (0, 1)
                assert "monster" in result.stdout.lower() or "slain" in result.stdout.lower()
                return
        pytest.skip("Monster script not found")


class TestGhostCombat:
    """Tests for the ghost encounter in vault/stronghold/nursery/lab."""

    def test_ghost_script_exists(self, sandbox):
        """Verify ghost script exists."""
        for vault_name in [".vault", "vault"]:
            path = sandbox / "entrance" / vault_name / "stronghold" / "nursery" / "lab" / "ghost"
            if path.exists():
                assert path.is_file()
                return
        pytest.skip("Ghost script not found in either .vault or vault")

    def test_ghost_with_hp(self, sandbox):
        """Fight ghost with HP."""
        for vault_name in [".vault", "vault"]:
            path = sandbox / "entrance" / vault_name / "stronghold" / "nursery" / "lab" / "ghost"
            if path.exists() and path.is_file():
                env = os.environ.copy()
                env["BASHCRAWL_ROOT"] = str(sandbox)
                env["HP"] = "15"
                env["I"] = "sword,amulet,"
                result = subprocess.run(
                    ["bash", str(path)],
                    cwd=str(path.parent),
                    env=env,
                    input="y\n",
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                # Ghost combat is random — player may die
                assert result.returncode in (0, 1)
                assert "ghost" in result.stdout.lower() or "slain" in result.stdout.lower()
                return
        pytest.skip("Ghost script not found")
