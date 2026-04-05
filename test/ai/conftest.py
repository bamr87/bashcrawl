"""AI-test-only fixtures."""

from __future__ import annotations

import os

import pytest


@pytest.fixture
def ai_agent(request):
    """TestAgent using Anthropic Claude (requires ANTHROPIC_API_KEY)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        pytest.skip("ANTHROPIC_API_KEY not set — skipping AI test")

    from ai.agent import TestAgent
    from ai import live_logger as _live

    test_name = request.node.name
    agent = TestAgent(api_key=api_key)
    object.__setattr__(agent, "_test_name", test_name) if hasattr(agent, "__dataclass_fields__") else setattr(agent, "_test_name", test_name)
    try:
        _live._write({"type": "agent_ready", "test": test_name})
    except Exception:
        pass
    return agent
