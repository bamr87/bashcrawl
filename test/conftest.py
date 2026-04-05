"""Pytest configuration and shared fixtures for Bashcrawl testing.

Provides:
- game_root: Path to the real bashcrawl repo root
- sandbox: Isolated game copy for mutation-safe tests
- game_fs: GameFileSystem pointing at sandbox
- game_state: Fresh GameState for testing
- log_capture: (autouse) TestLogCapture for JSONL event tracking — every test
- screenshot_dir: (autouse) Session-specific screenshot directory
- screenshot_capture: (autouse) ScreenshotCapture wired to log_capture
- mcp_session: GameSession on sandbox (engine API for MCP-related tests)
- test_run_id: (session-scoped) Shared run ID grouping all tests in one invocation
- ai_agent: TestAgent (only for @pytest.mark.ai tests)
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Generator

import pytest
from dotenv import load_dotenv

# Add test/ and src/terminal-illness/ to Python path
TEST_DIR = Path(__file__).resolve().parent
REPO_ROOT = TEST_DIR.parent

# Load .env from repo root (contains ANTHROPIC_API_KEY, etc.)
load_dotenv(REPO_ROOT / ".env")
TI_DIR = REPO_ROOT / "src" / "terminal-illness"

sys.path.insert(0, str(TEST_DIR))
sys.path.insert(0, str(TI_DIR))

from fixtures import create_sandbox, destroy_sandbox, find_game_root, game_env
from fixtures.log_capture import TestLogCapture
from fixtures.walkthrough import Walkthrough, load_walkthrough


# ---------------------------------------------------------------------------
# Shared run ID — groups every test in a single pytest invocation
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def test_run_id() -> str:
    """Unique run ID shared across all tests in this pytest invocation."""
    return f"R{int(time.time())}"


@pytest.fixture(scope="session")
def walkthrough() -> Walkthrough:
    """Session-scoped walkthrough.json accessor (loaded once per run)."""
    return load_walkthrough()


# Store the run ID at module level so hooks can read it
_RUN_ID: str = f"R{int(time.time())}"
_RUN_SESSION_FILES: list[str] = []
_RUN_SCREENSHOT_DIRS: list[str] = []
_RUN_HAD_FAILURES: bool = False


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

    Yields the sandbox root containing ``game/`` subdirectory.
    Cleaned up automatically after the test.
    """
    sb = create_sandbox(game_root)
    yield sb / "game"
    destroy_sandbox(sb)


@pytest.fixture
def sandbox_env(sandbox: Path) -> dict[str, str]:
    """Environment dict for running game scripts in the sandbox."""
    return game_env(sandbox)


@pytest.fixture
def game_fs(sandbox: Path):
    """GameFileSystem pointing at the sandbox copy."""
    from ti.filesystem import GameFileSystem
    return GameFileSystem(sandbox)


@pytest.fixture
def ro_game_fs(ro_sandbox: Path):
    """GameFileSystem on the shared read-only sandbox."""
    from ti.filesystem import GameFileSystem
    return GameFileSystem(ro_sandbox)


@pytest.fixture
def game_state() -> "GameState":
    """Fresh GameState for testing."""
    from ti.game_state import GameState
    return GameState()


# ---------------------------------------------------------------------------
# Helpers for extracting test metadata
# ---------------------------------------------------------------------------

def _get_test_markers(item: pytest.Item) -> list[str]:
    """Return list of marker names for a test item."""
    return [m.name for m in item.iter_markers()]


def _get_test_mode(item: pytest.Item) -> str:
    """Return the primary mode string for a test (unit/integration/ai/demo)."""
    markers = _get_test_markers(item)
    for m in ("ai", "demo", "integration", "unit"):
        if m in markers:
            return m
    # Infer from module path
    parts = item.module.__name__.split(".") if item.module else []
    for m in ("ai", "demo", "integration", "unit"):
        if m in parts:
            return m
    return "test"


# ---------------------------------------------------------------------------
# Autouse log_capture — every test gets a JSONL session
# ---------------------------------------------------------------------------

@pytest.fixture
def log_capture(request: pytest.FixtureRequest) -> Generator[TestLogCapture, None, None]:
    """TestLogCapture that writes to the repo's ``logs/sessions/`` directory.

    This is autouse — every test automatically gets a JSONL session file
    persisted in ``logs/sessions/`` for post-test review and analysis.
    """
    log_dir = REPO_ROOT / "logs" / "sessions"
    log_dir.mkdir(parents=True, exist_ok=True)
    test_name = request.node.name
    mode = _get_test_mode(request.node)
    markers = _get_test_markers(request.node)

    capture = TestLogCapture(
        log_dir=log_dir,
        scenario=mode,
        test_name=test_name,
        run_id=_RUN_ID,
    )
    capture.start()

    # Enrich session_start with run-level metadata
    capture.log_event(
        "test",
        run_id=_RUN_ID,
        test_module=request.node.module.__name__ if request.node.module else "",
        test_class=request.node.parent.name if request.node.parent and request.node.parent != request.node.session else "",
        markers=markers,
        mode=mode,
    )

    yield capture

    # --- teardown: record test outcome, then close session ---
    # The outcome is stashed on the node by the pytest_runtest_makereport hook
    report = getattr(request.node, "_test_report", None)
    if report is not None:
        capture.log_test_result(
            outcome=report.outcome,
            duration_sec=report.duration,
            markers=markers,
            longrepr=str(report.longrepr)[:500] if report.longrepr else "",
        )
        if report.outcome in ("failed", "error"):
            global _RUN_HAD_FAILURES
            _RUN_HAD_FAILURES = True

    capture.end()

    # Track files produced by this run
    if capture.file_path.exists():
        _RUN_SESSION_FILES.append(str(capture.file_path))


# ---------------------------------------------------------------------------
# Autouse screenshot_dir + screenshot_capture
# ---------------------------------------------------------------------------

@pytest.fixture
def screenshot_dir(request: pytest.FixtureRequest) -> Path:
    """Session-specific screenshot directory under ``logs/screenshots/``.

    Autouse — every test gets a screenshot directory.
    Structure:  ``logs/screenshots/<date>_<test_name>/``
    """
    datestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    test_name = request.node.name.replace("[", "_").replace("]", "")
    # Tag walkthrough tests so golden-promotion can find their dirs
    module_file = getattr(request.node, "fspath", None)
    if module_file and "walkthrough" in str(module_file):
        test_name = f"{test_name}_walkthrough"
    d = REPO_ROOT / "logs" / "screenshots" / f"{datestamp}_{test_name}"
    d.mkdir(parents=True, exist_ok=True)
    _RUN_SCREENSHOT_DIRS.append(str(d))
    return d


@pytest.fixture
def screenshot_capture(
    screenshot_dir: Path,
    log_capture: TestLogCapture,
    request: pytest.FixtureRequest,
):
    """Screenshot helper wired to TestLogCapture and the ``logs/`` tree.

    Autouse — after the test, if no TUI screenshots were captured, generates
    a summary SVG using ``svg_renderer.render_test_summary()``.

    Usage in tests::

        def test_foo(screenshot_capture, ...):
            screenshot_capture.record(svg_path, trigger="initial")
            path = screenshot_capture.take(app, "after_cmd", command="ls")
    """
    from fixtures.screenshot_capture import ScreenshotCapture
    cap = ScreenshotCapture(
        screenshot_dir=screenshot_dir,
        log_capture=log_capture,
    )
    yield cap

    # --- teardown: write summary SVG if no screenshots were taken ---
    report = getattr(request.node, "_test_report", None)
    outcome = report.outcome if report else "unknown"
    duration = report.duration if report else 0.0

    if cap.count == 0:
        from fixtures.svg_renderer import save_test_summary_svg
        markers = _get_test_markers(request.node)
        # Try to get captured stdout (pytest captures it via capfd)
        stdout_preview = ""
        capman = request.config.pluginmanager.getplugin("capturemanager")
        if capman:
            try:
                out, _ = capman.read_global_capture()
                stdout_preview = out[:500] if out else ""
            except Exception:
                pass

        save_test_summary_svg(
            path=screenshot_dir / "000_test_summary.svg",
            test_name=request.node.name,
            outcome=outcome,
            duration_sec=duration,
            markers=markers,
            stdout_preview=stdout_preview,
            test_module=request.node.module.__name__ if request.node.module else "",
            test_class=request.node.parent.name if request.node.parent and request.node.parent != request.node.session else "",
        )

    # Write a manifest after the test completes (skip if one already exists
    # from an in-test ScreenshotCapture like _run_walkthrough)
    manifest_path = screenshot_dir / "manifest.json"
    if not manifest_path.exists():
        cap.write_manifest()


@pytest.fixture
def engine(game_state, game_fs):
    """TerminalEngine in non-interactive mode for testing."""
    from ti.terminal_engine import TerminalEngine
    eng = TerminalEngine.__new__(TerminalEngine)
    eng.state = game_state
    eng.fs = game_fs
    eng._cwd = game_state.current_location or "/entrance"
    eng._registry = {}
    eng._output_callback = None
    eng._on_quest_complete = None
    eng._register_commands = TerminalEngine._register_commands.__get__(eng)
    eng._register = TerminalEngine._register.__get__(eng)
    eng._register_commands()
    # Skip prompt_toolkit session and Rich console for non-interactive use
    from unittest.mock import MagicMock
    eng.console = MagicMock()
    eng._history = None
    eng._session = None
    return eng


# ---------------------------------------------------------------------------
# Test session metadata & outcome capture
# ---------------------------------------------------------------------------

def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Deterministic unit tests")
    config.addinivalue_line("markers", "integration: Integration tests with subprocess")
    config.addinivalue_line("markers", "ai: AI agent tests requiring ANTHROPIC_API_KEY")
    config.addinivalue_line("markers", "demo: Demo walkthrough tests")
    config.addinivalue_line("markers", "slow: Tests that take >30 seconds")


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call):
    """Stash the test outcome on the item so fixtures can read it in teardown."""
    outcome = yield
    report = outcome.get_result()
    # We care about the "call" phase (not setup/teardown)
    if report.when == "call":
        item._test_report = report


def pytest_collection_modifyitems(config: pytest.Config, items: list) -> None:
    """Auto-skip AI tests when ANTHROPIC_API_KEY is not set."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return

    skip_ai = pytest.mark.skip(reason="ANTHROPIC_API_KEY not set")
    for item in items:
        if "ai" in item.keywords:
            item.add_marker(skip_ai)
