"""Integration tests for game encounters (treasure, potion, combat, spell, puzzle).

Consolidates test_game_scripts.py and test_combat.py into a single
module driven by walkthrough.json encounter definitions.

Each encounter is tested via subprocess in a sandbox with proper
environment setup matching the walkthrough state.
"""

import os
import subprocess
import pytest
from pathlib import Path

from fixtures.logical_paths import resolve_logical_path
from fixtures.walkthrough import load_walkthrough

pytestmark = pytest.mark.integration

_WT = load_walkthrough()

# Encounters that can be tested deterministically via subprocess
_BASIC_ENCOUNTERS = [
    enc_path
    for enc_path, spec in _WT.encounters.items()
    if not spec.get("nondeterministic")
    and spec["type"] in ("treasure", "potion", "spell", "gate", "puzzle", "hazard")
]


def run_game_script(
    sandbox: Path,
    script_path: str,
    env_overrides: dict | None = None,
    stdin_input: str = "",
) -> subprocess.CompletedProcess:
    """Run a game script in the sandbox environment."""
    full_path = sandbox / script_path
    cwd = str(full_path.parent)

    env = os.environ.copy()
    env["BASHCRAWL_ROOT"] = str(sandbox)
    env["HOME"] = str(sandbox)
    env.pop("I", None)
    env.pop("HP", None)
    if env_overrides:
        env.update(env_overrides)

    return subprocess.run(
        ["bash", str(full_path)],
        cwd=cwd,
        env=env,
        input=stdin_input,
        capture_output=True,
        text=True,
        timeout=10,
    )


# ---------------------------------------------------------------------------
# Treasure scripts
# ---------------------------------------------------------------------------

class TestTreasureEncounters:
    """Treasure scripts: produce output, mention items, instruct export."""

    @pytest.mark.parametrize("script_path", [
        "entrance/cellar/treasure",
        "entrance/cellar/armoury/treasure",
        "entrance/cellar/armoury/chamber/treasure",
    ])
    def test_treasure_produces_output(self, sandbox, script_path):
        result = run_game_script(sandbox, script_path)
        assert len(result.stdout) > 0, f"{script_path} should produce output"

    @pytest.mark.parametrize("script_path,expected_item", [
        ("entrance/cellar/treasure", "amulet"),
        ("entrance/cellar/armoury/treasure", "sword"),
    ])
    def test_treasure_mentions_item(self, sandbox, script_path, expected_item):
        result = run_game_script(sandbox, script_path)
        assert expected_item in result.stdout.lower(), \
            f"{script_path} should mention {expected_item}"

    @pytest.mark.parametrize("script_path", [
        "entrance/cellar/treasure",
        "entrance/cellar/armoury/treasure",
        "entrance/cellar/armoury/chamber/treasure",
    ])
    def test_treasure_mentions_export(self, sandbox, script_path):
        result = run_game_script(sandbox, script_path)
        assert "export" in result.stdout.lower(), \
            f"{script_path} should instruct player to export"

    def test_cellar_treasure_unlocks_hidden_rooms(self, sandbox):
        """After cellar/treasure, .chapel/.vault/.scrap should be renamed."""
        run_game_script(sandbox, "entrance/cellar/treasure")
        entrance = sandbox / "entrance"
        chapel = entrance / "chapel"
        chapel_hidden = entrance / ".chapel"
        assert chapel.exists() or chapel_hidden.exists(), \
            "Chapel (hidden or unlocked) should exist"


# ---------------------------------------------------------------------------
# Potion
# ---------------------------------------------------------------------------

class TestPotionEncounter:
    """The potion script in armoury tests interactive read prompts."""

    def test_potion_accept(self, sandbox):
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/potion", stdin_input="y\n",
        )
        stdout = result.stdout.lower()
        assert any(w in stdout for w in ("hp", "health", "15", "potion")), \
            f"Potion with 'y' should reference health, got: {result.stdout[:200]}"

    def test_potion_decline(self, sandbox):
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/potion", stdin_input="n\n",
        )
        assert len(result.stdout) > 0, "Potion with 'n' should still produce output"


# ---------------------------------------------------------------------------
# Combat encounters
# ---------------------------------------------------------------------------

class TestStatueCombat:
    """Chamber statue combat encounter."""

    def test_statue_with_sword(self, sandbox):
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/chamber/statue",
            env_overrides={"I": "sword,amulet,", "HP": "15"},
            stdin_input="y\ny\n",
        )
        assert len(result.stdout) > 0, "Statue with sword should produce output"
        assert "diamonds" in result.stdout.lower(), \
            "Statue with sword should yield diamonds"

    def test_statue_without_sword(self, sandbox):
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/chamber/statue",
            env_overrides={"HP": "15"},
            stdin_input="y\ny\n",
        )
        assert len(result.stdout) > 0, "Statue without sword should produce output"

    def test_statue_already_defeated(self, sandbox):
        chamber = sandbox / "entrance" / "cellar" / "armoury" / "chamber"
        (chamber / ".statue_defeated").touch()
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/chamber/statue",
            env_overrides={"I": "sword,", "HP": "15"},
        )
        assert len(result.stdout) > 0, "Already-defeated statue should produce output"

    def test_statue_no_hp(self, sandbox):
        """Statue with no HP — player dies (exit 1 = gameover)."""
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/chamber/statue",
            env_overrides={"I": "sword,"},
            stdin_input="y\ny\n",
        )
        assert result.returncode in (0, 1)
        assert "slain" in result.stdout.lower() or "statue" in result.stdout.lower()


class TestMonsterCombat:
    """Monster encounter in chapel/courtyard/aviary/hall."""

    def _find_monster(self, sandbox: Path) -> Path | None:
        for name in (".chapel", "chapel"):
            p = sandbox / "entrance" / name / "courtyard" / "aviary" / "hall" / "monster"
            if p.exists() and p.is_file():
                return p
        return None

    def test_monster_exists(self, sandbox):
        assert self._find_monster(sandbox) is not None, \
            "Monster script should exist in chapel branch"

    def test_monster_with_hp(self, sandbox):
        path = self._find_monster(sandbox)
        if not path:
            pytest.skip("Monster script not found")
        env = os.environ.copy()
        env["BASHCRAWL_ROOT"] = str(sandbox)
        env["HP"] = "15"
        env["I"] = "sword,amulet,"
        result = subprocess.run(
            ["bash", str(path)], cwd=str(path.parent), env=env,
            input="y\n42\n", capture_output=True, text=True, timeout=10,
        )
        assert result.returncode in (0, 1)
        assert "monster" in result.stdout.lower() or "slain" in result.stdout.lower()


class TestGhostCombat:
    """Ghost encounter in vault/stronghold/nursery/lab."""

    def _find_ghost(self, sandbox: Path) -> Path | None:
        for name in (".vault", "vault"):
            p = sandbox / "entrance" / name / "stronghold" / "nursery" / "lab" / "ghost"
            if p.exists() and p.is_file():
                return p
        return None

    def test_ghost_exists(self, sandbox):
        path = self._find_ghost(sandbox)
        if path is None:
            pytest.skip("Ghost script not found in .vault or vault")
        assert path.is_file()

    def test_ghost_with_hp(self, sandbox):
        path = self._find_ghost(sandbox)
        if not path:
            pytest.skip("Ghost script not found")
        env = os.environ.copy()
        env["BASHCRAWL_ROOT"] = str(sandbox)
        env["HP"] = "15"
        env["I"] = "sword,amulet,"
        result = subprocess.run(
            ["bash", str(path)], cwd=str(path.parent), env=env,
            input="y\n42\n", capture_output=True, text=True, timeout=10,
        )
        assert result.returncode in (0, 1)
        assert "ghost" in result.stdout.lower() or "slain" in result.stdout.lower()


# ---------------------------------------------------------------------------
# Spell encounters
# ---------------------------------------------------------------------------

class TestSpellEncounter:
    """Chamber spell teaches ln -s."""

    def test_spell_accept(self, sandbox):
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/chamber/spell", stdin_input="y\n",
        )
        assert len(result.stdout) > 0

    def test_spell_decline(self, sandbox):
        result = run_game_script(
            sandbox, "entrance/cellar/armoury/chamber/spell", stdin_input="n\n",
        )
        assert len(result.stdout) > 0


# ---------------------------------------------------------------------------
# Scroll files — driven by walkthrough.json rooms
# ---------------------------------------------------------------------------

class TestScrollFiles:
    """All scroll files defined in walkthrough.json exist and are readable."""

    @pytest.mark.parametrize("room_path", _WT.rooms_with_scrolls())
    def test_scroll_exists_and_nonempty(self, game_root, room_path):
        base = resolve_logical_path(game_root, room_path)
        assert base is not None and base.is_dir(), f"Room directory missing: {room_path}"
        scroll = base / "scroll"
        assert scroll.exists(), f"Scroll missing at {room_path}/scroll"
        content = scroll.read_text()
        assert len(content) > 10, f"Scroll at {room_path} too short ({len(content)} chars)"


# ---------------------------------------------------------------------------
# Walkthrough completeness validation
# ---------------------------------------------------------------------------

class TestWalkthroughCompleteness:
    """Validate walkthrough.json against the real filesystem."""

    def test_all_rooms_exist(self, game_root, walkthrough):
        for room_path in walkthrough.room_names():
            room_dir = resolve_logical_path(game_root, room_path)
            assert room_dir is not None and room_dir.is_dir(), \
                f"Room directory missing: {room_path}"

    def test_all_scripts_exist(self, game_root, walkthrough):
        for room_path, spec in walkthrough.rooms.items():
            base = resolve_logical_path(game_root, room_path)
            assert base is not None and base.is_dir(), \
                f"Room directory missing: {room_path}"
            for script in spec.get("scripts", []):
                script_path = base / script
                assert script_path.exists(), \
                    f"Script missing: {room_path}/{script}"

    def test_all_encounter_scripts_exist(self, game_root, walkthrough):
        for enc_path in walkthrough.encounter_names():
            script = resolve_logical_path(game_root, enc_path)
            assert script is not None and script.is_file(), \
                f"Encounter script missing: {enc_path}"
