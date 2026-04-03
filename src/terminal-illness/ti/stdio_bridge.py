"""Line-oriented JSON protocol for AI / automation (no Textual UI).

Reads one command per line from stdin; prints one JSON object per line to stdout.
Designed for Cursor and other tools driving the game from a terminal or subprocess.

Protocol (version 1)
--------------------
First line after startup::

    {"type":"ready","protocol":1,"game_root":"..."}

For each non-empty input line (unless EXIT/QUIT)::

    {
      "type": "result",
      "command": "<raw line>",
      "exit": false,
      "outputs": [{"kind": "output|success|error|info|magic", "text": "..."}],
      "state": { ... snapshot ... }
    }

EXIT or QUIT (case-insensitive) saves and emits::

    {"type":"bye"}

Environment
-----------
Uses the same ``BASHCRAWL_WEB_MODE`` / per-session save path rules as ``ti.main``
when those vars are set.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .session import GameSession


def run_json_stdio(game_root: Path) -> None:
    """Run the engine with stdin/stdout JSON lines until EOF or exit."""
    session = GameSession.load(game_root, ensure_web_save_path=True)

    print(
        json.dumps(
            {
                "type": "ready",
                "protocol": 1,
                "game_root": str(game_root.resolve()),
            }
        ),
        flush=True,
    )

    for raw in sys.stdin:
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        if line.strip().upper() in ("EXIT", "QUIT"):
            session.save()
            print(json.dumps({"type": "bye"}), flush=True)
            return

        result, outputs = session.execute_line(line)
        payload = {
            "type": "result",
            "command": line,
            "exit": result == "exit",
            "outputs": outputs,
            "state": session.snapshot(),
        }
        print(json.dumps(payload), flush=True)
        if result == "exit":
            return
