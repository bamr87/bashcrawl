"""LiveAgentLogger — writes real-time agent events to logs/live_agent.jsonl.

The file is tailed by the Flask viewer's SSE endpoint so the browser
can display a live terminal-style view of the AI agent's session.

File location: <repo_root>/logs/live_agent.jsonl
Reset on each new session; appended per event.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from threading import Lock

_write_lock = Lock()

# Locate repo root relative to this file: test/ai/live_logger.py → repo/
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
LIVE_LOG_PATH = _REPO_ROOT / "logs" / "live_agent.jsonl"


def _write(event: dict) -> None:
    """Append a JSON-encoded event to the live log file (thread-safe)."""
    event.setdefault("ts", time.time())
    line = json.dumps(event, ensure_ascii=False)
    with _write_lock:
        try:
            LIVE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(LIVE_LOG_PATH, "a", encoding="utf-8") as fh:
                fh.write(line + "\n")
                fh.flush()
        except OSError:
            pass  # never crash the test just because logging failed


def session_start(test_name: str, goal: str, max_turns: int, max_elapsed: float) -> None:
    """Emit a session_start event, resetting the live log file."""
    try:
        LIVE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LIVE_LOG_PATH, "w", encoding="utf-8") as fh:
            fh.write("")  # truncate
    except OSError:
        pass
    _write({
        "type": "session_start",
        "test": test_name,
        "goal": goal,
        "max_turns": max_turns,
        "max_elapsed": max_elapsed,
    })


def command(
    turn: int,
    cmd: str,
    output: str,
    location: str,
    inventory: str,
    hp: int,
) -> None:
    """Emit a command execution event."""
    _write({
        "type": "command",
        "turn": turn,
        "cmd": cmd,
        "output": output[:800],   # keep payloads bounded
        "location": location,
        "inventory": inventory,
        "hp": hp,
    })


def api_call(model: str, tokens_in: int = 0, tokens_out: int = 0) -> None:
    """Emit an Anthropic API call event."""
    _write({
        "type": "api_call",
        "model": model,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    })


def rate_limit(sleep_seconds: float, rpm_cap: int) -> None:
    """Emit a rate-limit throttle event."""
    _write({
        "type": "rate_limit",
        "sleep": round(sleep_seconds, 2),
        "rpm_cap": rpm_cap,
    })


def session_end(
    exit_reason: str,
    total_turns: int,
    rooms_visited: list[str],
    final_location: str,
    final_inventory: str,
    final_hp: int,
    elapsed: float,
) -> None:
    """Emit a session_end event."""
    _write({
        "type": "session_end",
        "exit_reason": exit_reason,
        "total_turns": total_turns,
        "rooms_visited": rooms_visited,
        "final_location": final_location,
        "final_inventory": final_inventory,
        "final_hp": final_hp,
        "elapsed": round(elapsed, 2),
    })


def agent_feedback(rating: str, issues: str, suggestions: str, raw: str) -> None:
    """Emit the AI's end-of-session feedback."""
    _write({
        "type": "feedback",
        "rating": rating,
        "issues": issues,
        "suggestions": suggestions,
        "raw": raw[:1000],
    })
