from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit


def test_runtime_command_manifest_parity() -> None:
    root = Path(__file__).resolve().parents[2]
    script = root / "scripts" / "validate_runtime_commands.py"
    proc = subprocess.run(
        ["python3", str(script)],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["ok"] is True
