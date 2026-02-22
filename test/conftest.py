"""Pytest configuration and shared fixtures for Bashcrawl testing.

Provides:
- game_root: Path to the real bashcrawl repo root
- sandbox: Isolated game copy for mutation-safe tests
- game_fs: GameFileSystem pointing at sandbox
- game_state: Fresh GameState for testing
- log_capture: TestLogCapture for JSONL event tracking
- screenshot_dir: Session-specific screenshot directory under ``logs/screenshots/``
- screenshot_capture: ScreenshotCapture wired to log_capture
- ai_agent: TestAgent (only for @pytest.mark.ai tests)
"""

from __future__ import annotations

import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Generator

import pytest

# Add test/ and src/terminal-illness/ to Python path
TEST_DIR = Path(__file__).resolve().parent
REPO_ROOT = TEST_DIR.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"

sys.path.insert(0, str(TEST_DIR))
sys.path.insert(0, str(TI_DIR))

from fixtures import create_sandbox, destroy_sandbox, find_game_root, game_env
from fixtures.log_capture import TestLogCapture


# ---------------------------------------------------------------------------
# Core fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def game_root() -> Path:
    """Path to the real bashcrawl repo root (read-only reference)."""
    return find_game_root()


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
def game_state() -> "GameState":
    """Fresh GameState for testing."""
    from ti.game_state import GameState
    return GameState()


@pytest.fixture
def log_capture(sandbox: Path, request: pytest.FixtureRequest) -> TestLogCapture:
    """TestLogCapture that writes to the repo's ``logs/sessions/`` directory.

    Session JSONL files are persisted in the real ``logs/`` tree so they
    remain available for post-test review and analysis.
    """
    log_dir = REPO_ROOT / "logs" / "sessions"
    log_dir.mkdir(parents=True, exist_ok=True)
    test_name = request.node.name
    capture = TestLogCapture(
        log_dir=log_dir,
        scenario="test",
        test_name=test_name,
    )
    capture.start()
    yield capture
    capture.end()

    # Copy to reports directory for quick access
    reports_dir = TEST_DIR / "reports" / "ai_sessions"
    reports_dir.mkdir(parents=True, exist_ok=True)
    if capture.file_path.exists():
        shutil.copy2(capture.file_path, reports_dir / capture.file_path.name)


@pytest.fixture
def screenshot_dir(request: pytest.FixtureRequest) -> Path:
    """Session-specific screenshot directory under ``logs/screenshots/``.

    Structure:  ``logs/screenshots/<date>_<test_name>/``

    Screenshots persist after tests for review and analysis.
    """
    datestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    test_name = request.node.name.replace("[", "_").replace("]", "")
    d = REPO_ROOT / "logs" / "screenshots" / f"{datestamp}_{test_name}"
    d.mkdir(parents=True, exist_ok=True)
    return d


@pytest.fixture
def screenshot_capture(screenshot_dir: Path, log_capture: TestLogCapture):
    """Screenshot helper wired to TestLogCapture and the ``logs/`` tree.

    Saves SVG screenshots to ``logs/screenshots/<session>/`` and logs each
    capture as a JSONL event.  After the test, writes a summary manifest.

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
    # Write a manifest after the test completes
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
# AI Agent fixture (only loaded when @pytest.mark.ai is used)
# ---------------------------------------------------------------------------

@pytest.fixture
def ai_agent(request):
    """TestAgent using Anthropic Claude (requires ANTHROPIC_API_KEY)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        pytest.skip("ANTHROPIC_API_KEY not set — skipping AI test")

    from ai.agent import TestAgent
    from ai import live_logger as _live

    # Tag the engine with a test name for live stream display
    test_name = request.node.name
    agent = TestAgent(api_key=api_key)
    # Store test_name on the agent so session_runner can read it
    object.__setattr__(agent, "_test_name", test_name) if hasattr(agent, "__dataclass_fields__") else setattr(agent, "_test_name", test_name)
    # Announce the fixture creation to the live log (session_start fires later via run_session)
    try:
        _live._write({"type": "agent_ready", "test": test_name})
    except Exception:
        pass
    return agent


# ---------------------------------------------------------------------------
# Test session metadata
# ---------------------------------------------------------------------------

def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Deterministic unit tests")
    config.addinivalue_line("markers", "integration: Integration tests with subprocess")
    config.addinivalue_line("markers", "ai: AI agent tests requiring ANTHROPIC_API_KEY")
    config.addinivalue_line("markers", "slow: Tests that take >30 seconds")


def pytest_collection_modifyitems(config: pytest.Config, items: list) -> None:
    """Auto-skip AI tests when ANTHROPIC_API_KEY is not set."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return

    skip_ai = pytest.mark.skip(reason="ANTHROPIC_API_KEY not set")
    for item in items:
        if "ai" in item.keywords:
            item.add_marker(skip_ai)
