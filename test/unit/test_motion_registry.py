"""ASCII Motion clip registry (src/help/data/motion.yaml) and its web bundle."""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_motion  # noqa: E402
import validate_content_contracts  # noqa: E402


def _bundle_text(text: str) -> tuple[dict, dict]:
    clips = re.search(r"BashcrawlFxClips = (\{.*?\});\n", text)
    manifest = re.search(r"BashcrawlFxClipManifest = (\{.*?\});\n", text)
    assert clips and manifest, "not a generated clip bundle"
    return json.loads(clips.group(1)), json.loads(manifest.group(1))


def test_bundles_are_fresh() -> None:
    assert build_motion.check() == [], "run `make web-build` and commit the regenerated bundles"


def test_bundle_carries_every_registry_clip_alias_and_art() -> None:
    rendered = build_motion.render()
    clips, manifest = _bundle_text(rendered[build_motion.CLIPS_OUT])
    registry = build_motion.load_registry()
    assert sorted(clips) == sorted(registry["clips"])
    for name, entry in registry["clips"].items():
        assert manifest["clips"][name]["file"] == entry["file"]
        for alias in entry.get("aliases") or []:
            assert manifest["aliases"][alias] == name
            assert alias in manifest["stage"]
    assert [rule["event"] for rule in manifest["events"]] == ["levelup", "quest", "unlock"]
    art = json.loads(
        re.search(r"BashcrawlArtClips = (\{.*?\});\n", rendered[build_motion.GAME_ART_OUT]).group(1)
    )
    assert sorted(art) == sorted(registry["art"])
    core = rendered[build_motion.CORE_ART_OUT]
    for name in ("banner", "cow", "sl"):
        assert f'"{name}":' in core


def test_session_sources_drop_editor_ui_state(tmp_path: Path) -> None:
    session = tmp_path / "glow.asciimtn"
    session.write_text(
        json.dumps(
            {
                "version": "2.2.0",
                "metadata": {"exportedAt": "x", "userAgent": "Mozilla"},
                "canvas": {"width": 2, "height": 1},
                "timeline": {"frameRate": 12, "durationFrames": 1},
                "layers": [{"id": "l", "contentFrames": []}],
                "tools": {"brush": 1},
                "ui": {"zoom": 2},
                "palettes": {},
                "characterPalettes": {},
                "typography": {"fontSize": 12},
            }
        ),
        encoding="utf-8",
    )
    data = build_motion.load_source(session)
    assert set(data) == {"version", "metadata", "canvas", "timeline", "layers"}
    assert "userAgent" not in data["metadata"]
    text = tmp_path / "blink.txt"
    text.write_text("*\n\n,\n\n.\n", encoding="utf-8")
    assert build_motion.load_source(text) == "*\n\n,\n\n.\n"


def _sandbox(tmp_path: Path, registry: str) -> Path:
    (tmp_path / "web/assets/js").mkdir(parents=True)
    shutil.copy(ROOT / "web/assets/js/fx.js", tmp_path / "web/assets/js/fx.js")
    (tmp_path / "src/help/data").mkdir(parents=True)
    (tmp_path / "src/help/data/motion.yaml").write_text(registry, encoding="utf-8")
    (tmp_path / "motion/clips").mkdir(parents=True)
    return tmp_path


def test_validator_accepts_the_committed_registry() -> None:
    errors: list[str] = []
    warnings: list[str] = []
    report: dict = {}
    validate_content_contracts._validate_motion(ROOT, errors, warnings, report)
    assert errors == []
    assert warnings == []
    assert report["motion"]["clip_count"] >= 8
    assert report["motion"]["art_count"] >= 23


def test_validator_flags_broken_motion_entries(tmp_path: Path) -> None:
    root = _sandbox(
        tmp_path,
        """version: 1
clips:
  radar:
    file: motion/clips/radar.json
    title: Radar
    description: ok
    aliases: [climb]
  warp:
    file: motion/clips/missing.json
    title: Warp
    description: gone
    aliases: [climb, teleport]
  sparkle:
    file: motion/clips/empty.json
    title: ""
    description: not a motion
events:
  - {event: levelup, motion: cast}
""",
    )
    (root / "motion/clips/radar.json").write_text(
        json.dumps({"frames": [{"content": ["*"]}]}), encoding="utf-8"
    )
    (root / "motion/clips/empty.json").write_text(json.dumps({"canvas": {}}), encoding="utf-8")
    (root / "motion/clips/stray.txt").write_text("*", encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []
    validate_content_contracts._validate_motion(root, errors, warnings, {})
    joined = "\n".join(errors)
    assert "file not found: motion/clips/missing.json" in joined
    assert "'climb' is already claimed by clips.radar" in joined
    assert "alias 'teleport' is not a motion" in joined
    assert "'sparkle' is not a motion" in joined
    assert "empty.json has no frames" in joined
    assert "clips.sparkle: title must be a non-empty string" in joined
    assert "motion 'cast' has no clip" in joined
    assert warnings == ["motion/clips/stray.txt is not listed in motion.yaml (it will not ship)"]
