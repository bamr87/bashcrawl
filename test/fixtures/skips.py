"""Shared platform and optional-dependency skip helpers for tests."""

from __future__ import annotations

import importlib.util
import sys

import pytest

IS_WINDOWS = sys.platform == "win32"


def _has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def has_mcp() -> bool:
    return _has_module("mcp")


requires_mcp = pytest.mark.skipif(not has_mcp(), reason="mcp package not installed")
requires_bash = pytest.mark.skipif(IS_WINDOWS, reason="requires bash")
