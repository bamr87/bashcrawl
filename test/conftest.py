"""Pytest configuration and shared fixtures for Bashcrawl testing.

Provides:
- game_root: Path to the real bashcrawl repo root
- sandbox: Isolated game copy for mutation-safe tests (yields ``<sandbox>/game``)
- ro_sandbox: Session-scoped read-only sandbox reused across tests
- sandbox_env: Environment dict for running game scripts in the sandbox
- log_capture: TestLogCapture for JSONL event tracking
- walkthrough: Session-scoped walkthrough.json accessor
- test_run_id: Shared run ID grouping all tests in one invocation

The Textual TUI, its Python engine, and the screenshot/AI harness were removed
when the repo was reduced to terminal-core + web, so the ``ti.*`` and screenshot
fixtures are gone with them.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Generator

import pytest

TEST_DIR = Path(__file__).resolve().parent
REPO_ROOT = TEST_DIR.parent

sys.path.insert(0, str(TEST_DIR))
sys.path.insert(0, str(REPO_ROOT / "src"))

from fixtures import create_sandbox, destroy_sandbox, find_game_root, game_env
from fixtures.log_capture import TestLogCapture
from fixtures.walkthrough import Walkthrough, load_walkthrough

_RUN_ID: str = f"R{int(time.time())}"
_RUN_SESSION_FILES: list[str] = []
_RUN_HAD_FAILURES: bool = False


# ---------------------------------------------------------------------------
# Session-level accessors
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def test_run_id() -> str:
    """Unique run ID shared across all tests in this pytest invocation."""
    return _RUN_ID


@pytest.fixture(scope="session")
def walkthrough() -> Walkthrough:
    """Session-scoped walkthrough.json accessor (loaded once per run)."""
    return load_walkthrough()


# ---------------------------------------------------------------------------
# Core fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def game_root() -> Path:
    """Path to the real bashcrawl repo root (read-only reference)."""
    return find_game_root()


@pytest.fixture(scope="session")
def _shared_sandbox_root(game_root: Path) -> Generator[Path, None, None]:
    """Session-level sandbox root for read-only tests."""
    sb = create_sandbox(game_root)
    try:
        yield sb
    finally:
        destroy_sandbox(sb)


@pytest.fixture
def ro_sandbox(_shared_sandbox_root: Path) -> Path:
    """Read-only sandbox path reused across tests in a session."""
    return _shared_sandbox_root / "game"


@pytest.fixture
def sandbox(game_root: Path) -> Generator[Path, None, None]:
    """Isolated copy of the game tree for mutation-safe testing.

    Yields the ``game/`` subdirectory of a fresh sandbox, cleaned up after.
    """
    sb = create_sandbox(game_root)
    yield sb / "game"
    destroy_sandbox(sb)


@pytest.fixture
def sandbox_env(sandbox: Path) -> dict[str, str]:
    """Environment dict for running game scripts in the sandbox."""
    return game_env(sandbox)


@pytest.fixture
def log_capture(request: pytest.FixtureRequest) -> Generator[TestLogCapture, None, None]:
    """TestLogCapture that writes a JSONL session to ``logs/sessions/``."""
    log_dir = REPO_ROOT / "logs" / "sessions"
    log_dir.mkdir(parents=True, exist_ok=True)
    mode = _get_test_mode(request.node)
    capture = TestLogCapture(
        log_dir=log_dir,
        scenario=mode,
        test_name=request.node.name,
        run_id=_RUN_ID,
    )
    capture.start()
    yield capture
    report = getattr(request.node, "_test_report", None)
    if report is not None:
        capture.log_test_result(
            outcome=report.outcome,
            duration_sec=report.duration,
            markers=_get_test_markers(request.node),
            longrepr=str(report.longrepr)[:500] if report.longrepr else "",
        )
        if report.outcome in ("failed", "error"):
            global _RUN_HAD_FAILURES
            _RUN_HAD_FAILURES = True
    capture.end()
    if capture.file_path.exists():
        _RUN_SESSION_FILES.append(str(capture.file_path))


# ---------------------------------------------------------------------------
# Helpers & hooks
# ---------------------------------------------------------------------------

def _get_test_markers(item: pytest.Item) -> list[str]:
    return [m.name for m in item.iter_markers()]


def _get_test_mode(item: pytest.Item) -> str:
    markers = _get_test_markers(item)
    for m in ("integration", "unit"):
        if m in markers:
            return m
    parts = item.module.__name__.split(".") if item.module else []
    for m in ("integration", "unit"):
        if m in parts:
            return m
    return "test"


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Deterministic unit tests")
    config.addinivalue_line("markers", "integration: Integration tests with subprocess")
    config.addinivalue_line("markers", "slow: Tests that take >30 seconds")
    config.addinivalue_line("markers", "bash: Tests that require a bash-capable environment")


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call):
    """Stash the test outcome on the item so fixtures can read it in teardown."""
    outcome = yield
    report = outcome.get_result()
    if report.when == "call":
        item._test_report = report
