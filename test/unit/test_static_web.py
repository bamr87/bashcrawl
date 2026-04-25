from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit


def test_static_web_export_and_bundle_are_valid() -> None:
    root = Path(__file__).resolve().parents[2]
    export = subprocess.run(
        ["python3", "scripts/export_static_web.py"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert export.returncode == 0, export.stdout + export.stderr

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
