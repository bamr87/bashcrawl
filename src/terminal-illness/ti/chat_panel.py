"""ChatPanel — toggleable AI assistant panel for the Bashcrawl TUI.

A Textual Widget that renders as a right-side chat panel.
Toggle visibility with F3.  Player types in #chat-input;
Merlin's streaming replies appear in #chat-log.
"""

from __future__ import annotations

from textual import on
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Input, RichLog, Rule, Static


# ---------------------------------------------------------------------------
# CSS (injected into BashcrawlApp._CSS — see app.py)
# ---------------------------------------------------------------------------

CHAT_PANEL_CSS = """
/* ── Chat panel ────────────────────────────────────────────────────── */
#chat-panel {
    width: 42;
    background: #0b0b1f;
    border-left: solid #4c1d95;
    display: none;          /* hidden until F3 toggles it */
}

#chat-title {
    width: 100%;
    text-align: center;
    color: #c084fc;
    text-style: bold;
    padding: 0 1;
    height: 1;
}

#chat-log {
    height: 1fr;
    padding: 0 1;
    scrollbar-gutter: stable;
}

#chat-divider {
    margin: 0;
}

#chat-input {
    width: 100%;
    background: #12122a;
    border: solid #4c1d95;
    border-top: solid #4c1d95;
    color: #f8fafc;
    padding: 0 1;
    height: 3;
}

#chat-input:focus {
    border: solid #7c3aed;
}

#chat-status {
    width: 100%;
    height: 1;
    color: #475569;
    text-align: center;
    padding: 0 1;
}
"""


class ChatPanel(Vertical):
    """Right-side toggleable AI chat panel (Merlin guide)."""

    DEFAULT_CSS = CHAT_PANEL_CSS

    def compose(self) -> ComposeResult:
        yield Static("🧙 Merlin — AI Dungeon Guide", id="chat-title")
        yield Rule(id="chat-divider")
        yield RichLog(
            id="chat-log",
            highlight=True,
            markup=True,
            wrap=True,
        )
        yield Rule()
        yield Static("", id="chat-status")
        yield Input(
            placeholder="Ask Merlin…  (Enter to send)",
            id="chat-input",
        )

    def on_mount(self) -> None:
        self._greet()

    # ------------------------------------------------------------------
    # Public helpers called by BashcrawlApp
    # ------------------------------------------------------------------

    def append_user(self, text: str) -> None:
        """Display a player message in the chat log."""
        log = self.query_one("#chat-log", RichLog)
        log.write(f"[bold cyan]You:[/bold cyan] {text}")

    def append_ai(self, text: str) -> None:
        """Display a complete Merlin response (non-streaming)."""
        log = self.query_one("#chat-log", RichLog)
        log.write(f"[bold magenta]Merlin:[/bold magenta] {text}")
        log.write("")  # blank separator

    def begin_ai_stream(self) -> None:
        """Called before streaming tokens — writes the 'Merlin:' prefix."""
        log = self.query_one("#chat-log", RichLog)
        log.write("[bold magenta]Merlin:[/bold magenta]", end="")
        self._set_status("✨ Merlin is thinking…")

    def stream_token(self, token: str) -> None:
        """Append a streamed token to the in-progress Merlin bubble."""
        log = self.query_one("#chat-log", RichLog)
        log.write(token, end="")

    def end_ai_stream(self) -> None:
        """Called after all streaming tokens arrive — adds a blank line."""
        log = self.query_one("#chat-log", RichLog)
        log.write("")
        log.write("")
        self._set_status("")

    def append_nudge(self, text: str) -> None:
        """Insert a proactive in-character nudge (no player prompt above it)."""
        if not text:
            return
        log = self.query_one("#chat-log", RichLog)
        log.write(text)
        log.write("")

    def focus_input(self) -> None:
        """Focus the chat input field."""
        self.query_one("#chat-input", Input).focus()

    def clear(self) -> None:
        """Clear chat history and show greeting again."""
        self.query_one("#chat-log", RichLog).clear()
        self._greet()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _greet(self) -> None:
        log = self.query_one("#chat-log", RichLog)
        log.write("[bold magenta]Merlin:[/bold magenta] Greetings, brave adventurer! 🧙")
        log.write(
            "[dim]  I am Merlin, your guide through this terminal dungeon.\n"
            "  Ask me about commands, riddles of the shell, or\n"
            "  simply say [bold]help[/bold] to begin your quest!\n"
            "  [cyan](Press F3 to toggle this panel)[/cyan][/dim]"
        )
        log.write("")

    def _set_status(self, text: str) -> None:
        self.query_one("#chat-status", Static).update(f"[dim]{text}[/dim]")
