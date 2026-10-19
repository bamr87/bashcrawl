#!/usr/bin/env python3
"""Validate the static GitHub Pages web bundle."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_motion  # noqa: E402  (sibling script, pyyaml only)
import vendor_termforge  # noqa: E402  (sibling script, stdlib only)

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"

# index.html is allowed to link to the project repo; other absolute URLs are rejected.
ALLOWED_INDEX_ABSOLUTE_HREFS = frozenset(
    {
        "https://github.com/bamr87/bashcrawl",
    }
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _relative_urls(html: str, label: str) -> list[str]:
    """Every src/href must be relative (GitHub Pages project path), bar the repo link."""
    problems = []
    for src in re.findall(r'(?:src|href)="([^"]+)"', html):
        if src in ALLOWED_INDEX_ABSOLUTE_HREFS:
            continue
        if src.startswith("/") or src.startswith("http://") or src.startswith("https://"):
            problems.append(f"{label}: static asset URL must be relative: {src}")
    return problems


def _engine_script_order(html: str, vendor_files: list[str], label: str) -> list[str]:
    """Script order: every vendored TermForge core file and every game plugin
    must be loaded as a classic script, all of them before the game runtime
    (which reads global.TermForge at load time). A `vite-ignore` attribute
    keeps Vite's hands off these tags, hence the tolerant regex."""
    problems = []
    script_srcs = re.findall(r'<script src="\./([^"]+)"[^>]*></script>', html)
    runtime_src = "assets/js/runtime.js"
    runtime_idx = script_srcs.index(runtime_src) if runtime_src in script_srcs else -1
    if runtime_idx < 0:
        problems.append(f"{label} does not load {runtime_src}")
    art_src = "assets/js/art-clips.js"
    if art_src not in script_srcs:
        problems.append(f"{label} does not load {art_src}")
    elif runtime_idx >= 0 and script_srcs.index(art_src) > runtime_idx:
        problems.append(f"{label} must load {art_src} before {runtime_src}")
    for rel in vendor_files:
        if rel not in script_srcs:
            problems.append(f"{label} does not load vendored core file: {rel}")
        elif runtime_idx >= 0 and script_srcs.index(rel) > runtime_idx:
            problems.append(f"{label} must load {rel} before assets/js/runtime.js")
    # Game feature plugins (web/assets/js/plugins/*.js): dropping a file in
    # is half the registration — the page must load it, before the runtime.
    plugin_files = sorted(
        p.relative_to(WEB).as_posix() for p in (WEB / "assets/js/plugins").glob("*.js")
    )
    if not plugin_files:
        problems.append("web/assets/js/plugins/ has no game plugins")
    for rel in plugin_files:
        if rel not in script_srcs:
            problems.append(f"{label} does not load game plugin: {rel}")
        elif runtime_idx >= 0 and script_srcs.index(rel) > runtime_idx:
            problems.append(f"{label} must load {rel} before assets/js/runtime.js")
    return problems


def validate() -> dict:
    errors: list[str] = []
    required = [
        # The Vite entry and the React app's roots (web/src is compiled; the
        # token file is the one place design values live).
        "index.html",
        "src/main.tsx",
        "src/app/App.tsx",
        "src/styles/tokens.css",
        "src/styles/app.css",
        "public/favicon.svg",
        "public/.nojekyll",
        # The ENGINE: classic scripts index.html loads before the app module.
        "assets/js/storage.js",
        "assets/js/runtime.js",
        "assets/js/hud.js",
        "assets/js/learn.js",
        "assets/js/fx-clips.js",
        "assets/js/fx.js",
        "assets/js/art-clips.js",
        "assets/js/ambient.js",
        "assets/js/arcade.js",
        "data/world.json",
        "data/quests.json",
        "data/progression.json",
        "data/courses.json",
        "data/commands.json",
        "data/docs.json",
        "data/arcade.json",
    ]
    # The TermForge core is vendored file-for-file; the manifest drives the
    # required list so a new core file cannot ship without its vendor copy.
    vendor_files = [f"assets/js/vendor/termforge/{rel}" for rel in vendor_termforge.manifest()]
    for baseline in ("protocol.js", "parser.js"):
        if f"assets/js/vendor/termforge/{baseline}" not in vendor_files:
            errors.append(f"termforge/core is missing baseline file {baseline}")
    required += vendor_files
    for rel in required:
        if not (WEB / rel).is_file():
            errors.append(f"Missing static web file: web/{rel}")

    # Vendor mirror freshness: web/assets/js/vendor/termforge/** must be a
    # byte-identical copy of termforge/core/** (both directions).
    errors.extend(vendor_termforge.check())
    # ASCII Motion bundles (core/art.js, art-clips.js, fx-clips.js) must match
    # the .asciimtn sources they are generated from.
    errors.extend(build_motion.check())

    index = _read(WEB / "index.html") if (WEB / "index.html").is_file() else ""
    if "url_for(" in index or "{{" in index:
        errors.append("web/index.html must not contain Jinja syntax")
    errors.extend(_relative_urls(index, "index.html"))

    # The React app mounts after the engine: one module entry, one root.
    if 'id="root"' not in index:
        errors.append('index.html must contain the app root <div id="root">')
    modules = re.findall(r'<script type="module" src="([^"]+)"', index)
    if modules != ["./src/main.tsx"]:
        errors.append(
            f"index.html must load exactly one module entry ./src/main.tsx (found {modules})"
        )
    if "<link rel=\"stylesheet\"" in index:
        errors.append(
            "index.html must not link stylesheets: the app imports its CSS (web/src/styles)"
        )

    errors.extend(_engine_script_order(index, vendor_files, "index.html"))
    # The built site, when present (make web-bundle): the copy step must have
    # shipped the engine beside the bundle, in the same order, still relative.
    dist_index = WEB / "dist" / "index.html"
    if dist_index.is_file():
        dist = _read(dist_index)
        errors.extend(_engine_script_order(dist, vendor_files, "dist/index.html"))
        errors.extend(_relative_urls(dist, "dist/index.html"))
        shipped = (
            "assets/js/runtime.js",
            "data/world.json",
            "assets/js/vendor/termforge/protocol.js",
        )
        for rel in shipped:
            if not (WEB / "dist" / rel).is_file():
                errors.append(
                    f"web/dist is missing the engine file {rel} (vite.config.mts copyEngine)"
                )

    if (WEB / "data/world.json").is_file():
        world = json.loads(_read(WEB / "data/world.json"))
        if world.get("root") != "/entrance":
            errors.append("world.json root must be /entrance")
        if "/entrance" not in world.get("directories", {}):
            errors.append("world.json must include /entrance directory")
        if "/entrance/scroll" not in world.get("files", {}):
            errors.append("world.json must include /entrance/scroll content")

    if (WEB / "data/docs.json").is_file():
        docs = json.loads(_read(WEB / "data/docs.json"))
        for key in ("quick_start", "commands", "rooms", "quests", "glossary"):
            if key not in docs:
                errors.append(f"docs.json missing {key}")

    if (WEB / "data/arcade.json").is_file():
        arcade = json.loads(_read(WEB / "data/arcade.json"))
        for key in ("pipe_puzzles", "hunt_scenarios", "flash_decks"):
            if not arcade.get(key):
                errors.append(f"arcade.json missing or empty: {key}")
        for puzzle in arcade.get("pipe_puzzles", []):
            for field in ("id", "title", "brief", "file", "input", "target", "hint"):
                if not puzzle.get(field):
                    errors.append(f"pipe puzzle {puzzle.get('id', '?')} missing {field}")
        for hunt in arcade.get("hunt_scenarios", []):
            for field in ("id", "title", "brief", "sigil", "tree", "files", "hint"):
                if not hunt.get(field):
                    errors.append(f"hunt {hunt.get('id', '?')} missing {field}")
            sigil = str(hunt.get("sigil", ""))
            carriers = [c for c in (hunt.get("files") or {}).values() if sigil and sigil in c]
            if len(carriers) != 1:
                errors.append(f"hunt {hunt.get('id', '?')}: sigil must appear in exactly one file")
        for deck in arcade.get("flash_decks", []):
            if not deck.get("cards"):
                errors.append(f"flash deck {deck.get('id', '?')} has no cards")
            for card in deck.get("cards", []):
                if not card.get("q") or not card.get("a"):
                    errors.append(f"flash deck {deck.get('id', '?')} has a card missing q/a")

    return {"ok": not errors, "error_count": len(errors), "errors": errors}


def main() -> int:
    result = validate()
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
