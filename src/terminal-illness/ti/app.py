"""Textual TUI for the Bashcrawl terminal learning game.

Layout
------
┌─────────────────────────────────────────────────────────────────┐
│  ⚔️  BASHCRAWL   player • HP • XP • mode           [clock]     │  Header
├──────────────────────┬──────────────────────────────────────────┤
│  📜 ACTIVE QUEST     │                                          │
│  xp / done count     │   Scrollable rich output log             │
│  ─────────────────── │                                          │
│  Quest title         │   (command echo + engine output)         │
│  Objective text      │                                          │
│                      │                                          │
│  ──────────────────  │                                          │
│  🎒 INVENTORY        │                                          │
│  HP bar  n/100       │                                          │
│  Items list          │                                          │
│                      │                                          │
│  ──────────────────  │                                          │
│  🗺️ LOCATION         │                                          │
│  /current/path       │                                          │
│  📁 dir/             │                                          │
│  📄 file             │                                          │
│  ⚡ script*          │                                          │
├──────────────────────┴──────────────────────────────────────────┤
│  /path $  _command input_________________________________       │  Input bar
├─────────────────────────────────────────────────────────────────┤
│  ^Q Quit  ^S Save  F1 Help  F2 Map  ^L Clear                   │  Footer
└─────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Callable, List, Optional

from textual import on, work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, Footer, Header, Input, Label, RichLog, Rule, Static

from .chat_panel import CHAT_PANEL_CSS, ChatPanel
from .ai_chat import AIChatService
from .chat_context import GameContextBuilder
from .audio import SoundManager, SoundEvent, MusicTrack, area_track_for
from .settings_panel import SETTINGS_CSS, AudioSettingsScreen

if TYPE_CHECKING:
    from .game_state import GameState
    from .filesystem import GameFileSystem

# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

_CSS = """
/* ── Global ─────────────────────────────────────────────────────────── */
Screen {
    background: #0d0d1a;
}

Header {
    background: #140826;
    color: #c084fc;
    text-style: bold;
}

Footer {
    background: #140826;
    color: #475569;
}

/* ── Main layout ─────────────────────────────────────────────────────── */
#main-row {
    height: 1fr;
}

/* ── Sidebar ─────────────────────────────────────────────────────────── */
#sidebar {
    width: 30;
    background: #0b0b1f;
    border-right: solid #2d2d5a;
    padding: 1 1 0 1;
}

#quest-panel {
    height: auto;
    min-height: 9;
    color: #e2e8f0;
    margin-bottom: 1;
}

#inventory-panel {
    height: auto;
    min-height: 8;
    color: #86efac;
    margin-bottom: 1;
}

#room-panel {
    height: 1fr;
    color: #93c5fd;
    overflow-y: auto;
}

/* ── Content column ──────────────────────────────────────────────────── */
#content-col {
    width: 1fr;
    background: #0d0d1a;
}

RichLog {
    height: 1fr;
    padding: 0 1;
}

/* ── Input bar ───────────────────────────────────────────────────────── */
#input-row {
    height: 3;
    background: #0b0b1f;
    border-top: solid #2d2d5a;
    align: left middle;
}

#prompt-label {
    width: auto;
    padding: 0 1;
    color: #22d3ee;
    text-style: bold;
    content-align: left middle;
}

#command-input {
    width: 1fr;
    background: transparent;
    border: none;
    color: #f8fafc;
    padding: 0;
}

#command-input:focus {
    border: none;
    background: transparent;
}

/* ── Welcome / Load modal ────────────────────────────────────────────── */
WelcomeScreen {
    align: center middle;
    background: rgba(0,0,0,0.80);
}

LoadScreen {
    align: center middle;
    background: rgba(0,0,0,0.80);
}

#welcome-box, #load-box {
    width: 64;
    height: auto;
    border: double #7c3aed;
    background: #0f0f24;
    padding: 2 4;
}

#welcome-title {
    text-align: center;
    color: #c084fc;
    text-style: bold;
    width: 100%;
    margin-bottom: 1;
}

#welcome-lore {
    text-align: center;
    color: #818cf8;
    width: 100%;
    margin-bottom: 2;
}

.field-label {
    color: #94a3b8;
    margin-top: 1;
    margin-bottom: 0;
}

.modal-input {
    width: 100%;
    border: solid #4c1d95;
    background: #1e1e3f;
    color: #f8fafc;
    margin-bottom: 1;
}

.modal-input:focus {
    border: solid #7c3aed;
}

#mode-hint {
    color: #64748b;
    width: 100%;
    text-align: center;
    margin-top: 0;
    margin-bottom: 1;
}

.primary-btn {
    width: 100%;
    background: #7c3aed;
    color: white;
    text-style: bold;
    margin-top: 1;
}

.primary-btn:hover {
    background: #6d28d9;
}

.secondary-btn {
    width: 100%;
    background: #1e293b;
    color: #94a3b8;
    margin-top: 1;
}

.secondary-btn:hover {
    background: #334155;
}

#load-info {
    color: #e2e8f0;
    width: 100%;
    margin-bottom: 2;
    text-align: center;
}
"""

# Append chat panel CSS
_CSS = _CSS.rstrip() + "\n" + CHAT_PANEL_CSS
# Append settings panel CSS
_CSS = _CSS.rstrip() + "\n" + SETTINGS_CSS

# Stronger command-bar styling when BASHCRAWL_BROWSER_AUTOMATION=1 (browser / AI tools)
_AUTOMATION_CSS = """
/* BASHCRAWL_BROWSER_AUTOMATION=1 — visible command bar for browser automation */
#command-input {
    border: solid #7c3aed;
    background: #1e1e3f;
    padding: 0 1;
}
#command-input:focus {
    border: solid #a78bfa;
    background: #1e1e3f;
}
#input-row {
    height: 4;
}
"""

if os.environ.get("BASHCRAWL_BROWSER_AUTOMATION") == "1":
    _CSS += _AUTOMATION_CSS


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _common_prefix(strings: List[str]) -> str:
    """Return longest common prefix of a list of strings."""
    if not strings:
        return ""
    prefix = strings[0]
    for s in strings[1:]:
        while not s.startswith(prefix):
            prefix = prefix[:-1]
            if not prefix:
                return ""
    return prefix


# ---------------------------------------------------------------------------
# Sidebar panels (Static subclasses for typed refresh methods)
# ---------------------------------------------------------------------------

class QuestPanel(Static):
    """Left sidebar: active quest + XP progress."""

    def refresh_quest(self, state: "GameState") -> None:
        from .quests import quest_list

        quests = quest_list()
        total = len(quests)
        done = len(state.completed_quest_ids)
        xp = state.experience_points

        header = (
            f"[bold white on #1e1e3f] 📜 ACTIVE QUEST [/bold white on #1e1e3f]  "
            f"[dim]XP:{xp}  ✅{done}/{total}[/dim]"
        )
        divider = f"[dim]{'─' * 26}[/dim]"

        if state.current_quest_id >= total:
            body = "[bold green]✨ All quests complete![/bold green]\n\n[dim]Explore freely…[/dim]"
        else:
            q = quests[state.current_quest_id]
            body = (
                f"[bold yellow]{q.title}[/bold yellow]\n\n"
                f"[dim]{q.objective}[/dim]"
            )

        self.update(f"{header}\n{divider}\n{body}")


class InventoryPanel(Static):
    """Left sidebar: health bar + inventory items."""

    def refresh_inventory(self, state: "GameState") -> None:
        hp = state.hp
        inv = state.inventory

        if hp > 0:
            filled = max(0, min(10, hp // 10))
            bar = "█" * filled + "░" * (10 - filled)
            hp_color = "green" if hp > 50 else "yellow" if hp > 20 else "red"
            hp_text = f"[{hp_color}]{bar}[/{hp_color}] [dim]{hp}/100[/dim]"
        else:
            hp_text = "[dim]─────────── 0/100[/dim]"

        if inv:
            items_lines = "\n".join(f"  [green]◆[/green] {i.strip()}" for i in inv.split(",") if i.strip())
        else:
            items_lines = "  [dim](empty)[/dim]"

        header = "[bold white on #1e1e3f] 🎒 INVENTORY [/bold white on #1e1e3f]"
        divider = f"[dim]{'─' * 26}[/dim]"
        self.update(f"{header}\n{divider}\n[dim]HP:[/dim] {hp_text}\n\n[dim]Items:[/dim]\n{items_lines}")


class RoomPanel(Static):
    """Left sidebar: current location + directory listing."""

    def refresh_room(self, cwd: str, items: List[str]) -> None:
        lines: List[str] = []
        for item in items[:22]:
            if item.endswith("/"):
                lines.append(f"  [bold blue]📁 {item}[/bold blue]")
            elif item.endswith("*"):
                lines.append(f"  [bold green]⚡ {item}[/bold green]")
            else:
                lines.append(f"  [white]📄 {item}[/white]")

        content = "\n".join(lines) if lines else "  [dim](empty)[/dim]"
        header = "[bold white on #1e1e3f] 🗺️ LOCATION [/bold white on #1e1e3f]"
        divider = f"[dim]{'─' * 26}[/dim]"
        self.update(f"{header}\n{divider}\n[bold cyan]{cwd}[/bold cyan]\n\n{content}")


# ---------------------------------------------------------------------------
# Welcome screen (shown for new games)
# ---------------------------------------------------------------------------

class WelcomeScreen(ModalScreen):
    """Character-creation screen shown when no adventurer name is set."""

    BINDINGS = [Binding("escape", "cancel", "Cancel", show=False)]

    def compose(self) -> ComposeResult:
        with Vertical(id="welcome-box"):
            yield Static(
                "⚔️   B A S H C R A W L   ⚔️\n"
                "Terminal Dungeon Learning Game",
                id="welcome-title",
            )
            yield Static(
                "A mystical realm where you master the ancient\n"
                "arts of the command line. Type your way to glory!",
                id="welcome-lore",
            )
            yield Rule()
            yield Label("Your adventurer name:", classes="field-label")
            yield Input(
                placeholder="Leave blank for Anonymous…",
                id="name-input",
                classes="modal-input",
            )
            yield Label("Game mode:", classes="field-label")
            yield Input(
                placeholder="classic  (or type: dynamic)",
                id="mode-input",
                classes="modal-input",
            )
            yield Static(
                "classic = guided quests  •  dynamic = AI-generated content",
                id="mode-hint",
            )
            yield Button("⚔️  Begin Adventure", variant="primary", id="start-btn", classes="primary-btn")

    def on_mount(self) -> None:
        self.query_one("#name-input", Input).focus()

    @on(Button.Pressed, "#start-btn")
    def _on_start(self) -> None:
        self._submit()

    @on(Input.Submitted, "#name-input")
    def _on_name_submitted(self) -> None:
        self.query_one("#mode-input", Input).focus()

    @on(Input.Submitted, "#mode-input")
    def _on_mode_submitted(self) -> None:
        self._submit()

    def _submit(self) -> None:
        name = self.query_one("#name-input", Input).value.strip() or None
        mode_raw = self.query_one("#mode-input", Input).value.strip().lower()
        mode = "dynamic" if mode_raw == "dynamic" else "classic"
        self.dismiss({"name": name, "mode": mode})

    def action_cancel(self) -> None:
        self.dismiss({"name": None, "mode": "classic"})


# ---------------------------------------------------------------------------
# Load-game screen (shown when a save file exists)
# ---------------------------------------------------------------------------

class LoadScreen(ModalScreen):
    """Ask whether to load an existing save or start fresh."""

    BINDINGS = [Binding("escape", "new_game", "New game", show=False)]

    def __init__(self, state: "GameState") -> None:
        super().__init__()
        self._state = state

    def compose(self) -> ComposeResult:
        s = self._state
        info = (
            f"[bold yellow]{s.player_name or 'Anonymous'}[/bold yellow]\n"
            f"[dim]XP: {s.experience_points}  •  "
            f"Quests: {len(s.completed_quest_ids)}  •  "
            f"Location: {s.current_location}  •  "
            f"Mode: {s.mode}[/dim]"
        )
        with Vertical(id="load-box"):
            yield Static(
                "⚔️   B A S H C R A W L   ⚔️\n"
                "Save file found!",
                id="welcome-title",
            )
            yield Rule()
            yield Static(info, id="load-info")
            yield Button("📂  Continue Adventure", variant="primary", id="load-btn", classes="primary-btn")
            yield Button("🆕  New Game", id="new-btn", classes="secondary-btn")

    def on_mount(self) -> None:
        self.query_one("#load-btn", Button).focus()

    @on(Button.Pressed, "#load-btn")
    def _on_load(self) -> None:
        self.dismiss(True)

    @on(Button.Pressed, "#new-btn")
    def _on_new(self) -> None:
        self.dismiss(False)

    def action_new_game(self) -> None:
        self.dismiss(False)


# ---------------------------------------------------------------------------
# Main Textual application
# ---------------------------------------------------------------------------

class BashcrawlApp(App):
    """Textual TUI for the Bashcrawl terminal learning game."""

    CSS = _CSS
    TITLE = "⚔️  BASHCRAWL — Terminal Dungeon"

    BINDINGS = [
        Binding("ctrl+q", "quit_game", "Quit", show=True),
        Binding("ctrl+s", "save_game", "Save", show=True),
        Binding("f1", "show_help", "Help", show=True),
        Binding("f2", "show_map", "Map", show=True),
        Binding("f3", "toggle_chat", "AI Chat", show=True),
        Binding("f4", "toggle_mute", "Mute", show=True),
        Binding("f5", "show_settings", "Settings", show=True),
        Binding("ctrl+l", "clear_log", "Clear", show=True),
        # Tab is handled in on_key so it doesn't bubble to focus-next
    ]

    def __init__(self, state: "GameState", fs: "GameFileSystem", agent_mode: bool = False) -> None:
        super().__init__()
        self.game_state = state
        self.fs = fs
        self.agent_mode = agent_mode
        self._session: Optional[object] = None  # GameSession, set in on_mount
        self._engine: Optional[object] = None  # TerminalEngine alias, set in on_mount
        self._cmd_history: List[str] = []
        self._history_idx: int = -1
        self._chat_svc = AIChatService()
        self._context_builder = GameContextBuilder()
        self._prev_cwd: str = ""  # for room-change detection
        self._low_health_warned: bool = False  # debounce low-health SFX
        self._audio = SoundManager(
            disabled=agent_mode,
            sfx_volume=state.audio_sfx_volume,
            music_volume=state.audio_music_volume,
            muted=state.audio_muted,
        )

    # ------------------------------------------------------------------
    # Compose
    # ------------------------------------------------------------------

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="main-row"):
            with Vertical(id="sidebar"):
                yield QuestPanel(id="quest-panel")
                yield Rule()
                yield InventoryPanel(id="inventory-panel")
                yield Rule()
                yield RoomPanel(id="room-panel")
            with Vertical(id="content-col"):
                yield RichLog(
                    id="output-log",
                    highlight=True,
                    markup=True,
                    wrap=True,
                )
            yield ChatPanel(id="chat-panel")
        with Horizontal(id="input-row"):
            yield Label(
                f"[bold cyan]{self.game_state.current_location or '/entrance'}[/bold cyan] $",
                id="prompt-label",
            )
            yield Input(
                placeholder="Enter command…  (Tab=complete  ↑↓=history  F3=AI Chat)",
                id="command-input",
                classes="bashcrawl-command-input",
            )
        yield Footer()

    # ------------------------------------------------------------------
    # Startup
    # ------------------------------------------------------------------

    def on_mount(self) -> None:
        from .session import GameSession

        self._session = GameSession(
            self.game_state,
            self.fs,
            output_callback=self._print_output,
            on_quest_complete=self._on_quest_complete,
            audio=self._audio,
        )
        self._engine = self._session.engine
        self._update_subtitle()
        self._refresh_sidebar()
        self._print_welcome()
        self._audio.play_music(MusicTrack.TITLE_THEME)
        self._audio.play_sfx(SoundEvent.WELCOME_FANFARE)
        self.query_one("#command-input", Input).focus()

        # Startup screens are pushed AFTER mount so the main UI is ready underneath.
        # In agent mode, browser web mode, or browser automation, skip modal screens.
        if (
            self.agent_mode
            or os.environ.get("BASHCRAWL_WEB_MODE") == "1"
            or os.environ.get("BASHCRAWL_BROWSER_AUTOMATION") == "1"
        ):
            self._update_subtitle()
            self._refresh_sidebar()
            return

        saved = self.game_state
        has_save = bool(
            saved.player_name
            or saved.experience_points > 0
            or saved.completed_quest_ids
        )
        if has_save:
            self.push_screen(LoadScreen(saved), self._handle_load_choice)
        else:
            self.push_screen(WelcomeScreen(), self._handle_welcome)

    def _handle_welcome(self, result: dict) -> None:
        if result:
            self.game_state.player_name = result.get("name")
            self.game_state.mode = result.get("mode", "classic")
        self._update_subtitle()
        self._refresh_sidebar()
        self.query_one("#command-input", Input).focus()

    def _handle_load_choice(self, load: bool) -> None:
        if not load:
            # Reset state but keep fs; show welcome for new name/mode
            from .game_state import GameState
            fresh = GameState()
            # Copy over fields we need to reset
            self.game_state.current_quest_id = fresh.current_quest_id
            self.game_state.completed_quest_ids = fresh.completed_quest_ids
            self.game_state.learned_commands = fresh.learned_commands
            self.game_state.current_location = fresh.current_location
            self.game_state.inventory = fresh.inventory
            self.game_state.hp = fresh.hp
            self.game_state.experience_points = fresh.experience_points
            self.game_state.env_vars = fresh.env_vars
            self.game_state.player_name = None
            # Update engine's cwd too
            if self._engine:
                self._engine._cwd = fresh.current_location  # type: ignore[union-attr]
            self.push_screen(WelcomeScreen(), self._handle_welcome)
        else:
            self._update_subtitle()
            self._refresh_sidebar()
            if self._engine:
                self._engine._cwd = self.game_state.current_location  # type: ignore[union-attr]
            self._print_output("success", f"Welcome back, {self.game_state.player_name or 'adventurer'}!")
            self.query_one("#command-input", Input).focus()

    def _print_welcome(self) -> None:
        log = self.query_one("#output-log", RichLog)
        log.write("")
        log.write("[bold magenta]  ⚔️  Welcome to BASHCRAWL — Terminal Dungeon  ⚔️[/bold magenta]")
        log.write("[dim]  A mystical realm where you master the ancient arts of the command line.[/dim]")
        log.write("")
        log.write("[cyan]  ▸ [bold]cat scroll[/bold]   — read the area scroll[/cyan]")
        log.write("[cyan]  ▸ [bold]ls[/bold]           — look around you[/cyan]")
        log.write("[cyan]  ▸ [bold]help[/bold]         — show all commands[/cyan]")
        log.write("[cyan]  ▸ [bold]merlin[/bold]       — ask Merlin for a hint[/cyan]")
        log.write("[dim]  ▸ Tab=complete  ↑↓=history  F1=Help  F2=Map  F3=AI Chat  Ctrl+S=Save[/dim]")
        log.write("")

    # ------------------------------------------------------------------
    # Input event handling
    # ------------------------------------------------------------------

    @on(Input.Submitted, "#command-input")
    def _on_command_submitted(self, event: Input.Submitted) -> None:
        cmd = event.value.strip()
        self.query_one("#command-input", Input).clear()
        self._history_idx = -1

        if not cmd:
            return

        # Append to history (no consecutive duplicates)
        if not self._cmd_history or self._cmd_history[-1] != cmd:
            self._cmd_history.append(cmd)

        # Echo command in output
        log = self.query_one("#output-log", RichLog)
        cwd = self._engine._cwd if self._engine else "/entrance"  # type: ignore[union-attr]
        log.write(f"[bold cyan]{cwd}[/bold cyan] [dim]$[/dim] [bold white]{cmd}[/bold white]")

        # Execute via engine
        result = self._engine.execute(cmd) if self._engine else ""  # type: ignore[union-attr]
        if result == "exit":
            self.exit()
            return

        self._refresh_sidebar()
        self._update_subtitle()

        # Proactive AI: check for stuck pattern after each command
        if GameContextBuilder.detect_stuck(self._cmd_history):
            nudge = self._chat_svc.nudge("stuck")
            if nudge:
                try:
                    self.query_one("#chat-panel", ChatPanel).append_nudge(nudge)
                except Exception:
                    pass

        # Intercept 'merlin' as a shorthand to open chat
        if cmd.lower().startswith("merlin"):
            question = cmd[6:].strip()
            self.action_toggle_chat(open_only=True)
            if question:
                self._send_to_merlin(question)

    @on(Input.Submitted, "#chat-input")
    def _on_chat_submitted(self, event: Input.Submitted) -> None:
        question = event.value.strip()
        chat_input = self.query_one("#chat-input", Input)
        chat_input.clear()
        if not question:
            return
        self._send_to_merlin(question)
        # Return focus to game input after sending
        self.set_timer(0.05, lambda: self.query_one("#command-input", Input).focus())

    def on_key(self, event) -> None:
        """Handle Tab (completion) and Up/Down (history) on the command input."""
        inp = self.query_one("#command-input", Input)

        # Allow Escape in chat input to return focus to game
        if event.key == "escape":
            try:
                chat_inp = self.query_one("#chat-input", Input)
                if chat_inp.has_focus:
                    event.prevent_default()
                    self.query_one("#command-input", Input).focus()
                    return
            except Exception:
                pass

        if not inp.has_focus:
            return

        if event.key == "tab":
            event.prevent_default()
            event.stop()
            self._do_tab_complete()

        elif event.key == "up":
            event.prevent_default()
            event.stop()
            self._history_up(inp)

        elif event.key == "down":
            event.prevent_default()
            event.stop()
            self._history_down(inp)

    # ------------------------------------------------------------------
    # Tab completion
    # ------------------------------------------------------------------

    def _do_tab_complete(self) -> None:
        if not self._engine:
            return
        inp = self.query_one("#command-input", Input)
        text = inp.value

        completions = self._engine.get_completions(text)  # type: ignore[union-attr]
        if not completions:
            return

        # Split into (prefix_before_last_word, last_word)
        if text and not text.endswith(" "):
            parts = text.split()
            last = parts[-1] if parts else ""
            prefix = text[: len(text) - len(last)]
        else:
            prefix = text
            last = ""

        matching = [c for c in completions if c.startswith(last)]
        if not matching:
            return

        if len(matching) == 1:
            completed = prefix + matching[0]
            if not completed.endswith("/"):
                completed += " "
            inp.value = completed
            inp.cursor_position = len(completed)
        else:
            # Show all options in the log
            log = self.query_one("#output-log", RichLog)
            cwd = self._engine._cwd if self._engine else ""  # type: ignore[union-attr]
            log.write(f"[bold cyan]{cwd}[/bold cyan] [dim]$[/dim] [bold white]{text}[/bold white]")
            log.write("[dim]" + "   ".join(matching) + "[/dim]")
            # Extend to common prefix
            common = _common_prefix(matching)
            if len(common) > len(last):
                inp.value = prefix + common
                inp.cursor_position = len(inp.value)

    # ------------------------------------------------------------------
    # Command history navigation
    # ------------------------------------------------------------------

    def _history_up(self, inp: Input) -> None:
        if not self._cmd_history:
            return
        if self._history_idx == -1:
            self._history_idx = len(self._cmd_history) - 1
        elif self._history_idx > 0:
            self._history_idx -= 1
        inp.value = self._cmd_history[self._history_idx]
        inp.cursor_position = len(inp.value)

    def _history_down(self, inp: Input) -> None:
        if self._history_idx == -1:
            return
        self._history_idx += 1
        if self._history_idx >= len(self._cmd_history):
            self._history_idx = -1
            inp.value = ""
        else:
            inp.value = self._cmd_history[self._history_idx]
            inp.cursor_position = len(inp.value)

    # ------------------------------------------------------------------
    # UI refresh helpers
    # ------------------------------------------------------------------

    def _print_output(self, kind: str, message: str) -> None:
        """Output callback used by TerminalEngine to display results."""
        log = self.query_one("#output-log", RichLog)
        colours: dict[str, str] = {
            "output":  "#e2e8f0",
            "success": "#4ade80",
            "error":   "#f87171",
            "info":    "#67e8f9",
            "magic":   "#fbbf24",
        }
        colour = colours.get(kind, "#e2e8f0")
        log.write(f"[dim]{'─' * 60}[/dim]")
        for line in message.splitlines():
            log.write(f"[{colour}]{line}[/{colour}]")

        # Trigger SFX based on output kind
        if kind == "error":
            self._audio.play_sfx(SoundEvent.COMMAND_ERROR)

    def _refresh_sidebar(self) -> None:
        cwd = (
            self._engine._cwd  # type: ignore[union-attr]
            if self._engine
            else (self.game_state.current_location or "/entrance")
        )
        try:
            items = self.fs.ls(cwd, "")
        except Exception:
            items = []

        self.query_one("#quest-panel", QuestPanel).refresh_quest(self.game_state)
        self.query_one("#inventory-panel", InventoryPanel).refresh_inventory(self.game_state)
        self.query_one("#room-panel", RoomPanel).refresh_room(cwd, items)
        self.query_one("#prompt-label", Label).update(
            f"[bold cyan]{cwd}[/bold cyan] $"
        )

        # Proactive AI: nudge on room change + switch music
        if cwd != self._prev_cwd:
            self._prev_cwd = cwd
            self._audio.play_sfx(SoundEvent.ROOM_ENTER)
            self._audio.play_music(area_track_for(cwd))
            nudge = self._chat_svc.nudge("new_room")
            if nudge:
                try:
                    self.query_one("#chat-panel", ChatPanel).append_nudge(nudge)
                except Exception:
                    pass

        # Proactive AI: nudge on low health + SFX (debounced)
        if self.game_state.hp > 0 and self.game_state.hp < 20:
            if not self._low_health_warned:
                self._low_health_warned = True
                self._audio.play_sfx(SoundEvent.LOW_HEALTH_WARNING)
            nudge = self._chat_svc.nudge("low_health")
            if nudge:
                try:
                    self.query_one("#chat-panel", ChatPanel).append_nudge(nudge)
                except Exception:
                    pass
        elif self.game_state.hp >= 20:
            self._low_health_warned = False

    def _update_subtitle(self) -> None:
        name = self.game_state.player_name or "Anonymous"
        hp = self.game_state.hp
        xp = self.game_state.experience_points
        mode = self.game_state.mode
        audio_icon = "🔇" if self._audio.muted else "🔊"
        self.sub_title = f"{name}  •  HP: {hp}  •  XP: {xp}  •  {mode}  •  {audio_icon}"

    def _on_quest_complete(self) -> None:
        """Called by TerminalEngine whenever a quest is completed."""
        self._audio.play_sfx(SoundEvent.QUEST_COMPLETE)
        self._refresh_sidebar()
        self._update_subtitle()
        self.notify(
            "Check your updated XP and unlock new areas!",
            title="⚔️ Quest Complete!",
            severity="information",
            timeout=5,
        )
        nudge = self._chat_svc.nudge("quest_complete")
        if nudge:
            try:
                self.query_one("#chat-panel", ChatPanel).append_nudge(nudge)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Bound actions
    # ------------------------------------------------------------------

    def action_toggle_chat(self, open_only: bool = False) -> None:
        """Toggle the AI chat panel (F3).  If open_only=True, only opens it."""
        try:
            panel = self.query_one("#chat-panel", ChatPanel)
            currently_visible = panel.display
            if open_only and currently_visible:
                panel.focus_input()
                return
            if open_only or not currently_visible:
                panel.display = True
                panel.focus_input()
            else:
                panel.display = False
                self.query_one("#command-input", Input).focus()
        except Exception:
            pass

    @work(thread=True, exit_on_error=False)
    def _send_to_merlin(self, question: str) -> None:
        """Worker: stream a player question to Merlin and display the response.

        exit_on_error=False ensures that any exception in this worker is
        silently absorbed (and shown in the chat panel) rather than closing
        the entire Textual application.
        """
        import asyncio
        import traceback

        try:
            context = self._context_builder.build(
                self.game_state, self.fs, self._cmd_history
            )
        except Exception as exc:
            self.log.error(f"[Merlin] Context build failed: {exc}")
            return

        try:
            panel = self.query_one("#chat-panel", ChatPanel)
        except Exception:
            return

        try:
            self.call_from_thread(panel.append_user, question)
            self.call_from_thread(panel.begin_ai_stream)

            if not self._chat_svc.is_available():
                # Synchronous fallback (no streaming)
                response = self._chat_svc._fallback_response(question, context)
                self.call_from_thread(panel.end_ai_stream)
                self.call_from_thread(panel.append_ai, response)
                return

            # Streaming via async — run in a fresh event loop on this thread
            async def _stream() -> None:
                async for token in self._chat_svc.ask_streaming(question, context):
                    self.call_from_thread(panel.stream_token, token)

            asyncio.run(_stream())
            self.call_from_thread(panel.end_ai_stream)

        except Exception as exc:
            # Show the error in the chat panel instead of crashing
            tb = traceback.format_exc(limit=3)
            self.log.error(f"[Merlin] Worker error:\n{tb}")
            try:
                self.call_from_thread(panel.end_ai_stream)
                self.call_from_thread(
                    panel.append_ai,
                    f"[red]Merlin's spell misfired: {exc}[/red]\n"
                    "[dim]Check ANTHROPIC_API_KEY or try again.[/dim]",
                )
            except Exception:
                pass

    def action_quit_game(self) -> None:
        self._persist_audio_prefs()
        self.game_state.save()
        self._audio.shutdown()
        self._print_output("info", "💾 Progress saved. Farewell, adventurer!")
        self.exit()

    def action_save_game(self) -> None:
        self._persist_audio_prefs()
        self.game_state.save()
        self._audio.play_sfx(SoundEvent.SAVE_GAME)
        self.notify("Progress saved!", title="Save", severity="information", timeout=3)

    def action_show_help(self) -> None:
        if self._engine:
            kind, _, msg = self._engine._cmd_help([])  # type: ignore[union-attr]
            self._print_output(kind, msg)

    def action_show_map(self) -> None:
        if self._engine:
            kind, _, msg = self._engine._help_map()  # type: ignore[union-attr]
            self._print_output(kind, msg)

    def action_clear_log(self) -> None:
        self.query_one("#output-log", RichLog).clear()
        self._print_welcome()

    def action_toggle_mute(self) -> None:
        """Toggle audio mute (F4)."""
        muted = self._audio.mute_toggle()
        icon = "🔇" if muted else "🔊"
        self.notify(f"{icon} Audio {'muted' if muted else 'unmuted'}", timeout=2)
        self._update_subtitle()

    def action_show_settings(self) -> None:
        """Open audio settings panel (F5)."""
        if self.agent_mode:
            return
        cwd = self._engine._cwd if self._engine else "entrance"  # type: ignore[union-attr]
        self.push_screen(
            AudioSettingsScreen(self._audio, self.game_state, current_cwd=cwd),
            self._handle_settings_result,
        )

    def _handle_settings_result(self, result: None) -> None:
        """Called when audio settings modal is dismissed."""
        self._update_subtitle()

    def _persist_audio_prefs(self) -> None:
        """Copy current audio settings into game state for persistence."""
        self.game_state.audio_muted = self._audio.muted
        self.game_state.audio_sfx_volume = self._audio.sfx_volume
        self.game_state.audio_music_volume = self._audio.music_volume
