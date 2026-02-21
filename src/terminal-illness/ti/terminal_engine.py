"""Terminal engine: command parsing, game logic, and quest tracking.

Rendering is fully delegated to the caller via ``output_callback``, which
makes this module independent of any TUI framework.  The Textual app in
``app.py`` passes ``BashcrawlApp._print_output`` as the callback.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

from .game_state import GameState
from .filesystem import GameFileSystem
from .quests import check_quest_completion, quest_list

# (kind, message) where kind ∈ {output, success, error, info, magic, exit}
OutputCallback = Callable[[str, str], None]
QuestCompleteCallback = Callable[[], None]


@dataclass
class CommandSpec:
    name: str
    handler: Callable[[List[str]], Tuple[str, str, str]]
    help_text: str


class TerminalEngine:
    """Processes commands, manages game state, and fires output callbacks."""

    def __init__(
        self,
        state: GameState,
        fs: GameFileSystem,
        output_callback: OutputCallback,
        on_quest_complete: Optional[QuestCompleteCallback] = None,
    ) -> None:
        self.state = state
        self.fs = fs
        self._output = output_callback
        self._on_quest_complete = on_quest_complete
        self._cwd: str = state.current_location or "/entrance"
        self._registry: Dict[str, CommandSpec] = {}
        self._register_commands()

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def cwd(self) -> str:
        return self._cwd

    @property
    def available_commands(self) -> List[str]:
        return sorted(self._registry.keys())

    # ------------------------------------------------------------------
    # Command registration
    # ------------------------------------------------------------------

    def _register(self, name: str, handler: Callable, help_text: str) -> None:
        self._registry[name] = CommandSpec(name=name, handler=handler, help_text=help_text)

    def _register_commands(self) -> None:
        self._register("help",   self._cmd_help,   "Show available commands and subcommands")
        self._register("pwd",    self._cmd_pwd,    "Print working directory")
        self._register("ls",     self._cmd_ls,     "List directory contents")
        self._register("cd",     self._cmd_cd,     "Change directory")
        self._register("mkdir",  self._cmd_mkdir,  "Create a new directory")
        self._register("touch",  self._cmd_touch,  "Create an empty file")
        self._register("cat",    self._cmd_cat,    "Display file contents")
        self._register("grep",   self._cmd_grep,   "Search for text inside a file")
        self._register("rm",     self._cmd_rm,     "Remove a file")
        self._register("cp",     self._cmd_cp,     "Copy a file")
        self._register("mv",     self._cmd_mv,     "Move or rename a file / directory")
        self._register("export", self._cmd_export, "Set a game variable  (VAR=value)")
        self._register("echo",   self._cmd_echo,   "Print text or expand $VARIABLES")
        self._register("save",   self._cmd_save,   "Save progress to disk")
        self._register("load",   self._cmd_load,   "Load most recent save")
        self._register("merlin", self._cmd_merlin, "Ask Merlin the wizard for a hint")
        self._register("exit",   self._cmd_exit,   "Exit the game (progress is saved)")

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def execute(self, user_input: str) -> str:
        """Process *user_input* and fire the output callback.

        Returns ``'exit'`` when the player has quit, empty string otherwise.
        """
        if not user_input.strip():
            return ""

        self.state.log("command", user_input)
        parts = user_input.strip().split()
        cmd, args = parts[0], parts[1:]

        # Executable game scripts (./treasure, ./potion, etc.)
        if cmd.startswith("./"):
            try:
                kind, title, message = self._run_game_script(cmd[2:], args)
                self._output(kind, message)
            except Exception as exc:
                self._output("error", f"{type(exc).__name__}: {exc}")
            return ""

        spec = self._registry.get(cmd)
        if not spec:
            self._output(
                "error",
                f"Unknown command: '[bold]{cmd}[/bold]'.\n"
                f"Type [cyan]help[/cyan] to see available commands.",
            )
            return ""

        try:
            kind, title, message = spec.handler(args)
            if kind == "exit":
                self._output("info", message or "Farewell, adventurer!")
                self.state.save()
                return "exit"
            self._output(kind, message)
            if cmd not in self.state.learned_commands:
                self.state.learned_commands.append(cmd)
            self._maybe_advance_quest()
        except Exception as exc:
            self._output("error", f"[bold]{type(exc).__name__}:[/bold] {exc}")

        return ""

    # ------------------------------------------------------------------
    # Tab completion
    # ------------------------------------------------------------------

    def get_completions(self, text: str) -> List[str]:
        """Return possible completion strings for the *last word* in *text*.

        The returned items are bare words (not full lines), suitable for
        the caller to splice onto the appropriate prefix.
        """
        parts = text.split()

        # Empty input or completing first word (command name / path)
        if not parts or (len(parts) == 1 and not text.endswith(" ")):
            prefix = parts[0] if parts else ""
            cmds = [c for c in self.available_commands if c.startswith(prefix)]
            paths = self.fs.match_paths(self._cwd, prefix)
            # De-duplicate while preserving order
            seen: set = set()
            result: List[str] = []
            for item in cmds + paths:
                if item not in seen:
                    seen.add(item)
                    result.append(item)
            return result

        # Completing an argument
        last = "" if text.endswith(" ") else parts[-1]
        return self.fs.match_paths(self._cwd, last)

    # ------------------------------------------------------------------
    # Quest advancement
    # ------------------------------------------------------------------

    def _maybe_advance_quest(self) -> None:
        if check_quest_completion(self.state, self._cwd):
            quests = quest_list()
            q = quests[self.state.current_quest_id]
            self.state.completed_quest_ids.append(q.id)
            self.state.current_quest_id += 1
            xp_gain = q.xp if q.xp else 50
            self.state.experience_points += xp_gain
            self._output(
                "magic",
                f"✨ [bold]Quest Complete:[/bold] {q.title}\n"
                f"🎁 [bold]Reward:[/bold] {q.reward}\n"
                f"⭐ +{xp_gain} XP",
            )
            self.state.save()
            if self._on_quest_complete:
                self._on_quest_complete()

    # ------------------------------------------------------------------
    # Game-script execution
    # ------------------------------------------------------------------

    def _run_game_script(self, script: str, args: List[str]) -> Tuple[str, str, str]:
        """Execute a bash game script (treasure, potion, statue, …)."""
        output, exit_code, _ = self.fs.run_script(
            self._cwd, script, env_vars=self.state.game_env
        )
        text = output.rstrip() if output else "(no output)"
        return "output", script, text

    # ------------------------------------------------------------------
    # Command implementations
    # ------------------------------------------------------------------

    def _cmd_help(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            lines = ["[bold]Available Commands[/bold]", ""]
            for name in self.available_commands:
                lines.append(
                    f"  [cyan]{name:<10}[/cyan]  [dim]{self._registry[name].help_text}[/dim]"
                )
            lines += [
                "",
                "Run game scripts with: [yellow]./treasure[/yellow], [yellow]./potion[/yellow], etc.",
                "",
                "[dim]Subcommands:  help commands | help map | help <room>[/dim]",
                "[dim]Shortcuts:    F1=Help  F2=Map  Ctrl+S=Save  Ctrl+L=Clear[/dim]",
            ]
            return "info", "help", "\n".join(lines)

        sub = args[0].lower()
        if sub == "commands":
            return self._help_commands()
        if sub == "map":
            return self._help_map()
        return self._help_room(sub)

    def _help_commands(self) -> Tuple[str, str, str]:
        try:
            from .help_data import load_commands

            categories = load_commands()
            lines = ["[bold]═══ Command Reference ═══[/bold]", ""]
            for cat in categories:
                lines.append(f"[bold cyan]{cat.title}[/bold cyan]")
                for cmd in cat.commands:
                    lines.append(f"  [yellow]{cmd.command:<18}[/yellow] [dim]{cmd.description}[/dim]")
                lines.append("")
            return "info", "commands", "\n".join(lines)
        except Exception:
            return "info", "commands", "Command reference unavailable."

    def _help_map(self) -> Tuple[str, str, str]:
        try:
            from .help_data import load_map

            return "info", "map", load_map()
        except Exception:
            return "info", "map", "Dungeon map unavailable."

    def _help_room(self, room: str) -> Tuple[str, str, str]:
        try:
            from .help_data import load_rooms

            rooms = load_rooms()
            info = rooms.get(room)
            if not info:
                return "error", "help", f"No help available for '[bold]{room}[/bold]'."

            lines = [f"[bold]{info.emoji} {info.title}[/bold]", "", info.description, ""]
            lines.append("[dim]Teaches:[/dim] " + ", ".join(info.teaches))
            lines += ["", "[dim]Key files:[/dim]"]
            for f in info.key_files:
                if isinstance(f, dict):
                    lines.append(f"  📄 [bold]{f.get('name', '')}[/bold] — {f.get('description', '')}")
                else:
                    lines.append(f"  📄 {f}")
            lines += ["", "[dim]Essential commands:[/dim]"]
            for c in info.essential_commands:
                if isinstance(c, dict):
                    lines.append(f"  [yellow]{c.get('command', '')}[/yellow] — [dim]{c.get('description', '')}[/dim]")
                else:
                    lines.append(f"  [yellow]{c}[/yellow]")
            lines += ["", f"[dim]Next:[/dim] {info.next_steps}"]
            return "info", f"help {room}", "\n".join(lines)
        except Exception as exc:
            return "error", "help", f"Room help unavailable: {exc}"

    # ── Core filesystem commands ────────────────────────────────────────

    def _cmd_pwd(self, args: List[str]) -> Tuple[str, str, str]:
        return "output", "pwd", self._cwd

    def _cmd_ls(self, args: List[str]) -> Tuple[str, str, str]:
        path = args[0] if args else ""
        items = self.fs.ls(self._cwd, path)
        if not items:
            return "output", "ls", "(empty)"
        parts: List[str] = []
        for item in items:
            if item.endswith("/"):
                parts.append(f"[bold blue]{item}[/bold blue]")
            elif item.endswith("*"):
                parts.append(f"[bold green]{item}[/bold green]")
            else:
                parts.append(f"[white]{item}[/white]")
        return "output", "ls", "  ".join(parts)

    def _cmd_cd(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("cd requires a path argument")
        new_cwd = self.fs.cd(self._cwd, args[0])
        self._cwd = new_cwd
        self.state.current_location = new_cwd
        return "success", "cd", f"Moved to [bold]{new_cwd}[/bold]"

    def _cmd_mkdir(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("mkdir requires a directory name")
        self.fs.mkdir(self._cwd, args[0])
        return "success", "mkdir", f"Created directory [bold]{args[0]}[/bold]"

    def _cmd_touch(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("touch requires a file name")
        self.fs.touch(self._cwd, args[0])
        return "success", "touch", f"Created file [bold]{args[0]}[/bold]"

    def _cmd_cat(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("cat requires a file path")
        content = self.fs.read_file(self._cwd, args[0])
        return ("output", "cat", content) if content else ("info", "cat", "(empty file)")

    def _cmd_grep(self, args: List[str]) -> Tuple[str, str, str]:
        if len(args) < 2:
            raise ValueError("grep requires a pattern and a file path  (grep PATTERN FILE)")
        pattern, file_path = args[0], args[1]
        text = self.fs.read_file(self._cwd, file_path)
        matched = [l for l in text.splitlines() if pattern in l]
        if matched:
            highlighted = [
                l.replace(pattern, f"[bold yellow]{pattern}[/bold yellow]") for l in matched
            ]
            return "output", "grep", "\n".join(highlighted)
        return "output", "grep", f"(no matches for '[yellow]{pattern}[/yellow]')"

    def _cmd_rm(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("rm requires a file path")
        self.fs.rm(self._cwd, args[0])
        return "success", "rm", f"Removed [bold]{args[0]}[/bold]"

    def _cmd_cp(self, args: List[str]) -> Tuple[str, str, str]:
        if len(args) < 2:
            raise ValueError("cp requires source and destination")
        self.fs.cp(self._cwd, args[0], args[1])
        return "success", "cp", f"Copied [bold]{args[0]}[/bold] → [bold]{args[1]}[/bold]"

    def _cmd_mv(self, args: List[str]) -> Tuple[str, str, str]:
        if len(args) < 2:
            raise ValueError("mv requires source and destination")
        self.fs.mv(self._cwd, args[0], args[1])
        return "success", "mv", f"Moved [bold]{args[0]}[/bold] → [bold]{args[1]}[/bold]"

    # ── Variable / environment commands ────────────────────────────────

    def _cmd_export(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("export requires VAR=value")
        assignment = " ".join(args)
        if "=" not in assignment:
            raise ValueError("Usage: export VAR=value")
        key, value = assignment.split("=", 1)
        self.state.set_env(key.strip(), value.strip())
        return "success", "export", f"Exported [bold]{key.strip()}[/bold]=[cyan]{value.strip()}[/cyan]"

    def _cmd_echo(self, args: List[str]) -> Tuple[str, str, str]:
        text = " ".join(args)
        # Built-in variable expansion
        text = text.replace("$I",   self.state.inventory)
        text = text.replace("$HP",  str(self.state.hp))
        text = text.replace("$PWD", self._cwd)
        for key, val in self.state.env_vars.items():
            text = text.replace(f"${key}", val)
        return "output", "echo", text

    # ── Persistence ─────────────────────────────────────────────────────

    def _cmd_save(self, args: List[str]) -> Tuple[str, str, str]:
        self.state.save()
        return "success", "save", "💾 Progress saved."

    def _cmd_load(self, args: List[str]) -> Tuple[str, str, str]:
        loaded = GameState.load()
        self.state.current_quest_id    = loaded.current_quest_id
        self.state.completed_quest_ids = loaded.completed_quest_ids
        self.state.learned_commands    = loaded.learned_commands
        self.state.current_location    = loaded.current_location
        self.state.inventory           = loaded.inventory
        self.state.hp                  = loaded.hp
        self.state.env_vars            = loaded.env_vars
        self.state.experience_points   = loaded.experience_points
        self._cwd = loaded.current_location
        return "success", "load", "📂 Progress loaded."

    # ── Hint system ─────────────────────────────────────────────────────

    def _cmd_merlin(self, args: List[str]) -> Tuple[str, str, str]:
        quests = quest_list()
        if self.state.current_quest_id >= len(quests):
            tip = "Explore freely! Try 'ls', 'cd', 'cat scroll', './treasure'."
        else:
            q = quests[self.state.current_quest_id]
            tips: Dict[str, str] = {
                "pwd":   "Type [cyan]pwd[/cyan] and press Enter — it reveals your current location.",
                "ls":    "Use [cyan]ls[/cyan] to list what's in this room. Look for scrolls and treasures.",
                "cd":    "Travel with [cyan]cd directory[/cyan], e.g. [cyan]cd cellar[/cyan].",
                "cat":   "Read scrolls with [cyan]cat scroll[/cyan] to learn new skills.",
                "mkdir": "Create a new room with [cyan]mkdir name[/cyan].",
                "touch": "Create a file with [cyan]touch filename[/cyan].",
                "grep":  "Search scrolls with [cyan]grep word scroll[/cyan].",
            }
            key = q.required_commands[0] if q.required_commands else "ls"
            tip = tips.get(key, "Try [cyan]help[/cyan] to see available commands.")
        return "info", "merlin", f"🧙 [bold magenta]Merlin:[/bold magenta] {tip}"

    def _cmd_exit(self, args: List[str]) -> Tuple[str, str, str]:
        return "exit", "exit", "Farewell, adventurer. Your progress has been saved."
