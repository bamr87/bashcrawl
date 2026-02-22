"""AI Test Agent — drives bashcrawl sessions via Anthropic Claude.

The TestAgent wraps the Anthropic Messages API to simulate a player.
It maintains conversation history (terminal output as user messages,
commands as assistant messages) and extracts the next shell command
from Claude's response.
"""

from __future__ import annotations

import re
import time
import logging
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import anthropic

try:
    from ai import live_logger as _live
except ImportError:
    _live = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

# Default model — Claude Sonnet for cost efficiency in test runs
DEFAULT_MODEL = "claude-sonnet-4-20250514"

# Cost guards
DEFAULT_MAX_TURNS = 30
DEFAULT_MAX_TOKENS_PER_TURN = 150
DEFAULT_MAX_ELAPSED_SECONDS = 90   # hard wall-clock limit per session
DEFAULT_REQUESTS_PER_MINUTE = 20  # max Anthropic API calls per 60 s

SYSTEM_PROMPT_TEMPLATE = """\
You are a test player in Bashcrawl, a text-based adventure game that teaches \
terminal commands. You interact with a simulated bash terminal.

GAME CONTEXT:
- Directories are rooms. Navigate with `cd`.
- Files named `scroll` contain educational content. Read with `cat scroll`.
- Executable files (marked with *) are interactive encounters. Run with `./filename`.
- Hidden files/directories start with `.` — find them with `ls -a`.
- Your inventory is in $I. Your health is $HP.
- When a script tells you to run `export VAR=value`, do it exactly.

YOUR GOAL:
{goal}

RULES:
1. Respond with ONLY the next shell command to execute. No explanation.
2. One command per response. No chaining with && or ;.
3. If a script tells you to type `export I=item,$I`, respond with exactly that.
4. If asked y/n by a script, respond with just `y` or `n`.
5. Use `ls` when entering a new room to see what's there.
6. Read scrolls (`cat scroll`) to learn about the room.
7. If you get stuck, try `help` or `ls -a` to find hidden paths.

CURRENT STATE:
- Location: {location}
- Inventory: {inventory}
- HP: {hp}
- Rooms visited: {rooms_visited}
"""


@dataclass
class AgentTurn:
    """Record of a single agent turn."""

    turn_number: int
    command: str
    output: str
    location: str
    inventory: str
    hp: int


@dataclass
class TestAgent:
    """Drives a bashcrawl session using Claude as the decision-maker.

    Usage::

        agent = TestAgent(api_key="sk-...")
        agent.set_scenario("Explore from entrance to cellar and collect the amulet.")
        cmd = agent.next_command("You are in the entrance. Type 'cat scroll'...")
        # ... execute cmd in engine, get output ...
        cmd = agent.next_command(output)
    """

    api_key: str
    model: str = DEFAULT_MODEL
    max_turns: int = DEFAULT_MAX_TURNS
    max_tokens_per_turn: int = DEFAULT_MAX_TOKENS_PER_TURN
    max_elapsed_seconds: float = DEFAULT_MAX_ELAPSED_SECONDS
    requests_per_minute: int = DEFAULT_REQUESTS_PER_MINUTE
    goal: str = "Explore the dungeon and collect treasures."
    _client: Any = field(default=None, repr=False)
    _messages: list[dict[str, str]] = field(default_factory=list)
    _turns: list[AgentTurn] = field(default_factory=list)
    _current_location: str = "/entrance"
    _current_inventory: str = ""
    _current_hp: int = 0
    _session_start: float = field(default_factory=time.monotonic, repr=False)
    _call_timestamps: deque = field(default_factory=deque, repr=False)  # sliding window for RPM

    def __post_init__(self) -> None:
        self._client = anthropic.Anthropic(api_key=self.api_key)

    def set_scenario(
        self,
        goal: str,
        max_turns: int | None = None,
        max_elapsed_seconds: float | None = None,
        location: str = "/entrance",
        inventory: str = "",
        hp: int = 0,
    ) -> None:
        """Configure the agent's goal and initial state."""
        self.goal = goal
        if max_turns is not None:
            self.max_turns = max_turns
        if max_elapsed_seconds is not None:
            self.max_elapsed_seconds = max_elapsed_seconds
        self._current_location = location
        self._current_inventory = inventory
        self._current_hp = hp
        self._messages = []
        self._turns = []
        self._session_start = time.monotonic()
        self._call_timestamps = deque()

    def _build_system_prompt(self) -> str:
        rooms = [t.location for t in self._turns]
        unique_rooms = list(dict.fromkeys(rooms))  # preserve order, dedupe
        return SYSTEM_PROMPT_TEMPLATE.format(
            goal=self.goal,
            location=self._current_location,
            inventory=self._current_inventory or "empty",
            hp=self._current_hp,
            rooms_visited=", ".join(unique_rooms[-10:]) if unique_rooms else "none",
        )

    def next_command(self, terminal_output: str) -> str:
        """Given terminal output, ask Claude for the next command.

        Args:
            terminal_output: The stdout/stderr from the previous command,
                or initial game state description.

        Returns:
            The next shell command to execute.

        Raises:
            AgentExhausted: If max_turns is reached.
            AgentError: If the API call fails.
        """
        if len(self._turns) >= self.max_turns:
            raise AgentExhausted(
                f"Agent reached max turns ({self.max_turns})"
            )

        # Wall-clock time limit
        elapsed = time.monotonic() - self._session_start
        if elapsed >= self.max_elapsed_seconds:
            raise AgentTimeout(
                f"Agent exceeded time limit ({self.max_elapsed_seconds:.0f}s elapsed)"
            )

        # Rate limiting — enforce requests_per_minute via sliding window
        self._throttle()

        # Add terminal output as user message
        self._messages.append({
            "role": "user",
            "content": terminal_output[:4000],  # Truncate very long outputs
        })

        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens_per_turn,
                system=self._build_system_prompt(),
                messages=self._messages,
            )
        except Exception as e:
            raise AgentError(f"Anthropic API error: {e}") from e

        raw_response = response.content[0].text.strip()

        # Log API usage to live stream
        if _live:
            usage = getattr(response, "usage", None)
            _live.api_call(
                model=self.model,
                tokens_in=getattr(usage, "input_tokens", 0),
                tokens_out=getattr(usage, "output_tokens", 0),
            )
        command = self._extract_command(raw_response)

        # Record in message history
        self._messages.append({
            "role": "assistant",
            "content": command,
        })

        # Record turn
        turn = AgentTurn(
            turn_number=len(self._turns),
            command=command,
            output=terminal_output[:500],
            location=self._current_location,
            inventory=self._current_inventory,
            hp=self._current_hp,
        )
        self._turns.append(turn)

        logger.info(
            "Turn %d: %s (location=%s, hp=%d)",
            turn.turn_number, command, self._current_location, self._current_hp,
        )

        return command

    def update_state(
        self,
        location: str = "",
        inventory: str = "",
        hp: int = -1,
    ) -> None:
        """Update the agent's understanding of game state after a command."""
        if location:
            self._current_location = location
        if inventory:
            self._current_inventory = inventory
        if hp >= 0:
            self._current_hp = hp

    def _throttle(self) -> None:
        """Sleep if necessary to stay under requests_per_minute."""
        now = time.monotonic()
        window = 60.0
        # Drop timestamps older than the sliding window
        while self._call_timestamps and now - self._call_timestamps[0] >= window:
            self._call_timestamps.popleft()
        if len(self._call_timestamps) >= self.requests_per_minute:
            oldest = self._call_timestamps[0]
            sleep_for = window - (now - oldest) + 0.1
            if sleep_for > 0:
                logger.info(
                    "Rate limit: sleeping %.1fs (RPM cap = %d)",
                    sleep_for, self.requests_per_minute,
                )
                if _live:
                    _live.rate_limit(sleep_for, self.requests_per_minute)
                time.sleep(sleep_for)
        self._call_timestamps.append(time.monotonic())

    def request_feedback(
        self,
        rooms_visited: list[str] | None = None,
        commands_used: set[str] | None = None,
    ) -> dict[str, str]:
        """Ask Claude to review the session and give structured feedback.

        Returns a dict with keys: 'issues', 'suggestions', 'rating'.
        This call is NOT counted against max_turns and does NOT update
        game message history — it's a separate meta-level request.
        """
        self._throttle()

        rooms_str = ", ".join(rooms_visited) if rooms_visited else "unknown"
        cmds_str = ", ".join(sorted(commands_used)) if commands_used else "unknown"
        turn_count = len(self._turns)
        elapsed = time.monotonic() - self._session_start

        feedback_prompt = f"""\
You just completed (or timed out of) a Bashcrawl test session as an AI player.

Session summary:
- Total turns: {turn_count}
- Elapsed time: {elapsed:.1f}s
- Rooms visited: {rooms_str}
- Commands used: {cmds_str}
- Final location: {self._current_location}
- Final inventory: {self._current_inventory or 'empty'}
- Final HP: {self._current_hp}

Please provide honest feedback about this session in the following format:

ISSUES: <list any bugs, confusing prompts, unclear instructions, or game
logic problems you encountered>

SUGGESTIONS: <specific improvements for the game content, hints system,
or educational flow>

RATING: <overall rating 1-10 for educational effectiveness and playability>
"""
        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=500,
                system=(
                    "You are an expert educational game reviewer evaluating "
                    "a terminal-command teaching game called Bashcrawl. "
                    "Be specific, constructive, and concise."
                ),
                messages=[{"role": "user", "content": feedback_prompt}],
            )
            raw = response.content[0].text.strip()
        except Exception as e:
            logger.warning("Feedback request failed: %s", e)
            raw = "(feedback unavailable)"

        # Parse sections
        feedback: dict[str, str] = {"raw": raw, "issues": "", "suggestions": "", "rating": ""}
        for key in ("issues", "suggestions", "rating"):
            pattern = rf"{key.upper()}:\s*(.+?)(?=\n[A-Z]+:|$)"
            import re as _re
            m = _re.search(pattern, raw, _re.IGNORECASE | _re.DOTALL)
            if m:
                feedback[key] = m.group(1).strip()

        logger.info(
            "Agent feedback — rating=%s | issues=%s | suggestions=%s",
            feedback.get('rating', '?'),
            feedback.get('issues', '')[:120],
            feedback.get('suggestions', '')[:120],
        )
        if _live:
            _live.agent_feedback(
                rating=feedback.get("rating", ""),
                issues=feedback.get("issues", ""),
                suggestions=feedback.get("suggestions", ""),
                raw=feedback.get("raw", ""),
            )
        return feedback

    @staticmethod
    def _extract_command(response: str) -> str:
        """Extract a single shell command from Claude's response.

        Strips markdown fences, takes the first non-empty line,
        and removes shell prompts.
        """
        # Remove markdown code fences
        response = re.sub(r"```(?:bash|sh)?\n?", "", response)
        response = re.sub(r"```", "", response)

        # Take first non-empty line
        for line in response.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            # Remove shell prompt prefix
            line = re.sub(r"^\$\s*", "", line)
            line = re.sub(r"^>\s*", "", line)
            if line:
                return line

        return response.strip().split("\n")[0].strip()

    @property
    def turns(self) -> list[AgentTurn]:
        return list(self._turns)

    @property
    def turn_count(self) -> int:
        return len(self._turns)

    @property
    def commands_used(self) -> set[str]:
        """Set of unique base commands the agent has used."""
        cmds = set()
        for t in self._turns:
            base = t.command.split()[0] if t.command else ""
            if base.startswith("./"):
                base = base[2:]
            cmds.add(base)
        return cmds


class AgentExhausted(Exception):
    """Raised when the agent has used all its allowed turns."""
    pass


class AgentTimeout(AgentExhausted):
    """Raised when the agent exceeds the wall-clock time limit."""
    pass


class AgentError(Exception):
    """Raised when the Anthropic API call fails."""
    pass
