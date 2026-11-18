#!/usr/bin/env python3
"""Write the trainer's build identity and health probe into web/dist.

The web trainer ships as static files on GitHub Pages, so no server answers
`GET /version` or `GET /healthz` (hub specs/BACKEND.md, UPS-BE-11 and
UPS-BE-10). This step runs right after `vite build`, which empties
`web/dist`, in `make web-bundle` and in `make web-test` (the target
`pages.yml` deploys from), and writes those answers as files:

    web/dist/version, web/dist/version.json
        {"name", "version", "commit", "built_at", "game_version"}
    web/dist/healthz, web/dist/healthz.json
        {"status": "ok"}

Pages serves an extensionless file at its own path, so `GET <site>/version`
and `GET <site>/healthz` answer with the JSON; the `.json` twins are served
with a JSON content type. `version` is the release version release-please
bumps in `package.json`, `game_version` is the game's own `VERSION`, and
`commit` is `GIT_SHA` or `GITHUB_SHA` (CI), else `git rev-parse --short HEAD`,
else "unknown". A missing name, version or VERSION stops the build with a
clear message rather than publishing an empty value.

Usage:
    python3 scripts/write_build_info.py                  # into web/dist
    python3 scripts/write_build_info.py --out DIR        # into DIR
    python3 scripts/write_build_info.py --root DIR       # read DIR's package.json + VERSION

stdlib only: this runs in the pages.yml environment (pyyaml only).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# The served path -> the files under web/dist that answer it.
ROUTES: dict[str, tuple[str, ...]] = {
    "/version": ("version", "version.json"),
    "/healthz": ("healthz", "healthz.json"),
}

# Liveness: a static file touches no dependency, so it is always ok.
HEALTH = {"status": "ok"}


class BuildInfoError(RuntimeError):
    """A build input is missing or empty, so the build must stop."""


def _release(root: Path) -> tuple[str, str]:
    """(name, version) from package.json, the file release-please bumps."""
    path = root / "package.json"
    try:
        pkg = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise BuildInfoError(f"{path} not found: it carries the release version") from None
    except json.JSONDecodeError as exc:
        raise BuildInfoError(f"{path} is not valid JSON: {exc}") from None
    if not isinstance(pkg, dict):
        raise BuildInfoError(f"{path} is not a JSON object")
    values: dict[str, str] = {}
    for key in ("name", "version"):
        value = pkg.get(key)
        if not isinstance(value, str) or not value.strip():
            raise BuildInfoError(f'{path} has no "{key}"')
        values[key] = value.strip()
    return values["name"], values["version"]


def _game_version(root: Path) -> str:
    """The game's own version, from VERSION."""
    path = root / "VERSION"
    try:
        value = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        raise BuildInfoError(f"{path} not found: it carries the game version") from None
    if not value:
        raise BuildInfoError(f"{path} is empty")
    return value


def _commit(root: Path, env: Mapping[str, str]) -> str:
    """The commit being built: the CI's SHA, else git's short HEAD, else unknown."""
    for key in ("GIT_SHA", "GITHUB_SHA"):
        value = env.get(key, "").strip()
        if value:
            return value
    try:
        head = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        head = ""
    return head or "unknown"


def build_info(
    root: Path = ROOT,
    env: Mapping[str, str] | None = None,
    now: datetime | None = None,
) -> dict[str, str]:
    """The /version payload. Raises BuildInfoError when an input is missing."""
    name, version = _release(root)
    built = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return {
        "name": name,
        "version": version,
        "commit": _commit(root, os.environ if env is None else env),
        "built_at": built.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "game_version": _game_version(root),
    }


def write(out: Path, info: Mapping[str, str]) -> list[Path]:
    """Write every ROUTES file into `out` (the built site). Returns the paths."""
    if not out.is_dir():
        raise BuildInfoError(f"{out} does not exist: run the vite build first (make web-bundle)")
    bodies = {"/version": dict(info), "/healthz": HEALTH}
    written: list[Path] = []
    for route, names in ROUTES.items():
        text = json.dumps(bodies[route]) + "\n"
        for name in names:
            path = out / name
            path.write_text(text, encoding="utf-8")
            written.append(path)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write /version and /healthz into web/dist.")
    parser.add_argument("--root", type=Path, default=ROOT, help="repo root (default: this repo)")
    parser.add_argument("--out", type=Path, help="built site directory (default: ROOT/web/dist)")
    args = parser.parse_args(argv)
    out = args.out or args.root / "web" / "dist"
    try:
        info = build_info(args.root)
        written = write(out, info)
    except BuildInfoError as exc:
        print(f"write_build_info: {exc}", file=sys.stderr)
        return 1
    names = ", ".join(path.name for path in written)
    print(f"build info: {info['name']} {info['version']} at {info['commit']} -> {out} ({names})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
