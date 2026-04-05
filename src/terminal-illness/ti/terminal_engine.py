from __future__ import annotations

# Runtime ownership: Python gameplay command runtime.
# See docs/architecture-runtime.md for boundaries.

import re
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

from prompt_toolkit import PromptSession
from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.history import InMemoryHistory
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .engine.command_table import COMMAND_TABLE
from .game_state import GameState
from .filesystem import GameFileSystem
from .quests import check_quest_completion, quest_list
from .audio import SoundManager, SoundEvent, MusicTrack, SCRIPT_SOUNDS, COMBAT_SCRIPTS


class TerminalCompleter(Completer):
    def __init__(self, commands: List[str], fs: GameFileSystem, get_cwd: Callable[[], str]):
        self.commands = commands
        self.fs = fs
        self.get_cwd = get_cwd

    def get_completions(self, document, complete_event):  # type: ignore[override]
        text = document.text_before_cursor
        parts = text.split()
        if not parts:
            for cmd in self.commands:
                yield Completion(cmd, start_position=0)
            return
        if len(parts) == 1:
            prefix = parts[0]
            for cmd in self.commands:
                if cmd.startswith(prefix):
                    yield Completion(cmd, start_position=-len(prefix))
            for name in self.fs.match_paths(self.get_cwd(), prefix):
                yield Completion(name, start_position=-len(prefix))
        else:
            last = parts[-1]
            for name in self.fs.match_paths(self.get_cwd(), last):
                yield Completion(name, start_position=-len(last))


CommandHandler = Callable[[List[str]], Tuple[str, str, str]]


@dataclass
class CommandSpec:
    name: str
    handler: CommandHandler
    help_text: str


def _normalize_merged_cmd_line(cmd_line: str) -> str:
    """Fix single-token commands where a space was lost (common in Textual web / browser automation).

    Examples: ``cdcellar`` → ``cd cellar``, ``cd../x`` → ``cd ../x``
    """
    s = cmd_line.strip()
    if not s or " " in s:
        return s
    # Only merge when the whole line is one shell token
    m = re.fullmatch(r"cd([a-zA-Z0-9_.\/-]+)", s)
    if m and len(s) > 2:
        rest = m.group(1)
        if rest:
            return f"cd {rest}"
    return s


class TerminalEngine:
    def __init__(
        self,
        state: GameState,
        fs: GameFileSystem,
        output_callback: Optional[Callable[[str, str], None]] = None,
        on_quest_complete: Optional[Callable[[], None]] = None,
        audio: Optional[SoundManager] = None,
    ) -> None:
        self.state = state
        self.fs = fs
        self.console = Console()
        self._cwd = state.current_location or "/entrance"
        self._output_callback = output_callback
        self._on_quest_complete = on_quest_complete
        self._audio = audio
        self._history = InMemoryHistory()
        self._registry: Dict[str, CommandSpec] = {}
        self._register_commands()
        self._session = PromptSession(
            history=self._history,
            completer=TerminalCompleter(self.available_commands, self.fs, self.cwd),
            enable_history_search=True,
        )

    @property
    def available_commands(self) -> List[str]:
        return sorted(self._registry.keys())

    def cwd(self) -> str:
        return self._cwd

    # ------------------------------------------------------------------
    # High-level API used by BashcrawlApp (Textual TUI)
    # ------------------------------------------------------------------

    def execute(self, cmd_line: str) -> Optional[str]:
        """Execute a command string.  Returns ``"exit"`` if the player quit."""
        if not cmd_line.strip():
            return None

        cmd_line = _normalize_merged_cmd_line(cmd_line)
        parts = cmd_line.strip().split()
        cmd, args = parts[0], parts[1:]

        # Handle executable scripts (./treasure, ./potion, etc.)
        if cmd.startswith("./"):
            try:
                kind, title, message = self._run_game_script(cmd[2:], args)
                self._emit_output(kind, message)
            except Exception as exc:
                self._emit_output("error", f"{type(exc).__name__}: {exc}")
            return None

        spec = self._registry.get(cmd)
        if not spec:
            self._emit_output("error", f"Unknown command: {cmd}. Try 'help'.")
            return None

        try:
            kind, title, message = spec.handler(args)
            if kind == "exit":
                self._emit_output("info", message or "Goodbye!")
                self.state.save()
                return "exit"
            self._emit_output(kind, message)
            if cmd not in self.state.learned_commands:
                self.state.learned_commands.append(cmd)
            self._maybe_advance_quest()
        except Exception as exc:
            self._emit_output("error", f"{type(exc).__name__}: {exc}")
        return None

    def get_completions(self, text: str) -> List[str]:
        """Return completion candidates for the current input text."""
        parts = text.split()
        if not parts:
            return list(self.available_commands)

        if len(parts) == 1 and not text.endswith(" "):
            prefix = parts[0]
            matches = [c for c in self.available_commands if c.startswith(prefix)]
            matches.extend(self.fs.match_paths(self._cwd, prefix))
            return matches

        last = parts[-1] if not text.endswith(" ") else ""
        if last:
            return self.fs.match_paths(self._cwd, last)
        return self.fs.match_paths(self._cwd, "")

    def _emit_output(self, kind: str, message: str) -> None:
        """Send output to the callback (Textual) or fall through to console."""
        if self._output_callback:
            self._output_callback(kind, message)
        else:
            self._print(kind, message)

    def _register(self, name: str, handler: CommandHandler, help_text: str) -> None:
        self._registry[name] = CommandSpec(name=name, handler=handler, help_text=help_text)

    def _register_commands(self) -> None:
        for name, method_name, help_text in COMMAND_TABLE:
            handler = getattr(self, method_name)
            self._register(name, handler, help_text)

    def run_loop(self) -> None:
        self._render_header()
        while True:
            try:
                self._render_quest_bar()
                prompt = f"[bold cyan]{self._cwd}[/] $ "
                user_input = self._session.prompt(prompt, lexer=None)
            except (EOFError, KeyboardInterrupt):
                self.console.print("\n[bold]Goodbye![/] Saving progress…")
                self.state.save()
                return

            if not user_input.strip():
                continue
            self.state.log("command", user_input)
            parts = user_input.strip().split()
            cmd, args = parts[0], parts[1:]

            # Handle executable scripts (./treasure, ./potion, etc.)
            if cmd.startswith("./"):
                try:
                    kind, title, message = self._run_game_script(cmd[2:], args)
                    self._print(kind, message)
                except Exception as exc:
                    self._print("error", f"{type(exc).__name__}: {exc}")
                continue

            spec = self._registry.get(cmd)
            if not spec:
                self._print("error", f"Unknown command: {cmd}. Try 'help'.")
                continue

            try:
                kind, title, message = spec.handler(args)
                if kind == "exit":
                    self._print("info", message or "Goodbye!")
                    self.state.save()
                    return
                self._print(kind, message)
                if cmd not in self.state.learned_commands:
                    self.state.learned_commands.append(cmd)
                self._maybe_advance_quest()
            except Exception as exc:
                self._print("error", f"{type(exc).__name__}: {exc}")

    # ------------------------------------------------------------------
    # Rendering helpers
    # ------------------------------------------------------------------

    def _print(self, kind: str, message: str) -> None:
        self.state.log(kind, message)
        styles = {
            "command": "white",
            "output": "white",
            "success": "green",
            "error": "red",
            "info": "cyan",
            "magic": "yellow",
        }
        style = styles.get(kind, "white")
        self.console.print(Panel.fit(message, style=style))

    def _render_header(self) -> None:
        inv = self.state.inventory or "empty"
        hp = self.state.hp
        subtitle = (
            f"Player: {self.state.player_name or 'Anonymous'}  |  "
            f"HP: {hp}  |  Inventory: {inv}  |  XP: {self.state.experience_points}"
        )
        self.console.print(
            Panel(
                "[bold magenta]Terminal Illness[/] — Bashcrawl Python Wrapper",
                subtitle=subtitle,
                border_style="magenta",
            )
        )

    def _render_quest_bar(self) -> None:
        quests = quest_list()
        stats = f"XP: {self.state.experience_points} • Completed: {len(self.state.completed_quest_ids)} • Mode: {self.state.mode}"
        if self.state.current_quest_id >= len(quests):
            body = "All quests complete! Explore freely…"
        else:
            q = quests[self.state.current_quest_id]
            body = f"[bold]{q.title}[/]\n{q.objective}"
        bar = Panel(body, title="Active Quest", subtitle=stats, border_style="blue")
        self.console.print(bar)

    def _maybe_advance_quest(self) -> None:
        if check_quest_completion(self.state, self._cwd):
            q = quest_list()[self.state.current_quest_id]
            self.state.completed_quest_ids.append(q.id)
            self.state.current_quest_id += 1
            self.state.experience_points += 100 if "100" in q.reward else 50
            self._emit_output("magic", f"Quest complete: {q.title}! Reward: {q.reward}")
            self.state.save()
            if self._on_quest_complete:
                self._on_quest_complete()

    # ------------------------------------------------------------------
    # Game script execution
    # ------------------------------------------------------------------

    def _run_game_script(self, script: str, args: List[str]) -> Tuple[str, str, str]:
        """Execute a bash game script (treasure, potion, statue, etc.).

        After running the script, any ``export VAR=value`` instructions in
        the output are detected and applied to the game state so the TUI
        sidebar (inventory, HP) stays in sync without the player needing
        to manually re-type the export commands.
        """
        # Play combat start SFX and switch to combat music for combat scripts
        base_name = script.split("/")[-1]
        is_combat = base_name in COMBAT_SCRIPTS
        if is_combat and self._audio:
            self._audio.play_sfx(SoundEvent.COMBAT_START)
            self._audio.play_music(MusicTrack.COMBAT)

        output, exit_code, env_updates = self.fs.run_script(
            self._cwd, script, env_vars=self.state.game_env
        )

        # Apply env updates parsed from script output
        feedback_parts: List[str] = []
        for key, value in env_updates.items():
            old_value = self.state.game_env.get(key, "")
            self.state.set_env(key, value)
            if key == "I" and value != old_value:
                # Show which items were added
                old_items = {item.strip() for item in old_value.split(",") if item.strip()}
                new_items = [
                    i.strip() for i in value.split(",")
                    if i.strip() and i.strip() not in old_items
                ]
                if new_items:
                    feedback_parts.append(
                        f"✨ Inventory updated: {', '.join(new_items)} added!"
                    )
            elif key == "HP" and value != old_value:
                feedback_parts.append(f"💚 HP set to {value}")

        text = output.rstrip() if output else "(no output)"
        if feedback_parts:
            text += "\n\n" + "\n".join(feedback_parts)

        # SFX for non-combat scripts (treasure, potion, spell)
        if self._audio:
            sfx = SCRIPT_SOUNDS.get(base_name)
            if sfx:
                self._audio.play_sfx(sfx)
            # Combat outcome: victory or death
            if is_combat:
                if self.state.hp <= 0:
                    self._audio.play_sfx(SoundEvent.PLAYER_DEATH)
                else:
                    self._audio.play_sfx(SoundEvent.COMBAT_VICTORY)
                # Restore area music after combat
                from .audio import area_track_for
                self._audio.play_music(area_track_for(self._cwd))

        return "output", script, text

    # ------------------------------------------------------------------
    # Command implementations
    # ------------------------------------------------------------------

    def _cmd_help(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            lines = ["Available Commands:"]
            for name in self.available_commands:
                lines.append(f"  {name:10s} {self._registry[name].help_text}")
            lines.append("")
            lines.append("Run game scripts with: ./treasure, ./potion, etc.")
            lines.append("")
            lines.append("Subcommands:  help commands | help map | help <room>")
            return "info", "help", "\n".join(lines)

        sub = args[0].lower()

        if sub == "commands":
            return self._help_commands()
        elif sub == "map":
            return self._help_map()
        else:
            return self._help_room(sub)

    def _help_commands(self) -> Tuple[str, str, str]:
        """Show command reference from shared YAML data."""
        try:
            from .help_data import load_commands
            categories = load_commands()
            lines = ["=== Command Reference ===", ""]
            for cat in categories:
                lines.append(f"[{cat.title}]")
                for cmd in cat.commands:
                    desc = cmd.description
                    lines.append(f"  {cmd.name:14s} {desc}")
                lines.append("")
            return "info", "help commands", "\n".join(lines)
        except Exception:
            return "info", "help commands", "Command reference unavailable."

    def _help_map(self) -> Tuple[str, str, str]:
        """Show dungeon map from shared YAML data."""
        try:
            from .help_data import load_map
            map_text = load_map()
            return "info", "help map", map_text
        except Exception:
            return "info", "help map", "Dungeon map unavailable."

    def _help_room(self, room: str) -> Tuple[str, str, str]:
        """Show context-aware help for a specific room from YAML data."""
        try:
            from .help_data import load_rooms
            rooms = load_rooms()
            info = rooms.get(room)
            if not info:
                return "error", "help", f"No help available for '{room}'."
            lines = [
                f"=== {info.title} ===",
                "",
                info.description,
                "",
                "Teaches: " + ", ".join(info.teaches),
                "",
                "Key files:",
            ]
            for f in info.key_files:
                lines.append(f"  {f}")
            lines.append("")
            lines.append("Essential commands:")
            for cmd in info.essential_commands:
                lines.append(f"  {cmd}")
            lines.append("")
            lines.append("Next: " + ", ".join(info.next_steps))
            return "info", f"help {room}", "\n".join(lines)
        except Exception:
            return "error", "help", f"No help available for '{room}'."

    def _cmd_pwd(self, args: List[str]) -> Tuple[str, str, str]:
        return "output", "pwd", self._cwd

    def _cmd_ls(self, args: List[str]) -> Tuple[str, str, str]:
        # Separate flags (e.g. -F, -la, -a) from the optional path argument
        flags: set[str] = set()
        path = ""
        for arg in args:
            if arg.startswith("-"):
                flags.update(arg.lstrip("-"))  # collect individual flag chars
            else:
                path = arg  # first non-flag arg is the target path

        show_hidden = "a" in flags  # -a / -la / -A shows dotfiles
        items = self.fs.ls(self._cwd, path, show_hidden=show_hidden)
        return "output", "ls", "  ".join(items) if items else "(empty)"

    def _cmd_cd(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("cd requires a path")
        new_cwd = self.fs.cd(self._cwd, args[0])
        self._cwd = new_cwd
        self.state.current_location = new_cwd
        # Room-enter SFX is handled in app.py _refresh_sidebar
        return "success", "cd", f"Moved to {new_cwd}"

    def _cmd_mkdir(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("mkdir requires a directory name")
        self.fs.mkdir(self._cwd, args[0])
        return "success", "mkdir", f"Created {args[0]}"

    def _cmd_touch(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("touch requires a file name")
        self.fs.touch(self._cwd, args[0])
        return "success", "touch", f"Touched {args[0]}"

    def _cmd_cat(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("cat requires a file path")
        content = self.fs.read_file(self._cwd, args[0])
        if content:
            if args[0] == "scroll" and self._audio:
                self._audio.play_sfx(SoundEvent.SCROLL_READ)
            return "output", "cat", content
        return "info", "cat", "(empty file)"

    def _cmd_grep(self, args: List[str]) -> Tuple[str, str, str]:
        if len(args) < 2:
            raise ValueError("grep requires a pattern and a file path")
        pattern, file_path = args[0], args[1]
        text = self.fs.read_file(self._cwd, file_path)
        lines = [line for line in text.splitlines() if pattern in line]
        return "output", "grep", "\n".join(lines) if lines else f"(no matches for '{pattern}')"

    def _cmd_rm(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("rm requires a file path")
        self.fs.rm(self._cwd, args[0])
        return "success", "rm", f"Removed {args[0]}"

    def _cmd_cp(self, args: List[str]) -> Tuple[str, str, str]:
        if len(args) < 2:
            raise ValueError("cp requires source and destination")
        self.fs.cp(self._cwd, args[0], args[1])
        return "success", "cp", f"Copied {args[0]} → {args[1]}"

    def _cmd_mv(self, args: List[str]) -> Tuple[str, str, str]:
        if len(args) < 2:
            raise ValueError("mv requires source and destination")
        self.fs.mv(self._cwd, args[0], args[1])
        return "success", "mv", f"Moved {args[0]} → {args[1]}"

    def _cmd_export(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("export requires VAR=value")
        assignment = " ".join(args)
        if "=" not in assignment:
            raise ValueError("Usage: export VAR=value")
        key, value = assignment.split("=", 1)
        # Expand known shell variables in the value
        value = self._expand_vars(value.strip())
        self.state.set_env(key.strip(), value)
        return "success", "export", f"Exported {key.strip()}={value}"

    def _expand_vars(self, text: str) -> str:
        """Expand $VAR references in *text* using game state."""
        replacements = {
            "$I": self.state.inventory,
            "$HP": str(self.state.hp),
            "$PWD": self._cwd,
        }
        for var, val in replacements.items():
            text = text.replace(var, val)
        # Expand custom env vars
        for key, val in self.state.env_vars.items():
            text = text.replace(f"${key}", val)
        return text

    def _cmd_echo(self, args: List[str]) -> Tuple[str, str, str]:
        """Echo text, expanding $VAR references."""
        text = " ".join(args)
        text = self._expand_vars(text)
        return "output", "echo", text

    def _cmd_save(self, args: List[str]) -> Tuple[str, str, str]:
        self.state.save()
        if self._audio:
            self._audio.play_sfx(SoundEvent.SAVE_GAME)
        return "success", "save", "Progress saved."

    def _cmd_load(self, args: List[str]) -> Tuple[str, str, str]:
        loaded = GameState.load()
        self.state.current_quest_id = loaded.current_quest_id
        self.state.completed_quest_ids = loaded.completed_quest_ids
        self.state.learned_commands = loaded.learned_commands
        self.state.current_location = loaded.current_location
        self.state.inventory = loaded.inventory
        self.state.hp = loaded.hp
        self.state.env_vars = loaded.env_vars
        self._cwd = loaded.current_location
        self.state.experience_points = loaded.experience_points
        return "success", "load", "Progress loaded."

    def _cmd_merlin(self, args: List[str]) -> Tuple[str, str, str]:
        quests = quest_list()
        if self.state.current_quest_id >= len(quests):
            tip = "Explore freely. Try 'ls', 'cd', 'cat scroll', './treasure'."
        else:
            q = quests[self.state.current_quest_id]
            tips = {
                "pwd": "Type 'pwd' and press Enter to reveal your current location.",
                "ls": "Use 'ls' to list what's in this room. Look for scrolls and treasures.",
                "cd": "Travel with 'cd directory', e.g., 'cd cellar'.",
                "cat": "Read scrolls with 'cat scroll' to learn new skills.",
                "mkdir": "Create a new room with 'mkdir name'.",
                "touch": "Create a file with 'touch filename'.",
                "grep": "Search for words in a file: grep word scroll",
            }
            key = q.required_commands[0] if q.required_commands else "ls"
            tip = tips.get(key, "Try 'help' to see available commands.")
        return "info", "merlin", f"🧙 Merlin: {tip}"

    def _cmd_exit(self, args: List[str]) -> Tuple[str, str, str]:
        return "exit", "exit", "Farewell, adventurer. Your progress has been saved."

    def _cmd_volume(self, args: List[str]) -> Tuple[str, str, str]:
        """Set audio volume: volume [sfx|music] <0-100>"""
        if not self._audio:
            return "info", "volume", "Audio is disabled."
        if not args:
            sfx = int(self._audio.sfx_volume * 100)
            music = int(self._audio.music_volume * 100)
            return "info", "volume", f"Volume — SFX: {sfx}%  Music: {music}%\n[dim]Tip: Press F5 for audio settings[/dim]"
        if len(args) == 1:
            try:
                level = max(0, min(100, int(args[0])))
            except ValueError:
                return "error", "volume", "Usage: volume [sfx|music] <0-100>"
            self._audio.set_volume(level / 100.0)
            return "success", "volume", f"Volume set to {level}%"
        channel, level_str = args[0].lower(), args[1]
        try:
            level = max(0, min(100, int(level_str)))
        except ValueError:
            return "error", "volume", "Usage: volume [sfx|music] <0-100>"
        if channel == "sfx":
            self._audio.set_sfx_volume(level / 100.0)
        elif channel == "music":
            self._audio.set_music_volume(level / 100.0)
        else:
            return "error", "volume", "Usage: volume [sfx|music] <0-100>"
        return "success", "volume", f"{channel.upper()} volume set to {level}%"

    def _cmd_mute(self, args: List[str]) -> Tuple[str, str, str]:
        """Toggle audio mute."""
        if not self._audio:
            return "info", "mute", "Audio is disabled."
        muted = self._audio.mute_toggle()
        icon = "\U0001f507" if muted else "\U0001f50a"
        return "success", "mute", f"{icon} Audio {'muted' if muted else 'unmuted'}"

