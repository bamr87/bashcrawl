"""Resolve an xAI bearer token for playtests.

OpenCode stores SuperGrok as OAuth (``~/.local/share/opencode/auth.json``):
access JWT + refresh token from ``https://auth.x.ai``. Console API keys
(``xai-…``) are a different credential and are tried last.

Never logs token values. Refresh writes back to the file they came from.
"""

from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from .envfile import load_envfile

CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828"
TOKEN_URL = "https://auth.x.ai/oauth2/token"
DEVICE_URL = "https://auth.x.ai/oauth2/device/code"
SCOPE = "openid profile email offline_access grok-cli:access api:access"
_SKEW_S = 120

OPENCODE_AUTH = Path.home() / ".local" / "share" / "opencode" / "auth.json"
BASHCRAWL_AUTH = Path.home() / ".config" / "bashcrawl" / "xai-oauth.json"


@dataclass
class XaiCreds:
    bearer: str
    kind: str  # "oauth" | "api_key"
    source: str
    refresh: str = ""
    expires: int = 0  # unix ms, 0 = unknown
    store: Optional[Path] = None


class XaiAuthError(RuntimeError):
    pass


def _b64url_json(segment: str) -> Dict[str, Any]:
    pad = "=" * (-len(segment) % 4)
    return json.loads(base64.urlsafe_b64decode(segment + pad))


def jwt_expired(token: str, skew_s: int = _SKEW_S) -> bool:
    try:
        payload = _b64url_json(token.split(".")[1])
        exp = payload.get("exp")
        if not isinstance(exp, (int, float)):
            return True
        return float(exp) <= time.time() + skew_s
    except (IndexError, ValueError, json.JSONDecodeError, OSError):
        return True


def _form_post(url: str, fields: Dict[str, str], timeout: float = 30.0) -> Dict[str, Any]:
    body = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "bashcrawl-playtest/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                parsed["_http"] = exc.code
                return parsed
        except json.JSONDecodeError:
            pass
        raise XaiAuthError(f"xAI auth HTTP {exc.code}") from None


def refresh_oauth(refresh_token: str) -> Dict[str, Any]:
    data = _form_post(
        TOKEN_URL,
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": CLIENT_ID,
        },
    )
    access = data.get("access_token")
    if data.get("error") or not access:
        raise XaiAuthError("xAI refresh failed")
    return data


def _atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def _oauth_record(blob: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(blob, dict):
        return None
    if blob.get("type") == "oauth":
        return blob
    inner = blob.get("xai")
    if isinstance(inner, dict) and inner.get("type") == "oauth":
        return inner
    return None


def _persist_oauth(store: Path, access: str, refresh: str, expires_ms: int) -> None:
    blob: Dict[str, Any] = {}
    if store.is_file():
        try:
            loaded = json.loads(store.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                blob = loaded
        except json.JSONDecodeError:
            blob = {}
    record = {"type": "oauth", "access": access, "refresh": refresh, "expires": expires_ms}
    if blob.get("type") == "oauth":
        blob = record
    else:
        blob["xai"] = record
    _atomic_write_json(store, blob)


def _from_oauth_blob(blob: Dict[str, Any], source: str, store: Path) -> Optional[XaiCreds]:
    entry = _oauth_record(blob)
    if not entry:
        return None
    access = str(entry.get("access") or "")
    refresh = str(entry.get("refresh") or "")
    expires = int(entry.get("expires") or 0)
    if not access:
        return None
    creds = XaiCreds(
        bearer=access,
        kind="oauth",
        source=source,
        refresh=refresh,
        expires=expires,
        store=store,
    )
    stale = (expires and expires - int(time.time() * 1000) <= _SKEW_S * 1000) or jwt_expired(access)
    if stale and refresh:
        data = refresh_oauth(refresh)
        new_refresh = str(data.get("refresh_token") or refresh)
        expires_ms = int(time.time() * 1000) + int(data.get("expires_in") or 3600) * 1000
        creds = XaiCreds(
            bearer=str(data["access_token"]),
            kind="oauth",
            source=source + "+refresh",
            refresh=new_refresh,
            expires=expires_ms,
            store=store,
        )
        try:
            _persist_oauth(store, creds.bearer, creds.refresh, creds.expires)
        except OSError:
            pass
    return creds


def load_opencode_xai(path: Path | None = None) -> Optional[XaiCreds]:
    store = path or OPENCODE_AUTH
    if not store.is_file():
        return None
    try:
        blob = json.loads(store.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(blob, dict):
        return None
    return _from_oauth_blob(blob, "opencode-auth.json", store)


def load_bashcrawl_xai(path: Path | None = None) -> Optional[XaiCreds]:
    store = path or BASHCRAWL_AUTH
    if not store.is_file():
        return None
    try:
        blob = json.loads(store.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(blob, dict):
        return None
    return _from_oauth_blob(blob, "bashcrawl-oauth.json", store)


def resolve_xai_creds() -> XaiCreds:
    """Pick a bearer token. OAuth (OpenCode / local store) beats stale console keys."""
    load_envfile()
    jwt = (os.environ.get("XAI_ACCESS_TOKEN") or "").strip()
    if jwt.startswith("eyJ"):
        return XaiCreds(bearer=jwt, kind="oauth", source="XAI_ACCESS_TOKEN")

    for loader in (load_opencode_xai, load_bashcrawl_xai):
        creds = loader()
        if creds:
            return creds

    for var in ("XAI_API_KEY", "XAI_TOKEN"):
        val = (os.environ.get(var) or "").strip()
        if val.startswith("eyJ"):
            return XaiCreds(bearer=val, kind="oauth", source=var)
        if val:
            return XaiCreds(bearer=val, kind="api_key", source=var)

    raise XaiAuthError(
        "No xAI credentials. Connect SuperGrok in OpenCode (/connect → xAI), "
        "or set XAI_API_KEY, or run: python3 -m playtest.xai_auth login"
    )


def device_login(*, store: Path | None = None, timeout_s: float = 300.0) -> XaiCreds:
    """RFC 8628 device-code login (same client as OpenCode SuperGrok)."""
    start = _form_post(
        DEVICE_URL,
        {"client_id": CLIENT_ID, "scope": SCOPE, "referrer": "bashcrawl"},
    )
    uri = start.get("verification_uri_complete") or start.get("verification_uri")
    code = start.get("user_code")
    device = start.get("device_code")
    if not uri or not device:
        raise XaiAuthError("xAI device-code response incomplete")
    print(f"Open {uri}")
    if code:
        print(f"Code: {code}")
    interval = max(float(start.get("interval") or 5), 1.0)
    deadline = time.time() + min(float(start.get("expires_in") or timeout_s), timeout_s)
    while time.time() < deadline:
        time.sleep(interval)
        try:
            data = _form_post(
                TOKEN_URL,
                {
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "client_id": CLIENT_ID,
                    "device_code": str(device),
                },
            )
        except XaiAuthError:
            continue
        err = data.get("error")
        if err in {"authorization_pending", "slow_down"}:
            if err == "slow_down":
                interval += 5
            continue
        if err in {"access_denied", "authorization_denied", "expired_token"}:
            raise XaiAuthError(f"xAI device login: {err}")
        access = data.get("access_token")
        if not access:
            continue
        refresh = str(data.get("refresh_token") or "")
        expires_ms = int(time.time() * 1000) + int(data.get("expires_in") or 3600) * 1000
        dest = store or BASHCRAWL_AUTH
        _persist_oauth(dest, str(access), refresh, expires_ms)
        return XaiCreds(
            bearer=str(access),
            kind="oauth",
            source="device-login",
            refresh=refresh,
            expires=expires_ms,
            store=dest,
        )
    raise XaiAuthError("xAI device login timed out")


def main(argv: Optional[list[str]] = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="xAI OAuth for Bashcrawl playtests")
    parser.add_argument("cmd", nargs="?", default="status", choices=["status", "login"])
    args = parser.parse_args(argv)
    if args.cmd == "login":
        creds = device_login()
        print(f"ok kind={creds.kind} source={creds.source}")
        return 0
    try:
        creds = resolve_xai_creds()
    except XaiAuthError as exc:
        print(f"error: {exc}")
        return 1
    print(f"ok kind={creds.kind} source={creds.source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
