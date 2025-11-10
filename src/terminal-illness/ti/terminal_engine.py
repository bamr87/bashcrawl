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
from .vfs import VirtualFileSystem
from .quests import check_quest_completion, quest_list


class TerminalCompleter(Completer):
    def __init__(self, commands: List[str], vfs: VirtualFileSystem, get_cwd: Callable[[], str]):
        self.commands = commands
        self.vfs = vfs
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
            # also suggest paths for commands that accept paths
            for name in self.vfs.match_paths(self.get_cwd(), prefix):
                yield Completion(name, start_position=-len(prefix))
        else:
            last = parts[-1]
            for name in self.vfs.match_paths(self.get_cwd(), last):
                yield Completion(name, start_position=-len(last))


CommandHandler = Callable[[List[str]], Tuple[str, str, str]]


@dataclass
class CommandSpec:
    name: str
    handler: CommandHandler
    help_text: str


class TerminalEngine:
    def __init__(self, state: GameState, vfs: VirtualFileSystem) -> None:
        self.state = state
        self.vfs = vfs
        self.console = Console()
        self._cwd = state.current_location or "/"
        self._history = InMemoryHistory()
        self._registry: Dict[str, CommandSpec] = {}
        self._register_commands()
        self._session = PromptSession(
            history=self._history,
            completer=TerminalCompleter(self.available_commands, self.vfs, self.cwd),
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
        self._register("touch", self._cmd_touch, "Create empty file or update timestamp")
        self._register("cat", self._cmd_cat, "Print file contents")
        self._register("grep", self._cmd_grep, "Search for text in a file")
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
            except Exception as exc:  # Keep game resilient
                self._print("error", f"{type(exc).__name__}: {exc}")

    # Rendering helpers
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
        subtitle = (
            f"Player: {self.state.player_name or 'Anonymous'}  |  Mode: {self.state.mode}  |  XP: {self.state.experience_points}"
        )
        self.console.print(
            Panel(
                "[bold magenta]Terminal Illness[/] — Learn through spells and quests!",
                subtitle=subtitle,
                border_style="magenta",
            )
        )

    def _render_quest_bar(self) -> None:
        quests = quest_list()
        stats = f"XP: {self.state.experience_points} • Completed: {len(self.state.completed_quest_ids)} • Mode: {self.state.mode}"
        if self.state.current_quest_id >= len(quests):
            body = "All classic quests complete! Free roving…"
        else:
            q = quests[self.state.current_quest_id]
            body = f"[bold]{q.title}[/]\n{q.objective}"
        bar = Panel(body, title=f"Active Quest", subtitle=stats, border_style="blue")
        self.console.print(bar)

    def _maybe_advance_quest(self) -> None:
        if check_quest_completion(self.state, self._cwd):
            q = quest_list()[self.state.current_quest_id]
            self.state.completed_quest_ids.append(q.id)
            self.state.current_quest_id += 1
            self.state.experience_points += 100 if "100" in q.reward else 50
            self._print("magic", f"Quest complete: {q.title}! Reward: {q.reward}")
            self.state.save()

    # Command implementations
    def _cmd_help(self, args: List[str]) -> Tuple[str, str, str]:
        lines = ["Spells Known:"]
        for name in self.available_commands:
            lines.append(f"- {name}: {self._registry[name].help_text}")
        return "info", "help", "\n".join(lines)

    def _cmd_pwd(self, args: List[str]) -> Tuple[str, str, str]:
        return "output", "pwd", self._cwd

    def _cmd_ls(self, args: List[str]) -> Tuple[str, str, str]:
        path = args[0] if args else None
        items = self.vfs.ls(self._cwd, path)
        return "output", "ls", "\n".join(items)

    def _cmd_cd(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("cd requires a path")
        new_cwd = self.vfs.cd(self._cwd, args[0])
        self._cwd = new_cwd
        self.state.current_location = new_cwd
        return "success", "cd", f"Moved to {new_cwd}"

    def _cmd_mkdir(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("mkdir requires a directory name")
        target = args[0] if args[0].startswith("/") else f"{self._cwd}/{args[0]}"
        self.vfs.mkdir(target)
        return "success", "mkdir", f"Created {target}"

    def _cmd_touch(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("touch requires a file name")
        target = args[0] if args[0].startswith("/") else f"{self._cwd}/{args[0]}"
        self.vfs.touch(target)
        return "success", "touch", f"Touched {target}"

    def _cmd_cat(self, args: List[str]) -> Tuple[str, str, str]:
        if not args:
            raise ValueError("cat requires a file path")
        content = self.vfs.read_file(self._cwd, args[0])
        if content:
            return "output", "cat", content
        return "info", "cat", "(empty file)"

    def _cmd_grep(self, args: List[str]) -> Tuple[str, str, str]:
        if len(args) < 2:
            raise ValueError("grep requires a pattern and a file path")
        pattern, file_path = args[0], args[1]
        text = self.vfs.read_file(self._cwd, file_path)
        lines = [line for line in text.splitlines() if pattern in line]
        return ("output", "grep", "\n".join(lines) if lines else "")

    def _cmd_save(self, args: List[str]) -> Tuple[str, str, str]:
        self.state.save()
        return "success", "save", "Progress saved."

    def _cmd_load(self, args: List[str]) -> Tuple[str, str, str]:
        loaded = GameState.load()
        self.state.current_quest_id = loaded.current_quest_id
        self.state.completed_quest_ids = loaded.completed_quest_ids
        self.state.learned_commands = loaded.learned_commands
        self.state.current_location = loaded.current_location
        self._cwd = loaded.current_location
        self.state.experience_points = loaded.experience_points
        return "success", "load", "Progress loaded."

    def _cmd_merlin(self, args: List[str]) -> Tuple[str, str, str]:
        # Contextual nudge based on current quest
        quests = quest_list()
        if self.state.current_quest_id >= len(quests):
            tip = "Explore freely. Try 'ls', 'cd', 'cat', 'grep'."
        else:
            q = quests[self.state.current_quest_id]
            tips = {
                "pwd": "Type 'pwd' and press Enter to reveal your current location.",
                "ls": "Use 'ls' to list items here. Try 'ls /forest'.",
                "cd": "Travel with 'cd path', e.g., 'cd /home/hero'.",
                "mkdir": "Conjure a place with 'mkdir name' while at the desired location.",
                "touch": "Create a file with 'touch notes.txt'.",
                "cat": "Reveal contents with 'cat file.txt'.",
                "grep": "Seek words in a file: grep word file.txt",
            }
            key = q.required_commands[0] if q.required_commands else "ls"
            tip = tips.get(key, "Try 'help' to see known spells.")
        return "info", "merlin", f"Merlin: {tip}"

    def _cmd_exit(self, args: List[str]) -> Tuple[str, str, str]:
        return "exit", "exit", "Farewell, adventurer. Your progress has been saved."

