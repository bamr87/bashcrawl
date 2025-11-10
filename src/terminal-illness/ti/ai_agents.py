from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class AgentConfig:
    creativity: float = 0.4
    difficulty: str = "balanced"  # easy | balanced | hard
    narrative_style: str = "whimsical"
    frequency: str = "normal"


class QuestGeneratorAgent:
    def __init__(self, config: AgentConfig | None = None) -> None:
        self.config = config or AgentConfig()

    def generate(self, context: Dict[str, Any]) -> Dict[str, Any]:
        # Placeholder for LLM integration
        return {
            "title": "A Whisper from the Pines",
            "description": "An ephemeral challenge awaits…",
            "objective": "Use 'ls' to survey your surroundings.",
            "required_commands": ["ls"],
            "reward": "mysterious token",
        }


class WorldBuilderAgent:
    def __init__(self) -> None:
        ...

    def expand_world(self, seed: str) -> List[str]:
        return ["/valley", "/valley/altar"]


class NarrativeMasterAgent:
    def narrate(self, event: str) -> str:
        return f"Merlin whispers: {event}"


class RewardCrafterAgent:
    def craft(self, difficulty: str) -> Dict[str, Any]:
        return {"xp": 50, "item": "Polished Pebble"}


class ChallengeDesignerAgent:
    def design(self, skill: str) -> Dict[str, Any]:
        return {"skill": skill, "variant": "timed"}

