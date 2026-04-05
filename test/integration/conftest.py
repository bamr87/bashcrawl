"""Integration-only pytest fixtures and retention hooks."""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

import pytest

import conftest as root_conftest


@pytest.fixture(autouse=True)
def _integration_capture_fixtures(log_capture, screenshot_dir, screenshot_capture):
    """Enable logging/screenshot fixtures automatically for integration tests."""
    yield


@pytest.fixture
def mcp_session(sandbox: Path):
    """``GameSession`` on an isolated sandbox (engine-only API, no Textual)."""
    from ti.session import GameSession

    return GameSession.load(sandbox, ensure_web_save_path=False)


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Write run metadata and apply retention policy after integration runs."""
    logs_dir = root_conftest.REPO_ROOT / "logs"

    # Detect whether this was a filtered (subset) run.
    _DEFAULT_MARKEXPR = "not ai and not demo"
    markexpr = getattr(session.config.option, "markexpr", "") or ""
    keyword = getattr(session.config.option, "keyword", "") or ""
    is_subset_run = bool(
        (markexpr.strip() and markexpr.strip() != _DEFAULT_MARKEXPR)
        or keyword.strip()
    )

    walkthrough_screenshot_dirs = [
        d for d in root_conftest._RUN_SCREENSHOT_DIRS
        if "walkthrough" in Path(d).name.lower()
    ]

    meta = {
        "run_id": root_conftest._RUN_ID,
        "timestamp": datetime.now().isoformat(),
        "exitstatus": exitstatus,
        "outcome": "passed" if exitstatus == 0 else "failed",
        "is_subset_run": is_subset_run,
        "session_files": root_conftest._RUN_SESSION_FILES,
        "screenshot_dirs": root_conftest._RUN_SCREENSHOT_DIRS,
        "walkthrough_screenshot_dirs": walkthrough_screenshot_dirs,
    }

    meta_path = logs_dir / ".last_run_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")

    passing_path = logs_dir / ".last_passing_run.json"

    if exitstatus == 0 and not is_subset_run:
        shutil.copy2(meta_path, passing_path)

        golden_dir = root_conftest.REPO_ROOT / "screenshots"
        if walkthrough_screenshot_dirs:
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
                        stem = Path(src_dir_str).name
                        shutil.copy2(manifest, golden_dir / f"manifest_{stem}.json")

    if is_subset_run:
        return

    keep_files: set[str] = set(root_conftest._RUN_SESSION_FILES)
    keep_dirs: set[str] = set(root_conftest._RUN_SCREENSHOT_DIRS)

    if passing_path.exists():
        try:
            passing_meta = json.loads(passing_path.read_text())
            keep_files.update(passing_meta.get("session_files", []))
            keep_dirs.update(passing_meta.get("screenshot_dirs", []))
            keep_dirs.update(passing_meta.get("walkthrough_screenshot_dirs", []))
        except (json.JSONDecodeError, OSError):
            pass

    sessions_dir = logs_dir / "sessions"
    if sessions_dir.is_dir():
        for f in sessions_dir.glob("*.jsonl"):
            if str(f) not in keep_files:
                f.unlink(missing_ok=True)

    screenshots_dir = logs_dir / "screenshots"
    if screenshots_dir.is_dir():
        for d in screenshots_dir.iterdir():
            if d.is_dir() and not d.name.startswith(".") and str(d) not in keep_dirs:
                shutil.rmtree(d, ignore_errors=True)
