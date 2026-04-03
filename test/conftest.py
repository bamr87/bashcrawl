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

@pytest.fixture(autouse=True)
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

@pytest.fixture(autouse=True)
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


@pytest.fixture(autouse=True)
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
def mcp_session(sandbox: Path):
    """``GameSession`` on an isolated sandbox (engine-only API, no Textual)."""
    from ti.session import GameSession

    return GameSession.load(sandbox, ensure_web_save_path=False)


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


# ---------------------------------------------------------------------------
# Retention policy — last-green + current-red
# ---------------------------------------------------------------------------

def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Write run metadata and apply retention policy after all tests finish.

    - Writes ``logs/.last_run_meta.json`` with the current run's file list.
    - If all tests passed (exitstatus == 0) AND the run was not filtered to a
      subset of tests (e.g. via ``-m`` or ``-k``): promotes to
      ``logs/.last_passing_run.json`` and deletes stale data.
    - Subset runs (marker/keyword filtered) NEVER overwrite the last-passing
      metadata — this prevents a 38-test TUI run from wiping data from a
      full 357-test run.
    - If any failed: keeps both current and last-passing data, deletes rest.
    """
    logs_dir = REPO_ROOT / "logs"

    # Detect whether this was a filtered (subset) run.
    # The default addopts in pytest.ini sets -m "not ai and not demo" — that
    # counts as a "full" run.  Any OTHER marker expression (e.g. -m tui) or
    # keyword filter (-k) is a subset run that should not overwrite the
    # last-passing metadata or trigger GC.
    _DEFAULT_MARKEXPR = "not ai and not demo"
    markexpr = getattr(session.config.option, "markexpr", "") or ""
    keyword = getattr(session.config.option, "keyword", "") or ""
    is_subset_run = bool(
        (markexpr.strip() and markexpr.strip() != _DEFAULT_MARKEXPR)
        or keyword.strip()
    )

    # Identify walkthrough screenshot dirs (golden candidates)
    walkthrough_screenshot_dirs = [
        d for d in _RUN_SCREENSHOT_DIRS
        if "walkthrough" in Path(d).name.lower()
    ]

    meta = {
        "run_id": _RUN_ID,
        "timestamp": datetime.now().isoformat(),
        "exitstatus": exitstatus,
        "outcome": "passed" if exitstatus == 0 else "failed",
        "is_subset_run": is_subset_run,
        "session_files": _RUN_SESSION_FILES,
        "screenshot_dirs": _RUN_SCREENSHOT_DIRS,
        "walkthrough_screenshot_dirs": walkthrough_screenshot_dirs,
    }

    meta_path = logs_dir / ".last_run_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")

    passing_path = logs_dir / ".last_passing_run.json"

    if exitstatus == 0 and not is_subset_run:
        # Only promote full (unfiltered) passing runs
        shutil.copy2(meta_path, passing_path)

        # Promote walkthrough screenshots to repo-level golden directory
        golden_dir = REPO_ROOT / "screenshots"
        if walkthrough_screenshot_dirs:
            # Clear existing SVGs (but not the directory itself)
            if golden_dir.exists():
                for old_svg in golden_dir.glob("*.svg"):
                    old_svg.unlink()
                for old_json in golden_dir.glob("manifest*.json"):
                    old_json.unlink()
            golden_dir.mkdir(parents=True, exist_ok=True)
            for src_dir_str in walkthrough_screenshot_dirs:
                src_dir = Path(src_dir_str)
                if src_dir.is_dir():
                    for svg in src_dir.glob("*.svg"):
                        shutil.copy2(svg, golden_dir / svg.name)
                    manifest = src_dir / "manifest.json"
                    if manifest.exists():
                        # Use dir-specific manifest name to avoid collisions
                        stem = Path(src_dir_str).name
                        shutil.copy2(manifest, golden_dir / f"manifest_{stem}.json")

    # Subset runs skip GC — they shouldn't delete data from full runs
    if is_subset_run:
        return

    # Build the set of files/dirs to keep
    keep_files: set[str] = set(_RUN_SESSION_FILES)
    keep_dirs: set[str] = set(_RUN_SCREENSHOT_DIRS)

    if passing_path.exists():
        try:
            passing_meta = json.loads(passing_path.read_text())
            keep_files.update(passing_meta.get("session_files", []))
            keep_dirs.update(passing_meta.get("screenshot_dirs", []))
            # Always preserve walkthrough screenshots from last passing run
            keep_dirs.update(passing_meta.get("walkthrough_screenshot_dirs", []))
        except (json.JSONDecodeError, OSError):
            pass

    # GC sessions
    sessions_dir = logs_dir / "sessions"
    if sessions_dir.is_dir():
        for f in sessions_dir.glob("*.jsonl"):
            if str(f) not in keep_files:
                f.unlink(missing_ok=True)

    # GC screenshots
    screenshots_dir = logs_dir / "screenshots"
    if screenshots_dir.is_dir():
        for d in screenshots_dir.iterdir():
            if d.is_dir() and not d.name.startswith(".") and str(d) not in keep_dirs:
                shutil.rmtree(d, ignore_errors=True)
