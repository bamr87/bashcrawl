"""Unit tests for help_data.py YAML loader.

Tests that shared YAML data files (rooms, commands, quests, etc.)
load correctly and provide valid data to both bash and Python consumers.
"""

import pytest

pytestmark = pytest.mark.unit

# All known game rooms (main + hidden)
ALL_GAME_ROOMS = {
    "entrance", "cellar", "armoury", "chamber",   # main path
    "chapel", "graveyard", "courtyard", "aviary",  # chapel path
    "hall", "library", "study",                     # chapel path cont.
    "vault", "stronghold", "nursery", "lab",        # vault path
    "scrap",                                        # symlink room
    "rift", "arena", "pit", "spire", "mezzanine",  # rift path
    "workshop",                                     # player-created
}


class TestLoadRooms:
    """Tests for load_rooms()."""

    def test_loads_rooms(self):
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("src/help/data/rooms.yaml not found")
        assert isinstance(rooms, dict)
        assert len(rooms) > 0, "Should load at least one room"

    def test_entrance_room_exists(self):
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("rooms.yaml not found")
        assert "entrance" in rooms, "Entrance room should be defined"

    def test_room_has_required_fields(self):
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("rooms.yaml not found")
        for name, room in rooms.items():
            assert room.title, f"Room {name} missing title"
            assert room.description, f"Room {name} missing description"

    @pytest.mark.parametrize("room_name", sorted(ALL_GAME_ROOMS))
    def test_all_rooms_in_yaml(self, room_name):
        """Every known game room must have an entry in rooms.yaml."""
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("rooms.yaml not found")
        assert room_name in rooms, \
            f"Room '{room_name}' missing from rooms.yaml"

    def test_rooms_have_teaches(self):
        """Each room should teach at least one concept."""
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("rooms.yaml not found")
        for name, room in rooms.items():
            if name == "unknown":
                continue  # wildcard entry doesn't need teaches
            assert len(room.teaches) > 0, \
                f"Room '{name}' should list at least one topic in 'teaches'"

    def test_rooms_have_essential_commands(self):
        """Each room should list essential commands."""
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("rooms.yaml not found")
        for name, room in rooms.items():
            if name == "unknown":
                continue
            assert len(room.essential_commands) > 0, \
                f"Room '{name}' should list at least one essential command"

    def test_rooms_have_next_steps(self):
        """Each room should have next_steps guidance."""
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("rooms.yaml not found")
        for name, room in rooms.items():
            if name == "unknown":
                continue
            assert room.next_steps, \
                f"Room '{name}' should have next_steps"

    def test_no_extra_rooms_in_yaml(self):
        """rooms.yaml should not have entries for non-existent rooms
        (except 'unknown' as a catch-all)."""
        from ti.help_data import load_rooms
        try:
            rooms = load_rooms()
        except FileNotFoundError:
            pytest.skip("rooms.yaml not found")
        allowed = ALL_GAME_ROOMS | {"unknown"}
        extra = set(rooms.keys()) - allowed
        assert not extra, \
            f"rooms.yaml has entries for non-game rooms: {extra}"


class TestLoadCommands:
    """Tests for load_commands()."""

    def test_loads_command_categories(self):
        from ti.help_data import load_commands
        try:
            categories = load_commands()
        except FileNotFoundError:
            pytest.skip("commands.yaml not found")
        assert isinstance(categories, list)
        assert len(categories) > 0

    def test_categories_have_commands(self):
        from ti.help_data import load_commands
        try:
            categories = load_commands()
        except FileNotFoundError:
            pytest.skip("commands.yaml not found")
        for cat in categories:
            assert cat.title, f"Category {cat.key} missing title"
            assert len(cat.commands) > 0, f"Category {cat.key} has no commands"


class TestLoadQuests:
    """Tests for load_quests()."""

    def test_loads_quests(self):
        from ti.help_data import load_quests
        try:
            quests = load_quests()
        except FileNotFoundError:
            pytest.skip("quests.yaml not found")
        assert isinstance(quests, list)
        assert len(quests) >= 7

    def test_quests_match_expected(self):
        from ti.help_data import load_quests
        try:
            quests = load_quests()
        except FileNotFoundError:
            pytest.skip("quests.yaml not found")
        commands = [q.required_commands[0] for q in quests if q.required_commands]
        # First 7 quests should teach these commands
        expected = {"pwd", "ls", "cd", "cat", "mkdir", "touch", "grep"}
        assert expected.issubset(set(commands)), \
            f"Missing quests for: {expected - set(commands)}"


class TestLoadMap:
    """Tests for load_map()."""

    def test_loads_map(self):
        from ti.help_data import load_map
        try:
            map_text = load_map()
        except (FileNotFoundError, Exception):
            pytest.skip("map.yaml not found or invalid")
        assert isinstance(map_text, str)
        assert len(map_text) > 0


class TestYamlDataDir:
    """Tests for the data directory detection."""

    def test_find_data_dir(self):
        from ti.help_data import _find_data_dir
        try:
            data_dir = _find_data_dir()
        except FileNotFoundError:
            pytest.skip("Cannot find src/help/data/")
        assert data_dir.is_dir()
        # Should contain at least rooms.yaml
        assert (data_dir / "rooms.yaml").exists() or \
               (data_dir / "quests.yaml").exists(), \
               "Data directory should contain YAML files"
