"""Screenshot capture helper for test sessions.

Provides a reusable ``ScreenshotCapture`` class that:

1. Saves SVG screenshots from a Textual ``App`` or records paths to
   externally-generated screenshots.
2. Logs each capture as a ``screenshot`` event via ``TestLogCapture``.
3. Maintains a sequential counter for auto-naming.

Usage::

    cap = ScreenshotCapture(screenshot_dir=Path("/tmp/shots"), log_capture=lc)

    # From a Textual App (headless via run_test):
    path = cap.take(app, name="after_ls", command="ls", room="entrance")

    # From an already-saved file:
    cap.record(existing_svg_path, trigger="external", command="pwd")

    # Convenience: auto-named
    path = cap.take(app)  # → 001_screenshot.svg
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from fixtures.log_capture import TestLogCapture


class ScreenshotCapture:
    """Captures and logs SVG screenshots during test sessions."""

    def __init__(
        self,
        screenshot_dir: Path,
        log_capture: "TestLogCapture | None" = None,
    ) -> None:
        self.screenshot_dir = screenshot_dir
        self.log_capture = log_capture
        self._counter: int = 0
        self._paths: list[Path] = []

    @property
    def screenshots(self) -> list[Path]:
        """All screenshot paths captured so far."""
        return list(self._paths)

    @property
    def count(self) -> int:
        """Number of screenshots captured."""
        return len(self._paths)

    def take(
        self,
        app: Any,
        name: str = "",
        command: str = "",
        room: str = "",
        trigger: str = "auto",
    ) -> Path:
        """Save a screenshot from a Textual App and log it.

        Args:
            app: A Textual ``App`` instance (must have ``save_screenshot``).
            name: Filename stem (without extension). If empty, auto-generated.
            command: The command that triggered this screenshot (for logging).
            room: Current game room (for logging).
            trigger: Screenshot trigger type (``"auto"``, ``"explicit"``,
                ``"initial"``).

        Returns:
            Path to the saved SVG file.
        """
        self._counter += 1
        if not name:
            name = f"{self._counter:03d}_screenshot"
        if not name.endswith(".svg"):
            name += ".svg"

        path = self.screenshot_dir / name
        app.save_screenshot(str(path))
        self._paths.append(path)

        if self.log_capture:
            self.log_capture.log_screenshot(
                path=path,
                trigger=trigger,
                command=command,
                room=room,
            )

        return path

    def record(
        self,
        path: Path | str,
        trigger: str = "external",
        command: str = "",
        room: str = "",
    ) -> None:
        """Record an externally-generated screenshot and log it.

        Use this when the screenshot was already saved (e.g., by the
        agent subprocess) and you just want to log and track it.

        Args:
            path: Path to the existing SVG file.
            trigger: Screenshot trigger type.
            command: The command that triggered this screenshot.
            room: Current game room.
        """
        p = Path(path)
        self._paths.append(p)

        if self.log_capture:
            self.log_capture.log_screenshot(
                path=p,
                trigger=trigger,
                command=command,
                room=room,
            )

    def take_from_agent_output(
        self,
        agent_stdout: str,
    ) -> list[Path]:
        """Parse agent output for SCREENSHOT: lines and record them.

        Scans the stdout of a ``ti.agent`` subprocess for lines like::

            SCREENSHOT: /tmp/shots/001_ls.svg

        Records each as an ``external`` screenshot event.

        Args:
            agent_stdout: Full stdout from an agent subprocess run.

        Returns:
            List of screenshot paths found.
        """
        paths = []
        for line in agent_stdout.splitlines():
            line = line.strip()
            if line.startswith("SCREENSHOT:"):
                raw_path = line.split("SCREENSHOT:", 1)[1].strip()
                p = Path(raw_path)
                # Try to extract command from the filename
                command = ""
                stem = p.stem
                # Pattern: 001_cd_entrance → cd entrance (rough guess)
                parts = stem.split("_", 1)
                if len(parts) > 1:
                    command = parts[1].replace("_", " ")

                self.record(p, trigger="agent_auto", command=command)
                paths.append(p)
        return paths
