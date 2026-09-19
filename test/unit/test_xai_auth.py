"""xAI OAuth resolution tests — no live network, no real tokens."""

from __future__ import annotations

import json
import time
from pathlib import Path

import playtest.xai_auth as xai_auth


def _jwt(exp: float) -> str:
    import base64

    def b64(obj: dict) -> str:
        raw = json.dumps(obj, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    return ".".join([b64({"alg": "none"}), b64({"exp": int(exp)}), "sig"])


def test_jwt_expired():
    assert xai_auth.jwt_expired(_jwt(time.time() - 10)) is True
    assert xai_auth.jwt_expired(_jwt(time.time() + 3600)) is False


def test_resolve_prefers_opencode_oauth_over_api_key(tmp_path: Path, monkeypatch):
    token = _jwt(time.time() + 3600)
    store = tmp_path / "auth.json"
    store.write_text(
        json.dumps({"xai": {"type": "oauth", "access": token, "refresh": "r", "expires": int(time.time() * 1000) + 3_600_000}}),
        encoding="utf-8",
    )
    monkeypatch.setattr(xai_auth, "OPENCODE_AUTH", store)
    monkeypatch.setattr(xai_auth, "BASHCRAWL_AUTH", tmp_path / "missing.json")
    monkeypatch.setenv("XAI_TOKEN", "xai-stale-console-key")
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    monkeypatch.delenv("XAI_ACCESS_TOKEN", raising=False)
    creds = xai_auth.resolve_xai_creds()
    assert creds.kind == "oauth"
    assert creds.bearer == token
    assert creds.source == "opencode-auth.json"


def test_resolve_explicit_jwt_env(monkeypatch, tmp_path: Path):
    token = _jwt(time.time() + 3600)
    monkeypatch.setenv("XAI_ACCESS_TOKEN", token)
    monkeypatch.setattr(xai_auth, "OPENCODE_AUTH", tmp_path / "none.json")
    monkeypatch.setattr(xai_auth, "BASHCRAWL_AUTH", tmp_path / "none.json")
    creds = xai_auth.resolve_xai_creds()
    assert creds.source == "XAI_ACCESS_TOKEN"
    assert creds.bearer == token


def test_refresh_writes_store(tmp_path: Path, monkeypatch):
    old = _jwt(time.time() - 10)
    store = tmp_path / "auth.json"
    store.write_text(
        json.dumps({"xai": {"type": "oauth", "access": old, "refresh": "refresh-me", "expires": 1}}),
        encoding="utf-8",
    )
    new = _jwt(time.time() + 3600)

    def fake_refresh(_tok: str):
        return {"access_token": new, "refresh_token": "refresh-2", "expires_in": 3600}

    monkeypatch.setattr(xai_auth, "refresh_oauth", fake_refresh)
    creds = xai_auth.load_opencode_xai(store)
    assert creds is not None
    assert creds.bearer == new
    saved = json.loads(store.read_text(encoding="utf-8"))
    assert saved["xai"]["access"] == new
    assert saved["xai"]["refresh"] == "refresh-2"
