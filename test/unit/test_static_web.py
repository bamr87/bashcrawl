from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

_DATA_FILES = ("world.json", "quests.json", "commands.json", "docs.json")


def _export_to(root: Path, out_dir: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", "scripts/export_static_web.py", "--output-dir", str(out_dir)],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )


def test_static_web_export_and_bundle_are_valid(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[2]

    # Export into a throwaway directory so the test never mutates the
    # committed web/data bundle.
    export = _export_to(root, tmp_path)
    assert export.returncode == 0, export.stdout + export.stderr
    for name in _DATA_FILES:
        produced = tmp_path / name
        assert produced.is_file(), f"exporter did not produce {name}"
        json.loads(produced.read_text(encoding="utf-8"))  # must be valid JSON

    # Validate the committed bundle in place (validators read web/ as-is).
    validate = subprocess.run(
        ["python3", "scripts/validate_static_web.py"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert validate.returncode == 0, validate.stdout + validate.stderr
    payload = json.loads(validate.stdout)
    assert payload["ok"] is True


def test_committed_web_data_is_fresh(tmp_path: Path) -> None:
    """The checked-in web/data bundle must match a fresh export.

    Guards against the bundle drifting from the content registries. If this
    fails, run `make web-build` and commit the regenerated web/data files.
    """
    root = Path(__file__).resolve().parents[2]
    export = _export_to(root, tmp_path)
    assert export.returncode == 0, export.stdout + export.stderr

    committed = root / "web" / "data"
    stale = [
        name
        for name in _DATA_FILES
        if (tmp_path / name).read_text(encoding="utf-8")
        != (committed / name).read_text(encoding="utf-8")
    ]
    assert not stale, (
        "Committed web/data is stale: "
        + ", ".join(stale)
        + ". Run `make web-build` and commit the regenerated files."
    )


def test_vendored_termforge_is_fresh() -> None:
    """web/assets/js/vendor/termforge must byte-match termforge/core.

    The framework source of truth is termforge/core/; the web bundle ships a
    committed mirror. If this fails, run `make web-build` and commit.
    """
    root = Path(__file__).resolve().parents[2]
    check = subprocess.run(
        ["python3", "scripts/vendor_termforge.py", "--check"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert check.returncode == 0, check.stdout + check.stderr


def test_web_runtime_declares_handlers_for_demo_commands() -> None:
    root = Path(__file__).resolve().parents[2]
    validate = subprocess.run(
        ["python3", "scripts/validate_runtime_commands.py"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert validate.returncode == 0, validate.stdout + validate.stderr
