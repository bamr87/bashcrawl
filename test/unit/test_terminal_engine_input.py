"""Unit tests for TerminalEngine input normalization."""

import pytest

pytestmark = pytest.mark.unit


def test_cd_without_space_is_normalized(engine):
    """Browser input may drop spaces: cdcellar -> cd cellar."""
    result = engine.execute("cdcellar")
    assert result is None
    assert "cellar" in engine.cwd()
