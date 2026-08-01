#!/usr/bin/env python3
"""Vendor TermForge core files into the static web bundle.

`termforge/core/` is the single source of truth for the browser-loadable
framework files. The web app is deployed verbatim from `web/`, so `make
web-build` mirrors the core tree into `web/assets/js/vendor/termforge/`
(committed, like `web/data/*.json`).

Usage:
    python3 scripts/vendor_termforge.py            # copy core -> vendor mirror
    python3 scripts/vendor_termforge.py --check    # verify mirror freshness

`check()` is importable (used by validate_static_web.py) and performs a
bidirectional byte comparison: stale/missing vendor copies AND orphan vendor
files both fail, with the standard fix-it message.

stdlib only — this must run in the pages.yml environment (pyyaml only).
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "termforge" / "core"
DST = ROOT / "web" / "assets" / "js" / "vendor" / "termforge"

FIX_IT = "run 'make web-build' and commit the result"


def manifest() -> list[str]:
    """Relative POSIX paths of every core file, sorted for determinism."""
    return sorted(
        p.relative_to(SRC).as_posix() for p in SRC.rglob("*.js") if p.is_file()
    )


def vendor() -> list[str]:
    """Mirror core -> vendor. Returns the relative paths written or removed."""
    changed: list[str] = []
    wanted = manifest()
    for rel in wanted:
        src = SRC / rel
        dst = DST / rel
        content = src.read_bytes()
        if dst.exists() and dst.read_bytes() == content:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(content)
        changed.append(rel)
    if DST.is_dir():
        wanted_set = set(wanted)
        for path in sorted(DST.rglob("*.js")):
            rel = path.relative_to(DST).as_posix()
            if rel not in wanted_set:
                path.unlink()
                changed.append(f"{rel} (removed orphan)")
    return changed


def check() -> list[str]:
    """Bidirectional freshness check. Returns error strings (empty = fresh)."""
    errors: list[str] = []
    core = manifest()
    if not core:
        return [f"termforge/core has no JS files (expected the framework at {SRC})"]
    for rel in core:
        dst = DST / rel
        if not dst.is_file():
            errors.append(f"vendor copy missing: web/assets/js/vendor/termforge/{rel} — {FIX_IT}")
        elif dst.read_bytes() != (SRC / rel).read_bytes():
            errors.append(f"vendor copy stale: web/assets/js/vendor/termforge/{rel} — {FIX_IT}")
    if DST.is_dir():
        core_set = set(core)
        for path in sorted(DST.rglob("*.js")):
            rel = path.relative_to(DST).as_posix()
            if rel not in core_set:
                errors.append(
                    f"orphan vendor file: web/assets/js/vendor/termforge/{rel} "
                    f"(no matching termforge/core/{rel}) — {FIX_IT}"
                )
    return errors


def main() -> int:
    if "--check" in sys.argv[1:]:
        errors = check()
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        if not errors:
            print(f"vendor mirror fresh ({len(manifest())} files)")
        return 1 if errors else 0
    changed = vendor()
    if changed:
        for rel in changed:
            print(f"  vendored  {rel}")
    print(f"vendor mirror up to date ({len(manifest())} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
