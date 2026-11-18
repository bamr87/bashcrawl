"""Quest checklists (`steps` in src/help/data/quests.yaml) and their contract check."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest
import yaml

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_content_contracts as vcc  # noqa: E402

GOOD_STEP = {"label": "Read the tome", "when": {"flag": "tome"}}


def _quest_errors(steps: Any) -> list[str]:
    """Errors _validate_quests reports for one quest carrying `steps`."""
    quest: dict[str, Any] = {"id": 7, "title": "T", "completion": {"command": "source"}}
    if steps is not ...:
        quest["steps"] = steps
    errors: list[str] = []
    vcc._validate_quests({"quests": [quest]}, {"quests": [{"id": 7}]}, errors, [], {})
    return errors


def test_authored_quest_steps_pass_the_contract() -> None:
    text = (ROOT / "src/help/data/quests.yaml").read_text(encoding="utf-8")
    quests = yaml.safe_load(text)["quests"]
    with_steps = [q for q in quests if q.get("steps")]
    assert [q["id"] for q in with_steps] == [7]
    for quest in with_steps:
        assert vcc.quest_step_errors(quest["steps"], f"quest {quest['id']}") == []
    assert vcc.validate(ROOT)["errors"] == []


def test_steps_are_optional() -> None:
    assert _quest_errors(...) == []
    assert _quest_errors([GOOD_STEP]) == []


@pytest.mark.parametrize(
    ("steps", "expected"),
    [
        ([], "must be a non-empty list"),
        ({"label": "x", "when": {"flag": "tome"}}, "must be a non-empty list"),
        (["Read the tome"], "steps[0]: must be a mapping"),
        ([{"when": {"flag": "tome"}}], "steps[0]: label must be a non-empty string"),
        ([{"label": "  ", "when": {"flag": "tome"}}], "steps[0]: label must be a non-empty string"),
        ([{"label": "Read the tome"}], "steps[0]: needs a when rule"),
        ([{"label": "x", "when": {"flag": "tome", "gt": 1}}], "unexpected key 'gt' beside 'flag'"),
        ([{"label": "x", "when": {"flags": "tome"}}], "needs exactly one rule head"),
        ([{"label": "x", "when": {"any": []}}], "steps[0].when.any: must be a non-empty list"),
        ([{"label": "x", "when": {"flag": "tome"}, "xp": 10}], "steps[0]: unexpected key 'xp'"),
        ([GOOD_STEP, dict(GOOD_STEP)], "steps[1]: duplicate label 'Read the tome'"),
    ],
)
def test_a_malformed_steps_entry_is_rejected(steps: Any, expected: str) -> None:
    errors = _quest_errors(steps)
    assert errors, f"{steps!r} should be rejected"
    assert all(e.startswith("quests.yaml: quest 7 steps") for e in errors), errors
    assert any(expected in e for e in errors), errors
