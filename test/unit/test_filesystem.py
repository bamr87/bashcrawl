"""Unit tests for GameFileSystem.

Tests the sandboxed filesystem wrapper that all game operations
go through. Verifies path sandboxing, directory/file operations,
and script execution.
"""

import os
import pytest
from pathlib import Path


pytestmark = pytest.mark.unit


class TestGameFileSystemInit:
    """Tests for GameFileSystem initialization."""

    def test_valid_game_root(self, sandbox):
        from ti.filesystem import GameFileSystem
        fs = GameFileSystem(sandbox)
        assert fs.root == sandbox.resolve()

    def test_invalid_game_root_raises(self, tmp_path):
        from ti.filesystem import GameFileSystem
        with pytest.raises(FileNotFoundError, match="no entrance/ directory"):
            GameFileSystem(tmp_path)


class TestSandboxEnforcement:
    """Tests that filesystem operations stay within the game root."""

    def test_resolve_within_root(self, game_fs):
        # Normal path should resolve fine
        result = game_fs._resolve("/entrance", "cellar")
        assert str(result).startswith(str(game_fs.root))

    def test_resolve_escape_blocked(self, game_fs):
        with pytest.raises(PermissionError, match="beyond the boundaries"):
            game_fs._resolve("/entrance", "../../../etc/passwd")

    def test_resolve_absolute_path_treated_as_relative(self, game_fs):
        """Absolute paths are treated as relative to game root, not as real absolute paths."""
        # /etc/passwd becomes root/etc/passwd — within sandbox, so no error
        # This is by design: the game root IS the filesystem root
        result = game_fs._resolve("/entrance", "/entrance/scroll")
        assert str(result).startswith(str(game_fs.root))

    def test_resolve_dotdot_chain(self, game_fs):
        with pytest.raises(PermissionError):
            game_fs._resolve("/entrance/cellar", "../../../../tmp")


class TestDirectoryOperations:
    """Tests for ls, cd, mkdir."""

    def test_ls_entrance(self, game_fs):
        items = game_fs.ls("/entrance", "")
        # Entrance should contain scroll and cellar at minimum
        names = [i.rstrip("/*") for i in items]
        assert "scroll" in names
        assert "cellar" in names or "cellar/" in [i for i in items]

    def test_ls_nonexistent_raises(self, game_fs):
        with pytest.raises((NotADirectoryError, FileNotFoundError)):
            game_fs.ls("/entrance", "nonexistent_dir")

    def test_cd_valid(self, game_fs):
        new_cwd = game_fs.cd("/entrance", "cellar")
        assert "cellar" in new_cwd

    def test_cd_to_file_raises(self, game_fs):
        with pytest.raises(NotADirectoryError):
            game_fs.cd("/entrance", "scroll")

    def test_mkdir_creates_dir(self, game_fs):
        game_fs.mkdir("/entrance", "test_room")
        target = game_fs._resolve("/entrance", "test_room")
        assert target.is_dir()

    def test_ls_shows_dirs_with_slash(self, game_fs):
        items = game_fs.ls("/entrance", "")
        dirs = [i for i in items if i.endswith("/")]
        assert len(dirs) > 0, "Should have at least one subdirectory"

    def test_ls_shows_executables_with_star(self, game_fs):
        items = game_fs.ls("/entrance/cellar", "")
        executables = [i for i in items if i.endswith("*")]
        # Cellar has treasure which should be executable
        assert any("treasure" in e for e in executables), \
            f"Expected treasure* in cellar, got: {items}"


class TestFileOperations:
    """Tests for touch, read_file, write_file, rm, cp, mv."""

    def test_touch_creates_file(self, game_fs):
        game_fs.touch("/entrance", "test_file")
        target = game_fs._resolve("/entrance", "test_file")
        assert target.is_file()

    def test_read_file_scroll(self, game_fs):
        content = game_fs.read_file("/entrance", "scroll")
        assert len(content) > 0, "Entrance scroll should not be empty"

    def test_read_nonexistent_raises(self, game_fs):
        with pytest.raises(FileNotFoundError):
            game_fs.read_file("/entrance", "nonexistent_file")

    def test_write_and_read(self, game_fs):
        game_fs.write_file("/entrance", "test_note", "Hello dungeon!")
        content = game_fs.read_file("/entrance", "test_note")
        assert content == "Hello dungeon!"

    def test_rm_removes_file(self, game_fs):
        game_fs.touch("/entrance", "to_delete")
        game_fs.rm("/entrance", "to_delete")
        assert not game_fs.exists("/entrance", "to_delete")

    def test_cp_copies_file(self, game_fs):
        game_fs.write_file("/entrance", "original", "test content")
        game_fs.cp("/entrance", "original", "copy")
        content = game_fs.read_file("/entrance", "copy")
        assert content == "test content"

    def test_mv_renames_file(self, game_fs):
        game_fs.write_file("/entrance", "old_name", "data")
        game_fs.mv("/entrance", "old_name", "new_name")
        assert not game_fs.exists("/entrance", "old_name")
        assert game_fs.exists("/entrance", "new_name")


class TestSymlinks:
    """Tests for ln_s (symlink creation)."""

    def test_create_symlink(self, game_fs):
        game_fs.touch("/entrance", "target_file")
        game_fs.ln_s("/entrance", "target_file", "link_file")
        # _resolve follows symlinks, so check the unresolved path
        link_raw = (game_fs.root / "entrance" / "link_file")
        assert link_raw.is_symlink()
        # Symlink should point to the target
        assert link_raw.resolve() == (game_fs.root / "entrance" / "target_file").resolve()


class TestQueryHelpers:
    """Tests for exists, is_executable, is_dir, match_paths."""

    def test_exists_scroll(self, game_fs):
        assert game_fs.exists("/entrance", "scroll")

    def test_exists_nonexistent(self, game_fs):
        assert not game_fs.exists("/entrance", "unicorn")

    def test_is_executable_treasure(self, game_fs):
        assert game_fs.is_executable("/entrance/cellar", "treasure")

    def test_is_not_executable_scroll(self, game_fs):
        assert not game_fs.is_executable("/entrance", "scroll")

    def test_is_dir(self, game_fs):
        assert game_fs.is_dir("/entrance", "cellar")
        assert not game_fs.is_dir("/entrance", "scroll")

    def test_match_paths(self, game_fs):
        matches = game_fs.match_paths("/entrance", "cel")
        assert any("cellar" in m for m in matches)


class TestScriptExecution:
    """Tests for run_script."""

    def test_run_treasure_script(self, game_fs):
        # The treasure script exits 1 when $I is unset (instructs player to
        # export I=amulet,$I).  We only verify it runs and produces output.
        output, exit_code, env_updates = game_fs.run_script("/entrance/cellar", "treasure")
        assert len(output) > 0, "Treasure script should produce output"
        assert "amulet" in output.lower(), "Treasure script should mention the amulet"

    def test_run_treasure_returns_env_updates(self, game_fs):
        """Treasure script output should yield export I=amulet,$I parsed."""
        output, exit_code, env_updates = game_fs.run_script("/entrance/cellar", "treasure")
        assert "I" in env_updates, f"Expected 'I' in env_updates, got: {env_updates}"
        assert "amulet" in env_updates["I"]

    def test_run_potion_returns_hp_update(self, game_fs):
        """Potion script should yield export HP=15 (default stdin answers y)."""
        output, exit_code, env_updates = game_fs.run_script(
            "/entrance/cellar/armoury", "potion"
        )
        assert "HP" in env_updates, f"Expected 'HP' in env_updates, got: {env_updates}"
        assert env_updates["HP"] == "15"

    def test_run_nonexistent_script_raises(self, game_fs):
        with pytest.raises(FileNotFoundError):
            game_fs.run_script("/entrance", "nonexistent_script")

    def test_run_non_executable_raises(self, game_fs):
        with pytest.raises(PermissionError):
            game_fs.run_script("/entrance", "scroll")


class TestParseExportInstructions:
    """Tests for _parse_export_instructions."""

    def test_simple_export(self):
        from ti.filesystem import GameFileSystem
        result = GameFileSystem._parse_export_instructions(
            "export HP=15", {}
        )
        assert result == {"HP": "15"}

    def test_export_with_variable_expansion(self):
        from ti.filesystem import GameFileSystem
        result = GameFileSystem._parse_export_instructions(
            "export I=amulet,$I", {"I": "sword,"}
        )
        assert result == {"I": "amulet,sword,"}

    def test_export_with_empty_variable(self):
        from ti.filesystem import GameFileSystem
        result = GameFileSystem._parse_export_instructions(
            "export I=amulet,$I", {}
        )
        assert result == {"I": "amulet,"}

    def test_multiple_exports(self):
        from ti.filesystem import GameFileSystem
        output = "export I=amulet,$I\nexport HP=15"
        result = GameFileSystem._parse_export_instructions(
            output, {"I": "sword,"}
        )
        assert result == {"I": "amulet,sword,", "HP": "15"}

    def test_no_exports(self):
        from ti.filesystem import GameFileSystem
        result = GameFileSystem._parse_export_instructions(
            "No exports here", {}
        )
        assert result == {}

    def test_export_embedded_in_text(self):
        from ti.filesystem import GameFileSystem
        output = "To add to your inventory:\n\nexport I=sword,$I\n\nCheck with echo $I"
        result = GameFileSystem._parse_export_instructions(
            output, {"I": "amulet,"}
        )
        assert result == {"I": "sword,amulet,"}
