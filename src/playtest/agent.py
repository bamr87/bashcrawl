"""Direct sandbox CLI for an AI agent (or a human) playing Bashcrawl.

Launches a clean throwaway copy of the dungeon. Three interfaces:

* default     — context HUD; type commands like a player
* ``--json``  — one JSON object per turn on stdout (stdin = commands)
* ``--pty``   — raw interactive bash in the sandbox, as a user would play
* ``--blind`` — location/HP/inventory only (same face as blank-slate MCP)

Usage::

    PYTHONPATH=src python3 -m playtest.agent
    PYTHONPATH=src python3 -m playtest.agent --json
    PYTHONPATH=src python3 -m playtest.agent --pty
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys

from .harness import PlaytestHarness
from .sandbox import create_sandbox, destroy_sandbox, game_env, sandbox_game_dir


def _run_pty() -> int:
    sandbox = create_sandbox()
    game = sandbox_game_dir(sandbox)
    env = game_env(game)
    env.setdefault("PS1", r"\w \$ ")
    env.setdefault("TERM", os.environ.get("TERM", "dumb"))
    entrance = game / "entrance"
    print("Sandboxed bash — play as a user. `exit` destroys the sandbox.", file=sys.stderr)
    try:
        return subprocess.call(
            ["bash", "--norc", "--noprofile", "-i"],
            cwd=str(entrance),
            env=env,
        )
    finally:
        destroy_sandbox(sandbox)


def _json_loop(harness: PlaytestHarness, full: bool) -> int:
    packet = harness.state(include_scroll=full)
    packet["ok"] = True
    print(json.dumps(packet), flush=True)
    for raw in sys.stdin:
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        if line.strip() in {"exit", "quit"}:
            break
        harness.command(line)
        packet = harness.state(include_scroll=full)
        packet["ok"] = True
        print(json.dumps(packet), flush=True)
    return 0


def _text_loop(harness: PlaytestHarness, *, blind: bool, full: bool) -> int:
    if blind:
        print(harness.observe())
    else:
        print(harness.state_text(include_scroll=full))
    print("\nType a command (`exit` to quit).", file=sys.stderr)
    while True:
        try:
            line = input("> ")
        except EOFError:
            print()
            break
        if line.strip() in {"exit", "quit"}:
            break
        if not line.strip():
            continue
        if line.strip() in {"state", "look"} and not blind:
            print(harness.state_text(include_scroll=True))
            continue
        print(harness.command(line))
        if not blind and full:
            scroll = harness.state(include_scroll=True).get("scroll")
            if scroll and "--- scroll ---" not in harness.last_output:
                print("\n--- scroll ---\n" + scroll.rstrip() + "\n--- end scroll ---")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python3 -m playtest.agent",
        description="Launch a clean Bashcrawl sandbox for an agent (or a human).",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--json", action="store_true", help="JSONL turn protocol on stdout")
    mode.add_argument("--pty", action="store_true", help="raw interactive bash (user-like)")
    mode.add_argument("--blind", action="store_true", help="no HUD beyond location/HP/inventory")
    parser.add_argument(
        "--full",
        action="store_true",
        help="include the full room scroll in every JSON/HUD turn",
    )
    args = parser.parse_args(argv)

    if args.pty:
        return _run_pty()

    harness = PlaytestHarness()

    def _quit(*_: object) -> None:
        harness.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, _quit)
    try:
        harness.start(fresh=True, context=not args.blind)
        if args.json:
            return _json_loop(harness, args.full)
        return _text_loop(harness, blind=args.blind, full=args.full)
    finally:
        harness.close()


if __name__ == "__main__":
    sys.exit(main())
