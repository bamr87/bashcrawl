"""Non-interactive session runner for the TerminalEngine.

Drives the game engine programmatically without prompt_toolkit REPL,
enabling AI agents and test scripts to play through the game.
"""

from __future__ import annotations

import logging
import re
import shlex
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from ti.filesystem import GameFileSystem
from ti.game_state import GameState
from ti.quests import check_quest_completion, quest_list

try:
    from ai import live_logger as _live
except ImportError:
    _live = None  # type: ignore[assignment]

# Import log capture if available (optional dependency)
try:
    from fixtures.log_capture import TestLogCapture
except ImportError:
    TestLogCapture = None  # type: ignore[misc,assignment]

try:
    from fixtures.screenshot_capture import ScreenshotCapture
except ImportError:
    ScreenshotCapture = None  # type: ignore[misc,assignment]

logger = logging.getLogger(__name__)


@dataclass
class CommandResult:
    """Result of executing a single command."""

    command: str
    output: str
    kind: str  # success, error, output, info, magic, exit
    location: str
    inventory: str
    hp: int
    quest_completed: Optional[str] = None


@dataclass
class SessionResult:
    """Result of a complete non-interactive session."""

    commands: list[CommandResult] = field(default_factory=list)
    total_turns: int = 0
    final_location: str = ""
    final_inventory: str = ""
    final_hp: int = 0
    quests_completed: list[str] = field(default_factory=list)
    rooms_visited: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    exit_reason: str = ""
    screenshot_paths: list[str] = field(default_factory=list)
    feedback: dict = field(default_factory=dict)  # AI-provided end-of-session review

    @property
    def success(self) -> bool:
        return self.exit_reason in ("exit", "max_commands", "source_exhausted", "timeout")


class NonInteractiveEngine:
    """Drives a TerminalEngine without prompt_toolkit.

    Provides:
    - ``execute_command(cmd)`` — run one command and return output
    - ``run_session(source, max_commands)`` — loop with a command source

    The command source is a callable: ``f(output: str) -> str`` that
    receives the previous command's output and returns the next command.
    This is the interface the AI TestAgent implements.
    """

    def __init__(
        self,
        game_root: Path,
        state: GameState | None = None,
        initial_env: dict[str, str] | None = None,
        log_capture: "TestLogCapture | None" = None,
        screenshot_capture: "ScreenshotCapture | None" = None,
    ) -> None:
        self.fs = GameFileSystem(game_root)
        self.state = state or GameState()
        self._cwd = self.state.current_location or "/entrance"
        self._rooms_visited: list[str] = []
        self._log_capture = log_capture
        self._screenshot_capture = screenshot_capture

        # Apply initial environment
        if initial_env:
            for key, val in initial_env.items():
                self.state.set_env(key, val)

        # Build command dispatch table
        self._handlers: dict[str, Callable] = {
            "pwd": self._cmd_pwd,
            "ls": self._cmd_ls,
            "cd": self._cmd_cd,
            "cat": self._cmd_cat,
            "mkdir": self._cmd_mkdir,
            "touch": self._cmd_touch,
            "grep": self._cmd_grep,
            "rm": self._cmd_rm,
            "cp": self._cmd_cp,
            "mv": self._cmd_mv,
            "export": self._cmd_export,
            "echo": self._cmd_echo,
            "help": self._cmd_help,
            "save": self._cmd_save,
            "exit": self._cmd_exit,
            "sort": self._cmd_sort,
            "head": self._cmd_head,
            "tail": self._cmd_tail,
            "wc": self._cmd_wc,
            "find": self._cmd_find,
            "ln": self._cmd_ln,
            "alias": self._cmd_alias,
            "history": self._cmd_history,
        }

        self._track_room()

    @property
    def cwd(self) -> str:
        return self._cwd

    @property
    def rooms_visited(self) -> list[str]:
        return list(self._rooms_visited)

    def _track_room(self) -> None:
        """Track current room in visited list and emit log event."""
        room = self._cwd.lstrip("/").replace("entrance/", "").replace("entrance", "entrance")
        if not room:
            room = "entrance"
        if not self._rooms_visited or self._rooms_visited[-1] != room:
            self._rooms_visited.append(room)
            if self._log_capture:
                self._log_capture.log_event("room_enter", room=room)

    def execute_command(self, cmd: str) -> CommandResult:
        """Execute a single command and return the result.

        This is the core method that the AI agent and test harness use
        to interact with the game.
        """
        cmd = cmd.strip()
        if not cmd:
            return CommandResult(
                command="",
                output="",
                kind="info",
                location=self._cwd,
                inventory=self.state.inventory,
                hp=self.state.hp,
            )

        self.state.log("command", cmd)
        try:
            parts = shlex.split(cmd)
        except ValueError:
            # Fallback for unmatched quotes etc.
            parts = cmd.split()
        base_cmd = parts[0]
        args = parts[1:]

        # Handle executable scripts (./treasure, ./potion, etc.)
        if base_cmd.startswith("./"):
            return self._run_script(base_cmd[2:], args)

        # Handle y/n responses (for interactive script prompts)
        if base_cmd in ("y", "n", "yes", "no"):
            return CommandResult(
                command=cmd,
                output=f"(response: {base_cmd})",
                kind="info",
                location=self._cwd,
                inventory=self.state.inventory,
                hp=self.state.hp,
            )

        # Handle let (arithmetic)
        if base_cmd == "let":
            kind, output = self._cmd_let(args)
            return CommandResult(
                command=cmd,
                output=output,
                kind=kind,
                location=self._cwd,
                inventory=self.state.inventory,
                hp=self.state.hp,
            )

        handler = self._handlers.get(base_cmd)
        if not handler:
            return CommandResult(
                command=cmd,
                output=f"Unknown command: {base_cmd}. Try 'help'.",
                kind="error",
                location=self._cwd,
                inventory=self.state.inventory,
                hp=self.state.hp,
            )

        try:
            kind, output = handler(args)
        except Exception as e:
            kind, output = "error", f"{type(e).__name__}: {e}"

        # Track learned commands
        if base_cmd not in self.state.learned_commands and kind != "error":
            self.state.learned_commands.append(base_cmd)

        # Check quest completion
        quest_name = None
        if check_quest_completion(self.state, self._cwd):
            quests = quest_list()
            if self.state.current_quest_id < len(quests):
                q = quests[self.state.current_quest_id]
                quest_name = q.title
                self.state.completed_quest_ids.append(q.id)
                self.state.current_quest_id += 1
                self.state.experience_points += q.xp
                output += f"\n✨ Quest complete: {q.title}! Reward: {q.reward}"

        result = CommandResult(
            command=cmd,
            output=output,
            kind=kind,
            location=self._cwd,
            inventory=self.state.inventory,
            hp=self.state.hp,
            quest_completed=quest_name,
        )

        self.state.log(kind, output[:500])

        # Emit JSONL log events
        if self._log_capture:
            room = self._cwd.lstrip("/")
            self._log_capture.log_command(cmd, output=output[:200], room=room)
            if quest_name:
                self._log_capture.log_event("encounter", type="quest", quest=quest_name, room=room)

        return result

    def run_session(
        self,
        command_source: Callable[[str], str],
        max_commands: int = 100,
        max_elapsed_seconds: float | None = None,
        on_command: Callable[[CommandResult], None] | None = None,
        feedback_agent: Any | None = None,
    ) -> SessionResult:
        """Run a complete session with a command source.

        Args:
            command_source: Callable that receives previous output and returns
                the next command. This is typically ``agent.next_command``.
            max_commands: Maximum number of commands to execute.
            max_elapsed_seconds: Optional hard wall-clock limit in seconds.
                When exceeded the session stops cleanly with exit_reason
                ``'timeout'``. Defaults to no limit.
            on_command: Optional callback invoked after each command.
            feedback_agent: Optional agent instance whose ``request_feedback()``
                method is called at session end to gather improvement notes.

        Returns:
            SessionResult with full session data.
        """
        session = SessionResult()
        last_output = self._get_initial_output()
        session_start = time.monotonic()

        # Emit live session_start event
        if _live and feedback_agent is not None:
            goal = getattr(feedback_agent, "goal", "")
            max_t = getattr(feedback_agent, "max_turns", max_commands)
            max_e = getattr(feedback_agent, "max_elapsed_seconds", max_elapsed_seconds or 0)
            test_name = getattr(feedback_agent, "_test_name", "unknown")
            _live.session_start(
                test_name=test_name,
                goal=goal,
                max_turns=max_t,
                max_elapsed=max_e,
            )

        for i in range(max_commands):
            # Wall-clock guard (separate from agent-internal timeout)
            if max_elapsed_seconds is not None:
                elapsed = time.monotonic() - session_start
                if elapsed >= max_elapsed_seconds:
                    logger.warning(
                        "run_session: wall-clock limit hit (%.1fs >= %.1fs)",
                        elapsed, max_elapsed_seconds,
                    )
                    session.exit_reason = "timeout"
                    break

            try:
                cmd = command_source(last_output)
            except Exception as e:
                # AgentTimeout / AgentExhausted both land here
                err_kind = type(e).__name__
                session.exit_reason = f"source_error:{err_kind}: {e}"
                session.errors.append(str(e))
                logger.info("Session ended by source: %s", e)
                break

            if not cmd or cmd.lower() in ("exit", "quit"):
                session.exit_reason = "exit"
                break

            result = self.execute_command(cmd)
            session.commands.append(result)
            session.total_turns = i + 1

            # Emit live command event
            if _live:
                _live.command(
                    turn=i,
                    cmd=cmd,
                    output=result.output,
                    location=result.location,
                    inventory=result.inventory,
                    hp=result.hp,
                )

            if result.quest_completed:
                session.quests_completed.append(result.quest_completed)

            if on_command:
                on_command(result)

            last_output = result.output

            if result.kind == "exit":
                session.exit_reason = "exit"
                break
        else:
            session.exit_reason = "max_commands"

        session.final_location = self._cwd
        session.final_inventory = self.state.inventory
        session.final_hp = self.state.hp
        session.rooms_visited = list(self._rooms_visited)

        # Emit live session_end event
        if _live:
            elapsed_total = time.monotonic() - session_start
            _live.session_end(
                exit_reason=session.exit_reason,
                total_turns=session.total_turns,
                rooms_visited=session.rooms_visited,
                final_location=session.final_location,
                final_inventory=session.final_inventory,
                final_hp=session.final_hp,
                elapsed=elapsed_total,
)

        # Collect screenshot paths if capture was active
        if self._screenshot_capture:
            session.screenshot_paths = [
                str(p) for p in self._screenshot_capture.screenshots
            ]

        # Request AI feedback at session end
        if feedback_agent is not None and hasattr(feedback_agent, "request_feedback"):
            try:
                feedback = feedback_agent.request_feedback(
                    rooms_visited=session.rooms_visited,
                    commands_used=getattr(feedback_agent, "commands_used", None),
                )
                session.feedback = feedback
                logger.info(
                    "Session feedback collected: rating=%s",
                    feedback.get("rating", "?"),
                )
            except Exception as exc:
                logger.warning("Could not collect agent feedback: %s", exc)
                session.feedback = {"raw": f"(error: {exc})"}

        return session

    def _get_initial_output(self) -> str:
        """Generate initial context for the AI agent."""
        entries = self.fs.ls(self._cwd)
        return (
            f"You are in {self._cwd}.\n"
            f"Contents: {', '.join(entries)}\n"
            f"Inventory: {self.state.inventory or 'empty'}\n"
            f"HP: {self.state.hp}\n"
            "Use 'cat scroll' to read the scroll, 'ls' to look around, "
            "'cd <dir>' to move."
        )

    # ------------------------------------------------------------------
    # Command implementations (simplified, return (kind, output))
    # ------------------------------------------------------------------

    def _cmd_pwd(self, args: list[str]) -> tuple[str, str]:
        return "output", self._cwd

    def _cmd_ls(self, args: list[str]) -> tuple[str, str]:
        path = args[0] if args else ""
        show_hidden = "-a" in args or "-la" in args or "-al" in args
        if show_hidden and path in ("-a", "-la", "-al"):
            path = ""
        if show_hidden and len(args) > 1:
            path = [a for a in args if not a.startswith("-")]
            path = path[0] if path else ""

        items = self.fs.ls(self._cwd, path)
        if show_hidden:
            # GameFileSystem.ls already shows hidden files
            pass
        return "output", "  ".join(items) if items else "(empty)"

    def _cmd_cd(self, args: list[str]) -> tuple[str, str]:
        if not args:
            return "error", "cd requires a path"
        try:
            new_cwd = self.fs.cd(self._cwd, args[0])
            self._cwd = new_cwd
            self.state.current_location = new_cwd
            self._track_room()
            # Auto-show room contents
            entries = self.fs.ls(self._cwd)
            return "success", f"Moved to {new_cwd}\nContents: {', '.join(entries)}"
        except (NotADirectoryError, FileNotFoundError, PermissionError) as e:
            return "error", str(e)

    def _cmd_cat(self, args: list[str]) -> tuple[str, str]:
        if not args:
            return "error", "cat requires a file path"
        try:
            content = self.fs.read_file(self._cwd, args[0])
            return "output", content if content else "(empty file)"
        except FileNotFoundError as e:
            return "error", str(e)

    def _cmd_mkdir(self, args: list[str]) -> tuple[str, str]:
        if not args:
            return "error", "mkdir requires a directory name"
        self.fs.mkdir(self._cwd, args[0])
        return "success", f"Created {args[0]}"

    def _cmd_touch(self, args: list[str]) -> tuple[str, str]:
        if not args:
            return "error", "touch requires a file name"
        self.fs.touch(self._cwd, args[0])
        return "success", f"Touched {args[0]}"

    def _cmd_grep(self, args: list[str]) -> tuple[str, str]:
        if len(args) < 2:
            return "error", "grep requires a pattern and a file"
        # Parse flags
        flags = []
        positional = []
        for a in args:
            if a.startswith("-"):
                flags.append(a)
            else:
                positional.append(a)
        if len(positional) < 2:
            return "error", "grep requires a pattern and a file"
        pattern, filepath = positional[0], positional[1]
        quiet = "--quiet" in flags or "-q" in flags
        only_matching = "--only-matching" in flags or "-o" in flags
        try:
            text = self.fs.read_file(self._cwd, filepath)
            matches = [l for l in text.splitlines() if pattern in l]
            if quiet:
                return "output", ""  # just return empty (exit code indicates match)
            if only_matching:
                return "output", pattern if matches else f"(no matches for '{pattern}')"
            return "output", "\n".join(matches) if matches else f"(no matches for '{pattern}')"
        except FileNotFoundError as e:
            return "error", str(e)

    def _cmd_rm(self, args: list[str]) -> tuple[str, str]:
        if not args:
            return "error", "rm requires a file path"
        self.fs.rm(self._cwd, args[0])
        return "success", f"Removed {args[0]}"

    def _cmd_cp(self, args: list[str]) -> tuple[str, str]:
        if len(args) < 2:
            return "error", "cp requires source and destination"
        self.fs.cp(self._cwd, args[0], args[1])
        return "success", f"Copied {args[0]} → {args[1]}"

    def _cmd_mv(self, args: list[str]) -> tuple[str, str]:
        if len(args) < 2:
            return "error", "mv requires source and destination"
        self.fs.mv(self._cwd, args[0], args[1])
        return "success", f"Moved {args[0]} → {args[1]}"

    def _cmd_export(self, args: list[str]) -> tuple[str, str]:
        if not args:
            return "error", "export requires VAR=value"
        assignment = " ".join(args)
        if "=" not in assignment:
            return "error", "Usage: export VAR=value"
        key, value = assignment.split("=", 1)
        key = key.strip()
        value = value.strip()
        # Expand variable references (e.g. $I, $HP) before storing
        value = value.replace("$I", self.state.inventory)
        value = value.replace("$HP", str(self.state.hp))
        for var, val in self.state.env_vars.items():
            value = value.replace(f"${var}", val)
        self.state.set_env(key, value)
        return "success", f"Exported {key}={value}"

    def _cmd_echo(self, args: list[str]) -> tuple[str, str]:
        text = " ".join(args)
        replacements = {
            "$I": self.state.inventory,
            "$HP": str(self.state.hp),
            "$PWD": self._cwd,
        }
        for var, val in replacements.items():
            text = text.replace(var, val)
        for key, val in self.state.env_vars.items():
            text = text.replace(f"${key}", val)
        return "output", text

    def _cmd_help(self, args: list[str]) -> tuple[str, str]:
        commands = sorted(self._handlers.keys())
        lines = ["Available commands: " + ", ".join(commands)]
        lines.append("Run game scripts with: ./treasure, ./potion, etc.")
        return "info", "\n".join(lines)

    def _cmd_save(self, args: list[str]) -> tuple[str, str]:
        self.state.save()
        return "success", "Progress saved."

    def _cmd_exit(self, args: list[str]) -> tuple[str, str]:
        return "exit", "Goodbye!"

    def _cmd_sort(self, args: list[str]) -> tuple[str, str]:
        """Sort lines in a file."""
        if not args:
            return "error", "sort requires a file path"
        # Handle flags: -r (reverse), -n (numeric), -t (delimiter), -k (key)
        reverse = False
        numeric = False
        delimiter = None
        key_field = None
        files = []
        i = 0
        while i < len(args):
            if args[i] == "-r":
                reverse = True
            elif args[i] == "-n":
                numeric = True
            elif args[i] == "-t" and i + 1 < len(args):
                i += 1
                delimiter = args[i]
            elif args[i] == "-k" and i + 1 < len(args):
                i += 1
                try:
                    key_field = int(args[i].split(",")[0]) - 1  # 1-indexed to 0-indexed
                except ValueError:
                    pass
            elif not args[i].startswith("-"):
                files.append(args[i])
            i += 1
        if not files:
            return "error", "sort requires a file path"
        try:
            text = self.fs.read_file(self._cwd, files[0])
            lines = text.strip().splitlines()
            if delimiter and key_field is not None:
                def sort_key(line):
                    parts = line.split(delimiter)
                    if key_field < len(parts):
                        val = parts[key_field].strip()
                        if numeric:
                            try:
                                return (0, int(val))
                            except ValueError:
                                return (1, val)
                        return val
                    return line
                lines.sort(key=sort_key, reverse=reverse)
            elif numeric:
                def num_key(line):
                    try:
                        return (0, int(line.strip()))
                    except ValueError:
                        return (1, line)
                lines.sort(key=num_key, reverse=reverse)
            else:
                lines.sort(reverse=reverse)
            return "output", "\n".join(lines)
        except FileNotFoundError as e:
            return "error", str(e)

    def _cmd_head(self, args: list[str]) -> tuple[str, str]:
        """Display first N lines of a file (default 10)."""
        n = 10
        files = []
        i = 0
        while i < len(args):
            if args[i] == "-n" and i + 1 < len(args):
                i += 1
                try:
                    n = int(args[i])
                except ValueError:
                    pass
            elif args[i].startswith("-") and args[i][1:].isdigit():
                n = int(args[i][1:])
            elif not args[i].startswith("-"):
                files.append(args[i])
            i += 1
        if not files:
            return "error", "head requires a file path"
        try:
            text = self.fs.read_file(self._cwd, files[0])
            lines = text.splitlines()[:n]
            return "output", "\n".join(lines)
        except FileNotFoundError as e:
            return "error", str(e)

    def _cmd_tail(self, args: list[str]) -> tuple[str, str]:
        """Display last N lines of a file (default 10)."""
        n = 10
        files = []
        i = 0
        while i < len(args):
            if args[i] == "-n" and i + 1 < len(args):
                i += 1
                try:
                    n = int(args[i])
                except ValueError:
                    pass
            elif args[i].startswith("-") and args[i][1:].isdigit():
                n = int(args[i][1:])
            elif not args[i].startswith("-"):
                files.append(args[i])
            i += 1
        if not files:
            return "error", "tail requires a file path"
        try:
            text = self.fs.read_file(self._cwd, files[0])
            lines = text.splitlines()[-n:]
            return "output", "\n".join(lines)
        except FileNotFoundError as e:
            return "error", str(e)

    def _cmd_wc(self, args: list[str]) -> tuple[str, str]:
        """Count lines, words, and characters in a file."""
        if not args:
            return "error", "wc requires a file path"
        filepath = [a for a in args if not a.startswith("-")]
        if not filepath:
            return "error", "wc requires a file path"
        try:
            text = self.fs.read_file(self._cwd, filepath[0])
            lines = text.count("\n")
            words = len(text.split())
            chars = len(text)
            return "output", f"  {lines}  {words}  {chars} {filepath[0]}"
        except FileNotFoundError as e:
            return "error", str(e)

    def _cmd_find(self, args: list[str]) -> tuple[str, str]:
        """Simplified find command — lists files in current directory tree."""
        # Simplified: just list files recursively from cwd
        path = "." if not args or args[0].startswith("-") else args[0]
        entries = self.fs.ls(self._cwd, path)
        return "output", "\n".join(f"./{e}" for e in entries) if entries else "(no files found)"

    def _cmd_ln(self, args: list[str]) -> tuple[str, str]:
        """Handle ln -s (symbolic link creation)."""
        if "-s" not in args:
            return "info", "Usage: ln -s <target> <link_name>"
        real_args = [a for a in args if a != "-s"]
        if len(real_args) < 2:
            return "error", "ln -s requires target and link name"
        # In the game engine, symlinks are simulated
        return "success", f"Symlink created: {real_args[1]} -> {real_args[0]}"

    def _cmd_alias(self, args: list[str]) -> tuple[str, str]:
        """Handle alias command (informational only in the engine)."""
        if not args:
            return "output", "(no aliases defined)"
        return "success", f"Alias set: {' '.join(args)}"

    def _cmd_history(self, args: list[str]) -> tuple[str, str]:
        """Show command history."""
        history = []
        for i, turn in enumerate(self._rooms_visited):
            history.append(f"  {i+1}  (visited {turn})")
        return "output", "\n".join(history[-20:]) if history else "(no history)"

    def _cmd_let(self, args: list[str]) -> tuple[str, str]:
        """Handle 'let' arithmetic expressions."""
        if not args:
            return "error", "let requires an expression"
        expr = " ".join(args).strip('"').strip("'")
        # Parse simple assignment: HP=HP-5
        match = re.match(r"(\w+)=(.+)", expr)
        if match:
            var_name = match.group(1)
            rhs = match.group(2)
            # Replace variable references with values
            rhs = rhs.replace("HP", str(self.state.hp))
            rhs = rhs.replace("I", f'"{self.state.inventory}"')
            try:
                result = eval(rhs)  # Safe enough for simple arithmetic
                self.state.set_env(var_name, str(int(result)))
                return "success", f"{var_name}={int(result)}"
            except Exception as e:
                return "error", f"Arithmetic error: {e}"
        return "error", f"Cannot parse: {expr}"

    # ------------------------------------------------------------------
    # Script execution
    # ------------------------------------------------------------------

    def _run_script(self, script: str, args: list[str]) -> CommandResult:
        """Execute a bash game script via subprocess."""
        try:
            output, exit_code, _ = self.fs.run_script(
                self._cwd, script, env_vars=self.state.game_env,
            )

            # Parse export instructions from script output
            self._parse_export_instructions(output)

            # Emit encounter log events
            if self._log_capture:
                room = self._cwd.lstrip("/")
                script_type = script  # treasure, potion, statue, etc.
                self._log_capture.log_event(
                    "encounter",
                    type=script_type,
                    room=room,
                    exit_code=exit_code,
                    output_preview=output[:200] if output else "",
                )

            return CommandResult(
                command=f"./{script}",
                output=output.rstrip() if output else "(no output)",
                kind="output" if exit_code == 0 else "error",
                location=self._cwd,
                inventory=self.state.inventory,
                hp=self.state.hp,
            )
        except (FileNotFoundError, PermissionError) as e:
            return CommandResult(
                command=f"./{script}",
                output=str(e),
                kind="error",
                location=self._cwd,
                inventory=self.state.inventory,
                hp=self.state.hp,
            )

    def _parse_export_instructions(self, output: str) -> None:
        """Detect 'export VAR=value' instructions in script output.

        Scripts tell the player to run export commands. We auto-detect
        these instructions so the AI agent doesn't have to.
        Note: We don't auto-apply them — the agent must still run export.
        But we log them so tests can verify the agent follows instructions.
        """
        # Just log detected instructions — don't auto-apply
        for match in re.finditer(r"export\s+(\w+)=([^\s]+)", output):
            key, value = match.group(1), match.group(2)
            logger.debug("Script suggests: export %s=%s", key, value)
