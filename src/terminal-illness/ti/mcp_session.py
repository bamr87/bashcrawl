"""Headless Bashcrawl TUI session using Textual ``run_test`` / Pilot."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

from .app import BashcrawlApp
from .filesystem import GameFileSystem
from .game_state import GameState
from .session import snapshot_state


class HeadlessSession:
    """Drives ``BashcrawlApp`` in headless mode for agents, MCP, and tests."""

    def __init__(
        self,
        game_root: Path,
        *,
        save_path: Optional[Path] = None,
        terminal_size: tuple[int, int] = (120, 40),
        default_player_name: str = "Agent",
    ) -> None:
        self.game_root = Path(game_root).resolve()
        self._save_path = save_path
        self._terminal_size = terminal_size
        self._default_player_name = default_player_name
        self._run_cm: Any = None
        self._pilot: Any = None
        self._app: Optional[BashcrawlApp] = None

    @property
    def app(self) -> BashcrawlApp:
        if self._app is None:
            raise RuntimeError("HeadlessSession is not started")
        return self._app

    @property
    def pilot(self) -> Any:
        if self._pilot is None:
            raise RuntimeError("HeadlessSession is not started")
        return self._pilot

    async def start(self) -> None:
        """Enter ``run_test`` context and wait for the UI to settle."""
        fs = GameFileSystem(self.game_root)
        load_path = self._save_path or (self.game_root / ".bashcrawl_save.json")
        state = GameState.load(save_path=load_path)
        if self._save_path:
            state._save_path = self._save_path  # type: ignore[attr-defined]
        state.player_name = state.player_name or self._default_player_name

        self._app = BashcrawlApp(state=state, fs=fs, agent_mode=True)
        self._run_cm = self._app.run_test(size=self._terminal_size)
        self._pilot = await self._run_cm.__aenter__()
        await self._pilot.pause()
        await asyncio.sleep(0.1)
        await self._pilot.pause()

    async def stop(self) -> None:
        """Exit headless mode and persist game state."""
        if self._run_cm is not None:
            try:
                await self._run_cm.__aexit__(None, None, None)
            finally:
                self._run_cm = None
                self._pilot = None
        if self._app is not None:
            sp = self._save_path or getattr(self._app.game_state, "_save_path", None)
            self._app.game_state.save(save_path=sp)
            self._app = None

    def _engine(self) -> Any:
        return self.app._engine

    def snapshot(self) -> Dict[str, Any]:
        eng = self._engine()
        return snapshot_state(self.app.game_state, self.app.fs, eng)

    def get_room(self) -> Dict[str, Any]:
        eng = self._engine()
        cwd = eng.cwd()
        try:
            items = self.app.fs.ls(cwd, "")
        except Exception:
            items = []
        return {"cwd": cwd, "items": items}

    def get_completions(self, text: str) -> List[str]:
        return self._engine().get_completions(text)

    async def submit_command(self, line: str) -> None:
        """Inject a command into ``#command-input`` and submit (like the agent REPL)."""
        inp = self.app.query_one("#command-input")
        inp.value = line
        await inp.action_submit()
        await self._pilot.pause()  # type: ignore[union-attr]
        await asyncio.sleep(0.05)
        await self._pilot.pause()  # type: ignore[union-attr]

    async def submit_command_with_outputs(self, line: str) -> List[Dict[str, str]]:
        """Submit via the TUI input path while capturing engine output lines."""
        buf: List[tuple[str, str]] = []
        eng = self._engine()
        prev = eng._output_callback

        def mux(kind: str, message: str) -> None:
            buf.append((kind, message))
            if prev is not None:
                prev(kind, message)

        eng._output_callback = mux
        try:
            inp = self.app.query_one("#command-input")
            inp.value = line
            await inp.action_submit()
            await self._pilot.pause()  # type: ignore[union-attr]
            await asyncio.sleep(0.05)
            await self._pilot.pause()  # type: ignore[union-attr]
        finally:
            eng._output_callback = prev
        return [{"kind": k, "text": t} for k, t in buf]

    def export_screenshot_svg(self) -> str:
        """Return the current screen as SVG text."""
        return self.app.export_screenshot()

    def save_screenshot(self, path: str | Path) -> None:
        """Write SVG screenshot to *path*."""
        self.app.save_screenshot(str(path))
