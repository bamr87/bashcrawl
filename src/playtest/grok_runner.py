"""Drive a sandboxed Bashcrawl session with the xAI Grok API.

Uses the OpenAI-compatible chat-completions endpoint and in-process harness
tools (no extra SDK). Credentials: OpenCode SuperGrok OAuth (``~/.local/share/opencode/auth.json``),
then ``XAI_ACCESS_TOKEN``, then console ``XAI_API_KEY`` / ``XAI_TOKEN``.
OAuth access JWTs are refreshed against ``https://auth.x.ai``. Never committed.

Usage::

    PYTHONPATH=src python3 -m playtest.grok_runner
    PYTHONPATH=src python3 -m playtest.grok_runner --seeds 1 --max-turns 40
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List

from .harness import PlaytestHarness
from .xai_auth import XaiAuthError, resolve_xai_creds

_API_URL = "https://api.x.ai/v1/chat/completions"
_DEFAULT_MODEL = "grok-4.6"

_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "bashcrawl_start",
            "description": "Begin a new game in a throwaway sandbox. Call this first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "fresh": {"type": "boolean", "default": True},
                    "context": {
                        "type": "boolean",
                        "default": True,
                        "description": "Attach a room HUD to every reply.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bashcrawl_observe",
            "description": "Look again: location, health, inventory, last output, room HUD.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bashcrawl_command",
            "description": "Run one shell command (or answer a y/n prompt).",
            "parameters": {
                "type": "object",
                "properties": {"line": {"type": "string"}},
                "required": ["line"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bashcrawl_state",
            "description": "JSON snapshot: room listing, scroll, inventory, HP. Does not change the game.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bashcrawl_report_gap",
            "description": "Report that the screen did not tell you what to do next.",
            "parameters": {
                "type": "object",
                "properties": {"note": {"type": "string"}},
                "required": ["note"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bashcrawl_stop",
            "description": "End the session and destroy the sandbox.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

_SYSTEM = """You are playtesting Bashcrawl, a filesystem dungeon that teaches bash.
Play ONLY through the provided tools. Do not invent filesystem access.

1. Call bashcrawl_start with fresh=true (and context=true unless asked otherwise).
2. Read the HUD. Act with bashcrawl_command — one shell line per call.
3. Call bashcrawl_state when you need the full scroll or a structured snapshot.
4. If the game does not tell you what to do, call bashcrawl_report_gap, then try your best.
5. Call bashcrawl_stop when you finish or are truly stuck.

Stay inside the game. Follow scrolls and encounter text."""


def _chat(
    messages: List[Dict[str, Any]],
    *,
    api_key: str,
    model: str,
    timeout: float,
) -> Dict[str, Any]:
    body = json.dumps(
        {
            "model": model,
            "messages": messages,
            "tools": _TOOLS,
            "tool_choice": "auto",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        _API_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400]
        raise RuntimeError(f"xAI HTTP {exc.code}: {detail}") from None


def _dispatch(harness: PlaytestHarness, name: str, args: Dict[str, Any]) -> str:
    if name == "bashcrawl_start":
        return harness.start(
            fresh=bool(args.get("fresh", True)),
            context=bool(args.get("context", True)),
        )
    if name == "bashcrawl_observe":
        return harness.observe()
    if name == "bashcrawl_command":
        return harness.command(str(args.get("line") or ""))
    if name == "bashcrawl_state":
        return harness.state_json(include_scroll=True)
    if name == "bashcrawl_report_gap":
        return harness.report_gap(str(args.get("note") or ""))
    if name == "bashcrawl_stop":
        harness.close()
        return "Session closed."
    return f"Unknown tool: {name}"


def run_session(
    *,
    api_key: str,
    model: str,
    max_turns: int,
    timeout: float,
    seed: int,
    chat: Callable[..., Dict[str, Any]] = _chat,
) -> None:
    harness = PlaytestHarness()
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": f"Begin playtest run #{seed}. Start the game now."},
    ]
    stopped = False
    try:
        for _ in range(max_turns):
            data = chat(messages, api_key=api_key, model=model, timeout=timeout)
            choice = (data.get("choices") or [{}])[0]
            msg = choice.get("message") or {}
            messages.append(msg)
            tool_calls = msg.get("tool_calls") or []
            if not tool_calls:
                break
            for call in tool_calls:
                fn = call.get("function") or {}
                name = str(fn.get("name") or "")
                raw_args = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
                except json.JSONDecodeError:
                    args = {}
                result = _dispatch(harness, name, args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id") or name,
                        "content": result,
                    }
                )
                if name == "bashcrawl_stop":
                    stopped = True
                    break
            if stopped:
                break
    finally:
        if not stopped:
            harness.close()


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=int(os.environ.get("BLANK_SLATE_SEEDS", "1")))
    parser.add_argument("--max-turns", type=int, default=int(os.environ.get("BLANK_SLATE_MAX_TURNS", "80")))
    parser.add_argument("--model", default=os.environ.get("GROK_MODEL") or os.environ.get("XAI_MODEL") or _DEFAULT_MODEL)
    parser.add_argument("--timeout", type=float, default=60.0)
    args = parser.parse_args(argv)

    try:
        creds = resolve_xai_creds()
    except XaiAuthError as exc:
        print(f"[playtest-grok] {exc} Skipping.", file=sys.stderr)
        return 0

    print(
        f"[playtest-grok] {args.seeds} session(s), model={args.model}, "
        f"max-turns={args.max_turns}, auth={creds.source}/{creds.kind}"
    )
    for seed in range(1, args.seeds + 1):
        print(f"[playtest-grok] --- seed {seed}/{args.seeds} ---")
        try:
            run_session(
                api_key=creds.bearer,
                model=args.model,
                max_turns=args.max_turns,
                timeout=args.timeout,
                seed=seed,
            )
        except Exception as exc:  # noqa: BLE001 — keep going across seeds
            print(f"[playtest-grok] seed {seed} failed: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
