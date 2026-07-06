"""Integration-only pytest fixtures.

The Textual-TUI walkthrough screenshots (and their golden-promotion / retention
machinery) were removed with the TUI, so only the log-capture autouse remains.
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _integration_capture(log_capture):
    """Enable JSONL logging automatically for integration tests."""
    yield
