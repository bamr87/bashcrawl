"""AI chat service powering the Merlin assistant in the Bashcrawl TUI.

Uses the Anthropic Claude API (already in requirements.txt).
Gracefully degrades to a static hint if the API key is absent.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncIterator, List, Optional

from .chat_context import GameContext

# ---------------------------------------------------------------------------
# Conversation message type
# ---------------------------------------------------------------------------

Message = dict  # {"role": "user"|"assistant", "content": str}

# Max turns to keep in rolling history (user + assistant pairs)
_MAX_HISTORY_TURNS = 20
_DATA_DIR = Path(__file__).parent / "data"
_SYSTEM_PROMPT_FILE = _DATA_DIR / "merlin_prompt.txt"

# Proactive nudge strings — short, in-character, per event type
_NUDGES: dict[str, str] = {
    "new_room": (
        "✨ [bold magenta]Merlin whispers:[/bold magenta] [dim]A new chamber reveals itself! "
        "Speak [bold]cat scroll[/bold] to glean its secrets, then survey with [bold]ls -F[/bold].[/dim]"
    ),
    "low_health": (
        "⚠️ [bold magenta]Merlin warns:[/bold magenta] [dim]Your health wanes, brave one! "
        "Seek a [bold]potion[/bold] or rest before pressing deeper into the dungeon.[/dim]"
    ),
    "stuck": (
        "🤔 [bold magenta]Merlin muses:[/bold magenta] [dim]You seem to tread the same stones repeatedly. "
        "Perhaps [bold]ls -la[/bold] reveals hidden passages, or [bold]cd ..[/bold] offers a fresh path?[/dim]"
    ),
    "quest_complete": (
        "🎉 [bold magenta]Merlin cheers:[/bold magenta] [dim]Magnificent! Your command mastery grows. "
        "New secrets of the dungeon now await — press [bold]F3[/bold] if you seek counsel.[/dim]"
    ),
    "combat": (
        "⚔️ [bold magenta]Merlin advises:[/bold magenta] [dim]A foe stands before you! "
        "Inspect the encounter script carefully and use arithmetic sorcery to prevail.[/dim]"
    ),
}


class AIChatService:
    """Wraps the Anthropic Claude API for the Merlin chat experience."""

    def __init__(self, model: str = "claude-sonnet-4-20250514") -> None:
        self.model = model
        self._history: List[Message] = []
        self._system_prompt_template: Optional[str] = None
        self._client = None  # lazy-init to avoid import errors if key absent
        self._api_available: Optional[bool] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        """Return True if an API key is configured and the library is importable."""
        if self._api_available is None:
            self._api_available = bool(os.environ.get("ANTHROPIC_API_KEY"))
            if self._api_available:
                try:
                    import anthropic  # noqa: F401
                except ImportError:
                    self._api_available = False
        return self._api_available  # type: ignore[return-value]

    async def ask_streaming(
        self, question: str, context: GameContext
    ) -> AsyncIterator[str]:
        """Stream Claude's response token-by-token for the chat panel."""
        if not self.is_available():
            yield self._fallback_response(question, context)
            return

        system = self._build_system_prompt(context)
        self._history.append({"role": "user", "content": question})
        self._trim_history()

        import anthropic

        client = self._get_client()
        full_response = ""
        try:
            with client.messages.stream(
                model=self.model,
                max_tokens=300,
                system=system,
                messages=self._history,
            ) as stream:
                for text in stream.text_stream:
                    full_response += text
                    yield text
        except Exception as exc:
            error_msg = f"[red]Merlin's crystal ball is cloudy: {exc}[/red]"
            yield error_msg
            full_response = error_msg

        # Keep assistant turn in history
        self._history.append({"role": "assistant", "content": full_response})

    def nudge(self, event: str) -> str:
        """Return a short proactive in-character nudge for a game event.
        
        No API call — purely local strings to avoid latency on game events.
        """
        return _NUDGES.get(event, "")

    def clear_history(self) -> None:
        """Reset conversation history (e.g. on new game)."""
        self._history.clear()

    # ------------------------------------------------------------------
    # Synchronous ask (for CLI bridge)
    # ------------------------------------------------------------------

    def ask_sync(self, question: str, context: GameContext) -> str:
        """Non-streaming version for the bash CLI bridge."""
        if not self.is_available():
            return self._fallback_response(question, context)

        system = self._build_system_prompt(context)
        self._history.append({"role": "user", "content": question})
        self._trim_history()

        import anthropic

        client = self._get_client()
        try:
            response = client.messages.create(
                model=self.model,
                max_tokens=300,
                system=system,
                messages=self._history,
            )
            text = response.content[0].text
            self._history.append({"role": "assistant", "content": text})
            return text
        except Exception as exc:
            return f"Merlin's crystal ball is cloudy: {exc}"

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _get_client(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic()
        return self._client

    def _build_system_prompt(self, context: GameContext) -> str:
        if self._system_prompt_template is None:
            if _SYSTEM_PROMPT_FILE.exists():
                self._system_prompt_template = _SYSTEM_PROMPT_FILE.read_text()
            else:
                self._system_prompt_template = (
                    "You are Merlin, a wizard guide in Bashcrawl. "
                    "Teach terminal commands through dungeon metaphors. "
                    "Room: {room}. Inventory: {inventory}. HP: {hp}. "
                    "Quest: {quest}. Recent: {recent_commands}. "
                    "Files: {room_contents}. Scroll: {scroll_excerpt}."
                )
        ctx = context.as_dict()
        return self._system_prompt_template.format(**ctx)

    def _trim_history(self) -> None:
        """Keep at most _MAX_HISTORY_TURNS pairs (user + assistant = 2 msgs each)."""
        max_msgs = _MAX_HISTORY_TURNS * 2
        if len(self._history) > max_msgs:
            self._history = self._history[-max_msgs:]

    def _fallback_response(self, question: str, context: GameContext) -> str:
        """Static fallback when no API key is configured."""
        q_lower = question.lower()
        room = context.room.split("/")[-1] if "/" in context.room else context.room

        if any(w in q_lower for w in ("how", "what", "where", "help", "hint", "stuck")):
            return (
                f"[bold magenta]Merlin says:[/bold magenta] Ah, you find yourself in [cyan]{room}[/cyan]. "
                "Try [bold]ls -F[/bold] to survey your surroundings, then [bold]cat scroll[/bold] "
                "to read the ancient guidance. If you seek deeper wisdom, set the "
                "[dim]ANTHROPIC_API_KEY[/dim] enchantment and Merlin shall speak freely!"
            )
        return (
            "[bold magenta]Merlin nods:[/bold magenta] A worthy inquiry! "
            "The dungeon rewards the curious — [bold]ls -la[/bold] reveals all, "
            "and [bold]cat scroll[/bold] grants wisdom. "
            "[dim](Set ANTHROPIC_API_KEY for full AI guidance.)[/dim]"
        )
