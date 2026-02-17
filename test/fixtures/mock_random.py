"""Mock RANDOM for deterministic combat tests.

Bash scripts use $RANDOM for roll-based combat (monster, ghost).
This module provides utilities to make combat outcomes deterministic
by injecting a RANDOM seed via environment variables.
"""

from __future__ import annotations


def combat_env_win(base_env: dict[str, str] | None = None) -> dict[str, str]:
    """Return env vars that produce a winning combat roll.

    Bash $RANDOM uses a seed derived from the PID and SECONDS.
    We can influence it by setting RANDOM explicitly in a wrapper.
    For testing, we prepend a bash line that sets RANDOM to a known seed.
    """
    env = dict(base_env or {})
    # This doesn't directly control $RANDOM, but we use it as a signal
    # to our test wrappers
    env["_TEST_COMBAT_OUTCOME"] = "win"
    env["RANDOM"] = "12345"
    return env


def combat_env_lose(base_env: dict[str, str] | None = None) -> dict[str, str]:
    """Return env vars that produce a losing combat roll."""
    env = dict(base_env or {})
    env["_TEST_COMBAT_OUTCOME"] = "lose"
    env["RANDOM"] = "1"
    return env


def wrap_script_deterministic(script_content: str, outcome: str = "win") -> str:
    """Wrap a bash script to make RANDOM deterministic.

    Injects a RANDOM seed assignment after the shebang line.
    This is used only in sandbox copies — never modifies originals.
    """
    lines = script_content.split("\n")
    if lines and lines[0].startswith("#!"):
        # Insert RANDOM seed after shebang
        seed = "32000" if outcome == "win" else "1"
        lines.insert(1, f"RANDOM={seed}  # injected by test framework")
    return "\n".join(lines)
