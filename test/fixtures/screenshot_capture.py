"""Screenshot capture helper for test sessions.

Provides a reusable ``ScreenshotCapture`` class that:

1. Saves SVG screenshots from a Textual ``App`` or records paths to
   externally-generated screenshots.
2. Logs each capture as a ``screenshot`` event via ``TestLogCapture``.
3. Maintains a sequential counter for auto-naming.
4. Writes a JSON manifest summarising all captures for review.

Screenshots are stored under ``logs/screenshots/<session>/`` so they
persist after tests complete and are available for analysis.

Usage::

    cap = ScreenshotCapture(screenshot_dir=logs / "screenshots" / session, log_capture=lc)

    # From a Textual App (headless via run_test):
    path = cap.take(app, name="after_ls", command="ls", room="entrance")

    # From an already-saved file:
    cap.record(existing_svg_path, trigger="external", command="pwd")

    # Convenience: auto-named
    path = cap.take(app)  # → 001_screenshot.svg

    # After session — write a manifest for review
    cap.write_manifest()
"""

from __future__ import annotations

import json
from datetime import datetime
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
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)
        self.log_capture = log_capture
        self._counter: int = 0
        self._paths: list[Path] = []
        self._metadata: list[dict[str, Any]] = []

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

        meta = {
            "path": str(path),
            "name": name,
            "trigger": trigger,
            "command": command,
            "room": room,
            "ts": datetime.now().isoformat(),
        }
        if path.is_file():
            meta["size_bytes"] = path.stat().st_size
        self._metadata.append(meta)

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

        meta = {
            "path": str(p),
            "name": p.name,
            "trigger": trigger,
            "command": command,
            "room": room,
            "ts": datetime.now().isoformat(),
        }
        if p.is_file():
            meta["size_bytes"] = p.stat().st_size
        self._metadata.append(meta)

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

    # -- manifest & metadata -----------------------------------------------

    @property
    def metadata(self) -> list[dict[str, Any]]:
        """All screenshot metadata collected so far."""
        return list(self._metadata)

    def write_manifest(self) -> Path | None:
        """Write a JSON manifest of all screenshots to the screenshot dir.

        The manifest enables post-test review tools to enumerate captures
        without scanning the filesystem.  It is written even if no
        screenshots were captured (records an empty list).

        Returns:
            Path to the manifest file, or ``None`` if no screenshot dir.
        """
        if not self.screenshot_dir.exists():
            return None

        manifest = {
            "generated_at": datetime.now().isoformat(),
            "screenshot_dir": str(self.screenshot_dir),
            "total_screenshots": self.count,
            "total_size_bytes": sum(
                m.get("size_bytes", 0) for m in self._metadata
            ),
            "screenshots": self._metadata,
        }
        manifest_path = self.screenshot_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        return manifest_path
