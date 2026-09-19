"""Unit tests for Grok playtest env loading and tool dispatch (no live API)."""

from __future__ import annotations

import json
import os
from pathlib import Path

from playtest.envfile import load_envfile, xai_api_key
from playtest.grok_runner import _dispatch, run_session
from playtest.harness import PlaytestHarness


def test_load_envfile_setdefault(tmp_path: Path, monkeypatch):
    envf = tmp_path / ".env"
    envf.write_text("XAI_TOKEN=from-file\nXAI_API_KEY=file-key\n", encoding="utf-8")
    monkeypatch.delenv("XAI_TOKEN", raising=False)
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    load_envfile(envf)
    assert os.environ["XAI_TOKEN"] == "from-file"
    monkeypatch.setenv("XAI_TOKEN", "already-set")
    envf.write_text("XAI_TOKEN=should-not-win\n", encoding="utf-8")
    load_envfile(envf)
    assert os.environ["XAI_TOKEN"] == "already-set"


def test_xai_api_key_prefers_official_name(monkeypatch):
    monkeypatch.setenv("XAI_API_KEY", "official")
    monkeypatch.setenv("XAI_TOKEN", "alias")
    assert xai_api_key() == "official"
    monkeypatch.delenv("XAI_API_KEY")
    assert xai_api_key() == "alias"


def test_dispatch_unknown_tool():
    harness = PlaytestHarness()
    assert "Unknown" in _dispatch(harness, "nope", {})


def test_run_session_fake_chat(tmp_path, monkeypatch):
    monkeypatch.setenv("BASHCRAWL_PLAYTEST_LOG_DIR", str(tmp_path))
    calls = {"n": 0}

    def fake_chat(messages, **_kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "id": "c1",
                                    "function": {
                                        "name": "bashcrawl_start",
                                        "arguments": json.dumps({"fresh": True, "context": True}),
                                    },
                                }
                            ],
                        }
                    }
                ]
            }
        if calls["n"] == 2:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "id": "c2",
                                    "function": {
                                        "name": "bashcrawl_stop",
                                        "arguments": "{}",
                                    },
                                }
                            ],
                        }
                    }
                ]
            }
        return {"choices": [{"message": {"role": "assistant", "content": "done"}}]}

    run_session(
        api_key="dummy",
        model="grok-4.6",
        max_turns=5,
        timeout=5,
        seed=1,
        chat=fake_chat,
    )
    assert calls["n"] >= 2
    assert list(tmp_path.glob("*.jsonl")), "harness should have written a session log"
