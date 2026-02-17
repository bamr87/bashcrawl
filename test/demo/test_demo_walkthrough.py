"""Demo walkthrough pytest tests.

Run with::

    pytest -m demo -v --timeout=120

Generates ``docs/demo-walkthrough.md`` — a comprehensive Markdown document
demonstrating the complete Bashcrawl game.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from demo.markdown_generator import MarkdownGenerator
from demo.runner import DemoRunner
from demo.script import CHAPTERS, CRITICAL_PATH_SCRIPT, FULL_GAME_SCRIPT


def _find_repo_root() -> Path:
    """Find the real bashcrawl repo root."""
    candidate = Path(__file__).resolve().parent
    for _ in range(6):
        candidate = candidate.parent
        if (candidate / "entrance").is_dir() and (candidate / "main.sh").is_file():
            return candidate
    raise FileNotFoundError("Cannot find bashcrawl repo root")


# ---------------------------------------------------------------------------
# Critical-path demo (fast, deterministic)
# ---------------------------------------------------------------------------


@pytest.mark.demo
class TestCriticalPathDemo:
    """Run the main quest (entrance → chamber) and generate a walkthrough."""

    @pytest.fixture
    def demo_sandbox(self, sandbox: Path) -> Path:
        """Return the sandbox game root."""
        return sandbox

    def test_critical_path_generates_markdown(self, demo_sandbox: Path) -> None:
        """Run entrance→cellar→armoury→chamber and produce markdown."""
        runner = DemoRunner(demo_sandbox)
        result = runner.run_full_demo(CRITICAL_PATH_SCRIPT)

        # Assertions
        assert result.success or len(result.errors) == 0, (
            f"Demo had errors: {result.errors}"
        )
        assert len(result.snapshots) == len(CRITICAL_PATH_SCRIPT)

        # Check key rooms were visited
        rooms = result.rooms_visited
        assert any("entrance" in r for r in rooms), "Should visit entrance"
        assert any("cellar" in r for r in rooms), "Should visit cellar"

        # Check key items
        items = result.items_collected
        assert "amulet" in items, "Should collect amulet"

        # Generate markdown
        gen = MarkdownGenerator(result, CRITICAL_PATH_SCRIPT)
        md = gen.render()

        assert "# Bashcrawl: Complete Game Walkthrough" in md
        assert "## Chapter 1:" in md
        assert "```bash" in md

        # Write to docs/
        repo_root = _find_repo_root()
        docs_dir = repo_root / "docs"
        docs_dir.mkdir(exist_ok=True)
        output_path = docs_dir / "demo-critical-path.md"
        output_path.write_text(md, encoding="utf-8")

        # Also copy to test reports
        reports_dir = repo_root / "test" / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(output_path, reports_dir / "demo-critical-path.md")


# ---------------------------------------------------------------------------
# Full game demo (slower — includes hidden rooms and combat)
# ---------------------------------------------------------------------------


@pytest.mark.demo
@pytest.mark.slow
class TestFullGameDemo:
    """Run the entire game and generate the full walkthrough document."""

    @pytest.fixture
    def demo_sandbox(self, sandbox: Path) -> Path:
        """Return the sandbox game root."""
        return sandbox

    def test_full_game_generates_markdown(self, demo_sandbox: Path) -> None:
        """Run all chapters and produce docs/demo-walkthrough.md.

        Note: combat encounters use ``$RANDOM`` so the monster/ghost
        fights may not always succeed on the first attempt.  The demo
        script sends a single number — if the combat fails, the
        snapshot will still record the attempt and the walkthrough will
        note the outcome.  The test does NOT assert on combat victory
        because it depends on randomness.
        """
        runner = DemoRunner(demo_sandbox)
        result = runner.run_full_demo(FULL_GAME_SCRIPT)

        # We don't require zero errors because hidden rooms depend
        # on precise unlock ordering and combat is random.
        # Instead we check that most steps produced output.
        successful = sum(
            1 for s in result.snapshots if s.exit_code == 0
        )
        total = len(result.snapshots)
        success_rate = successful / total if total > 0 else 0

        assert success_rate >= 0.6, (
            f"Too many failures: {successful}/{total} succeeded. "
            f"Errors: {result.errors[:5]}"
        )

        # Check core rooms
        rooms = result.rooms_visited
        assert any("entrance" in r for r in rooms), "Should visit entrance"

        # Generate markdown
        gen = MarkdownGenerator(result, FULL_GAME_SCRIPT)
        md = gen.render()

        assert "# Bashcrawl: Complete Game Walkthrough" in md
        assert len(md) > 5000, "Walkthrough should be substantive"

        # Count code blocks
        code_blocks = md.count("```bash")
        assert code_blocks >= 20, (
            f"Expected 20+ code blocks, got {code_blocks}"
        )

        # Verify all chapters present
        for ch in CHAPTERS:
            assert ch["name"] in md, f"Missing chapter: {ch['name']}"

        # Write to docs/
        repo_root = _find_repo_root()
        docs_dir = repo_root / "docs"
        docs_dir.mkdir(exist_ok=True)
        output_path = docs_dir / "demo-walkthrough.md"
        output_path.write_text(md, encoding="utf-8")

        # Also copy to test reports
        reports_dir = repo_root / "test" / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(output_path, reports_dir / "demo-walkthrough.md")

        print(f"\n✅ Walkthrough generated: {output_path}")
        print(f"   {len(md)} characters, {code_blocks} code blocks")
        print(f"   {len(result.rooms_visited)} rooms, "
              f"{len(result.items_collected)} items")
