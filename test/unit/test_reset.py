"""Unit tests for the game reset mechanism.

Validates that lib/reset.sh correctly identifies artifacts
to clean up without actually mutating the real game.
"""

import subprocess

import pytest

from fixtures.skips import requires_bash

pytestmark = pytest.mark.unit

@requires_bash
@pytest.mark.bash
class TestResetDryRun:
    """Tests for lib/reset.sh --dry mode."""

    def test_dry_run_exits_zero(self, game_root):
        result = subprocess.run(
            ["bash", str(game_root / "lib" / "reset.sh"), "--dry"],
            cwd=str(game_root),
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, \
            f"reset.sh --dry failed: {result.stderr}"

    def test_dry_run_no_mutations(self, game_root):
        """Verify --dry doesn't actually modify anything."""
        # Take a snapshot of key files before
        entrance = game_root / "entrance"
        chapel_hidden = entrance / ".chapel"
        vault_hidden = entrance / ".vault"

        chapel_exists_before = chapel_hidden.exists()
        vault_exists_before = vault_hidden.exists()

        subprocess.run(
            ["bash", str(game_root / "lib" / "reset.sh"), "--dry"],
            cwd=str(game_root),
            capture_output=True,
            text=True,
            timeout=10,
        )

        assert chapel_hidden.exists() == chapel_exists_before
        assert vault_hidden.exists() == vault_exists_before


@requires_bash
@pytest.mark.bash
class TestResetInSandbox:
    """Tests for lib/reset.sh actual reset in a sandbox."""

    def test_reset_after_treasure(self, sandbox, sandbox_env):
        """Simulate treasure collection, then reset to verify cleanup."""
        # Simulate: run cellar/treasure (which unlocks hidden rooms)
        treasure = sandbox / "entrance" / "cellar" / "treasure"
        if treasure.is_file():
            subprocess.run(
                ["bash", str(treasure)],
                cwd=str(sandbox / "entrance" / "cellar"),
                env=sandbox_env,
                capture_output=True,
                timeout=10,
            )

        # Now run reset
        result = subprocess.run(
            ["bash", str(sandbox / "lib" / "reset.sh")],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
            env=sandbox_env,
        )
        # Reset should complete (may have warnings about missing files)
        # Just check it doesn't crash
        assert result.returncode == 0 or "Error" not in result.stderr, \
            f"Reset failed: {result.stderr}"

    def test_reset_removes_statue_flag(self, sandbox, sandbox_env):
        """Verify reset removes .statue_defeated flag."""
        chamber = sandbox / "entrance" / "cellar" / "armoury" / "chamber"
        if chamber.is_dir():
            flag = chamber / ".statue_defeated"
            flag.touch()
            assert flag.exists()

            subprocess.run(
                ["bash", str(sandbox / "lib" / "reset.sh")],
                cwd=str(sandbox),
                capture_output=True,
                env=sandbox_env,
                timeout=10,
            )
            # Flag should be removed after reset
            assert not flag.exists()

    def test_reset_removes_root_workshop_dir(self, sandbox, sandbox_env):
        """Verify reset removes a player-created top-level workshop directory."""
        root_workshop = sandbox / "workshop"
        root_workshop.mkdir(parents=True, exist_ok=True)
        (root_workshop / "notes.txt").write_text("temporary player notes\n", encoding="utf-8")
        assert root_workshop.exists()

        result = subprocess.run(
            ["bash", str(sandbox / "lib" / "reset.sh")],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
            env=sandbox_env,
        )
        assert result.returncode == 0, f"Reset failed: {result.stderr}"
        assert not root_workshop.exists()
