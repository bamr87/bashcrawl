from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

from prompt_toolkit import PromptSession
from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.history import InMemoryHistory
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .game_state import GameState
from .filesystem import GameFileSystem
from .quests import check_quest_completion, quest_list


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


class TerminalEngine:
    def __init__(self, state: GameState, fs: GameFileSystem) -> None:
        self.state = state
        self.fs = fs
        self.console = Console()
        self._cwd = state.current_location or "/entrance"
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

    def _register(self, name: str, handler: CommandHandler, help_text: str) -> None:
        self._registry[name] = CommandSpec(name=name, handler=handler, help_text=help_text)

    def _register_commands(self) -> None:
        self._register("help", self._cmd_help, "Show available commands")
        self._register("pwd", self._cmd_pwd, "Print working directory")
        self._register("ls", self._cmd_ls, "List directory contents")
        self._register("cd", self._cmd_cd, "Change directory")
        self._register("mkdir", self._cmd_mkdir, "Create directory")
        self._register("touch", self._cmd_touch, "Create empty file")
        self._register("cat", self._cmd_cat, "Print file contents")
        self._register("grep", self._cmd_grep, "Search for text in a file")
        self._register("rm", self._cmd_rm, "Remove a file")
        self._register("cp", self._cmd_cp, "Copy a file")
        self._register("mv", self._cmd_mv, "Move/rename file or directory")
        self._register("export", self._cmd_export, "Set a game variable")
        self._register("echo", self._cmd_echo, "Print text or variable value")
        self._register("save", self._cmd_save, "Save your progress")
        self._register("load", self._cmd_load, "Load your progress")
        self._register("merlin", self._cmd_merlin, "Ask Merlin for a hint")
        self._register("exit", self._cmd_exit, "Exit the game")

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
            self._print("magic", f"Quest complete: {q.title}! Reward: {q.reward}")
            self.state.save()

    # ------------------------------------------------------------------
    # Game script execution
    # ------------------------------------------------------------------

    def _run_game_script(self, script: str, args: List[str]) -> Tuple[str, str, str]:
        """Execute a bash game script (treasure, potion, statue, etc.)."""
        output, exit_code, _ = self.fs.run_script(
            self._cwd, script, env_vars=self.state.game_env
        )
        return "output", script, output.rstrip() if output else "(no output)"

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
        path = args[0] if args else ""
        items = self.fs.ls(self._cwd, path)
        return "output", "ls", "  ".join(items) if items else "(empty)"

    def _cmd_cd(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("cd requires a path")
        new_cwd = self.fs.cd(self._cwd, args[0])
        self._cwd = new_cwd
        self.state.current_location = new_cwd
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
        self.state.set_env(key.strip(), value.strip())
        return "success", "export", f"Exported {key.strip()}={value.strip()}"

    def _cmd_echo(self, args: List[str]) -> Tuple[str, str, str]:
        """Echo text, expanding $VAR references."""
        text = " ".join(args)
        # Expand known variables
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
        return "output", "echo", text

    def _cmd_save(self, args: List[str]) -> Tuple[str, str, str]:
        self.state.save()
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

