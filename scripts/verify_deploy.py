#!/usr/bin/env python3
"""Check that a deployed site is live and is the build that was meant to ship.

The deploy workflow runs this after every deploy and before it reports
success (hub specs/OPERATIONS.md, UPS-OPS-42; the site is static, so its
liveness probe /healthz stands in for /readyz). It asks the live site for
the two files scripts/write_build_info.py wrote into the build:

    GET <url>/healthz   must answer {"status": "ok"}
    GET <url>/version   must report the expected commit (--commit)

A fresh deploy takes a moment to reach every edge, so the checks are retried
as a set until they all pass or the attempts run out. With --swa it also
requires what the generated staticwebapp.config.json adds (scripts/
write_swa_config.py): a JSON content type on both probes and a
Content-Security-Policy on the page, which proves the config was applied.

Usage:
    python3 scripts/verify_deploy.py https://example.com
    python3 scripts/verify_deploy.py https://example.com --commit "$(git rev-parse HEAD)" --swa
    make deploy-verify URL=https://example.com ARGS="--swa"

Exit status: 0 when every check passed, 1 when the attempts ran out.

stdlib only: the deploy job runs it on the runner's own python3.
"""

from __future__ import annotations

import argparse
import http.client
import json
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field

# A short commit is still a commit: accept a prefix this long or longer.
MIN_COMMIT_PREFIX = 7


@dataclass(frozen=True)
class Response:
    """The parts of an HTTP answer the checks read."""

    status: int
    body: bytes = b""
    headers: dict[str, str] = field(default_factory=dict)  # names lower-cased


Fetch = Callable[[str, float], Response]


def fetch(url: str, timeout: float) -> Response:
    """GET `url`, following redirects. An unreachable host is status 0."""
    request = urllib.request.Request(
        url, headers={"Cache-Control": "no-cache", "User-Agent": "deploy-verify"}
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as reply:
            headers = {name.lower(): value for name, value in reply.headers.items()}
            return Response(reply.status, reply.read(), headers)
    except urllib.error.HTTPError as exc:
        headers = {name.lower(): value for name, value in exc.headers.items()}
        return Response(exc.code, exc.read(), headers)
    except (urllib.error.URLError, http.client.HTTPException, OSError) as exc:
        return Response(0, str(exc).encode("utf-8"))


def same_commit(expected: str, actual: str) -> bool:
    """True when one names the other: equal, or a short SHA of the full one."""
    expected, actual = expected.strip().lower(), actual.strip().lower()
    if not expected or not actual:
        return False
    shorter = min(len(expected), len(actual))
    if shorter < MIN_COMMIT_PREFIX:
        return expected == actual
    return expected[:shorter] == actual[:shorter]


def _json_object(response: Response, path: str, swa: bool) -> tuple[dict[str, object], str]:
    """(payload, problem) for a probe; `problem` is empty when it parsed."""
    if response.status == 0:
        reason = response.body.decode("utf-8", "replace").strip()[:120]
        return {}, f"{path}: unreachable ({reason})"
    if response.status != 200:
        return {}, f"{path}: HTTP {response.status}"
    try:
        payload = json.loads(response.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}, f"{path}: the body is not JSON"
    if not isinstance(payload, dict):
        return {}, f"{path}: the body is not a JSON object"
    content_type = response.headers.get("content-type", "")
    if swa and "json" not in content_type.lower():
        return payload, f"{path}: content type is {content_type or 'missing'}, not JSON"
    return payload, ""


def problems(
    base: str,
    commit: str = "",
    swa: bool = False,
    timeout: float = 10.0,
    get: Fetch | None = None,
) -> list[str]:
    """One pass over every check. An empty list means the deploy is verified."""
    get = get or fetch
    found: list[str] = []

    health, problem = _json_object(get(f"{base}/healthz", timeout), "/healthz", swa)
    if problem:
        found.append(problem)
    elif health.get("status") != "ok":
        found.append(f'/healthz: status is {health.get("status")!r}, not "ok"')

    version, problem = _json_object(get(f"{base}/version", timeout), "/version", swa)
    if problem:
        found.append(problem)
    elif commit and not same_commit(commit, str(version.get("commit", ""))):
        found.append(f"/version: commit is {version.get('commit')!r}, expected {commit!r}")

    if swa:
        page = get(f"{base}/", timeout)
        if page.status != 200:
            found.append(f"/: HTTP {page.status}" if page.status else "/: unreachable")
        elif "content-security-policy" not in page.headers:
            found.append("/: no Content-Security-Policy header (is the config applied?)")
    return found


def _say(line: str) -> None:
    """Print now: a CI log must show each attempt as it happens, not at exit."""
    print(line, flush=True)


def verify(
    base: str,
    commit: str = "",
    swa: bool = False,
    attempts: int = 30,
    delay: float = 10.0,
    timeout: float = 10.0,
    get: Fetch | None = None,
    sleep: Callable[[float], None] | None = None,
    log: Callable[[str], None] | None = None,
) -> bool:
    """Retry the checks until they pass. True when they did."""
    sleep, log = sleep or time.sleep, log or _say
    base = base.rstrip("/")
    for attempt in range(1, attempts + 1):
        found = problems(base, commit, swa, timeout, get)
        if not found:
            build = f"/version reports {commit}" if commit else "/version answers"
            log(f"verified {base}: /healthz is ok, {build} (attempt {attempt})")
            return True
        log(f"attempt {attempt}/{attempts}: " + "; ".join(found))
        if attempt < attempts:
            sleep(delay)
    log(f"NOT verified: {base} still fails after {attempts} attempt(s)")
    return False


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify a deployed site's /healthz and /version.")
    parser.add_argument("url", help="the site's origin, e.g. https://example.com")
    parser.add_argument("--commit", default="", help="the commit /version must report")
    parser.add_argument(
        "--swa",
        action="store_true",
        help="also require JSON content types and a Content-Security-Policy header",
    )
    parser.add_argument("--attempts", type=int, default=30, help="tries before giving up (30)")
    parser.add_argument("--delay", type=float, default=10.0, help="seconds between tries (10)")
    parser.add_argument("--timeout", type=float, default=10.0, help="seconds per request (10)")
    args = parser.parse_args(argv)
    if not args.url.startswith(("https://", "http://")):
        parser.error("url must start with https:// (or http:// for a local server)")
    if args.attempts < 1:
        parser.error("--attempts must be at least 1")
    ok = verify(args.url, args.commit, args.swa, args.attempts, args.delay, args.timeout)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
