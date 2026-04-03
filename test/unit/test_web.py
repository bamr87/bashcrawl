"""Unit tests for ti.web helpers."""

import pytest

from ti.web import _build_command

pytestmark = pytest.mark.unit


def test_build_command_without_game_root() -> None:
    assert _build_command() == "python3 -m ti"


def test_build_command_quotes_game_root_with_spaces() -> None:
    cmd = _build_command("/tmp/bashcrawl with spaces")
    assert cmd == "python3 -m ti --game-root '/tmp/bashcrawl with spaces'"
