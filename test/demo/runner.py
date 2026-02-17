"""Demo runner — drives the Bashcrawl game via real bash subprocesses.

Captures every command's input/output as structured ``TerminalSnapshot``
objects that can be rendered into documentation.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class TerminalSnapshot:
    """A single captured interaction — one command and its result."""

    command: str
    stdin_input: Optional[str] = None
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    cwd_before: str = ""
    cwd_after: str = ""
    inventory: str = ""
    hp: int = 0
    env_snapshot: dict[str, str] = field(default_factory=dict)
    prompt: str = ""
    duration: float = 0.0


@dataclass
class DemoResult:
    """Complete result of a demo playthrough."""

    snapshots: list[TerminalSnapshot] = field(default_factory=list)
    total_duration: float = 0.0
    rooms_visited: list[str] = field(default_factory=list)
    items_collected: list[str] = field(default_factory=list)
    encounters: list[str] = field(default_factory=list)
    success: bool = True
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


class DemoRunner:
    """Drives game commands via subprocess and captures snapshots.

    Maintains persistent shell state (cwd, env vars) across commands,
    executing each one in a fresh ``subprocess.run`` call with the
    accumulated environment.

    Parameters
    ----------
    game_root
        Path to the sandbox game root (the directory containing
        ``entrance/``, ``main.sh``, etc.).
    """

    def __init__(self, game_root: Path) -> None:
        self.game_root = game_root.resolve()
        self.cwd = self.game_root
        self.env: dict[str, str] = self._build_initial_env()
        self._rooms_visited: list[str] = []
        self._items_collected: list[str] = []
        self._encounters: list[str] = []

    # -- public API --------------------------------------------------------

    def run_step(self, step: "DemoStep") -> TerminalSnapshot:
        """Execute a single ``DemoStep`` and return a snapshot."""
        from demo.script import DemoStep  # noqa: F811 — deferred import

        cwd_before = self._rel(self.cwd)
        prompt = self._format_prompt()
        t0 = time.monotonic()

        cmd = step.command.strip()

        # Dispatch by command type
        if cmd.startswith("cd "):
            snap = self._do_cd(cmd)
        elif cmd.startswith("export "):
            snap = self._do_export(cmd)
        elif cmd.startswith("let "):
            snap = self._do_let(cmd)
        elif cmd.startswith("echo "):
            snap = self._do_echo(cmd)
        elif cmd.startswith("./"):
            snap = self._do_script(cmd, stdin_input=step.stdin_input)
        elif cmd.startswith("ln "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("cp "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("mv "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("touch "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("mkdir "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("rm "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("source "):
            snap = self._do_source(cmd)
        elif cmd.startswith("sort "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("grep "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("find "):
            snap = self._do_subprocess(cmd)
        elif cmd in ("pwd",):
            snap = self._do_subprocess(cmd)
        elif cmd in ("ls", "ls -F", "ls -l", "ls -la", "ls -laF",
                      "ls -lF") or cmd.startswith("ls "):
            snap = self._do_subprocess(cmd)
        elif cmd.startswith("cat "):
            snap = self._do_subprocess(cmd)
        else:
            snap = self._do_subprocess(cmd)

        snap.cwd_before = cwd_before
        snap.cwd_after = self._rel(self.cwd)
        snap.inventory = self.env.get("I", "")
        snap.hp = int(self.env.get("HP", "0") or "0")
        snap.prompt = prompt
        snap.duration = time.monotonic() - t0
        snap.env_snapshot = {
            "I": self.env.get("I", ""),
            "HP": self.env.get("HP", "0"),
        }

        # Sanitize output — replace sandbox paths with clean paths
        snap.stdout = self._sanitize_output(snap.stdout)
        snap.stderr = self._sanitize_output(snap.stderr)

        # Track rooms on cd
        if cmd.startswith("cd "):
            room = self._rel(self.cwd)
            if room and room != "." and room not in self._rooms_visited:
                self._rooms_visited.append(room)

        return snap

    def run_full_demo(self, steps: list["DemoStep"]) -> DemoResult:
        """Execute all steps and return the aggregated result."""
        result = DemoResult()
        t0 = time.monotonic()

        for step in steps:
            try:
                snap = self.run_step(step)
                result.snapshots.append(snap)

                # Check expected output
                for expected in (step.expected_contains or []):
                    if expected not in snap.stdout:
                        result.errors.append(
                            f"Step '{step.command}': expected '{expected}' "
                            f"in output but not found"
                        )
            except Exception as exc:
                result.errors.append(f"Step '{step.command}' failed: {exc}")
                result.snapshots.append(TerminalSnapshot(
                    command=step.command,
                    stderr=str(exc),
                    exit_code=1,
                    cwd_before=self._rel(self.cwd),
                    cwd_after=self._rel(self.cwd),
                ))

        result.total_duration = time.monotonic() - t0
        result.rooms_visited = list(self._rooms_visited)
        result.items_collected = list(self._items_collected)
        result.encounters = list(self._encounters)
        result.success = len(result.errors) == 0
        return result

    # -- command handlers --------------------------------------------------

    def _do_cd(self, cmd: str) -> TerminalSnapshot:
        """Handle ``cd <path>`` by updating internal cwd."""
        target = cmd[3:].strip()
        if target == "..":
            new = self.cwd.parent
        elif target == "~" or target == "":
            new = self.game_root
        elif target.startswith("/"):
            new = Path(target)
        else:
            new = (self.cwd / target).resolve()

        # Prevent navigating above game root
        try:
            new.resolve().relative_to(self.game_root.resolve())
        except ValueError:
            new = self.game_root

        if not new.is_dir():
            return TerminalSnapshot(
                command=cmd,
                stderr=f"bash: cd: {target}: No such file or directory",
                exit_code=1,
            )

        self.cwd = new
        return TerminalSnapshot(command=cmd, exit_code=0)

    def _do_export(self, cmd: str) -> TerminalSnapshot:
        """Handle ``export VAR=value`` by updating internal env."""
        # Parse: export VAR=value
        match = re.match(r'export\s+(\w+)=(.*)$', cmd)
        if not match:
            return TerminalSnapshot(
                command=cmd,
                stderr=f"Could not parse export: {cmd}",
                exit_code=1,
            )

        var = match.group(1)
        raw_value = match.group(2).strip()

        # Handle $() command substitution by running via subprocess
        if "$(" in raw_value:
            env = self._build_subprocess_env()
            try:
                proc = subprocess.run(
                    ["bash", "-c", f"echo {raw_value}"],
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                value = proc.stdout.strip()
            except Exception:
                value = self._expand_vars(raw_value)
        else:
            # Resolve shell variable references like $I, $HP
            value = self._expand_vars(raw_value)
        self.env[var] = value

        # Track inventory changes
        if var == "I":
            for item in value.split(","):
                item = item.strip()
                if item and item not in self._items_collected:
                    self._items_collected.append(item)

        return TerminalSnapshot(command=cmd, exit_code=0)

    def _do_let(self, cmd: str) -> TerminalSnapshot:
        """Handle ``let "EXPR"`` by evaluating arithmetic."""
        # Extract expression: let "HP=HP-5" or let HP=HP-5
        expr = cmd[4:].strip().strip('"').strip("'")
        match = re.match(r'(\w+)=(.+)', expr)
        if not match:
            return TerminalSnapshot(
                command=cmd,
                stderr=f"Could not parse let: {cmd}",
                exit_code=1,
            )

        var = match.group(1)
        rhs = match.group(2)

        # Replace variable references with their values.
        # Sort by name length descending so that longer names (e.g. "HP")
        # are replaced before shorter prefixes (e.g. "H").
        for env_var, env_val in sorted(
            self.env.items(), key=lambda kv: len(kv[0]), reverse=True
        ):
            if env_var in rhs:
                try:
                    rhs = rhs.replace(env_var, str(int(env_val)))
                except (ValueError, TypeError):
                    rhs = rhs.replace(env_var, "0")

        try:
            result = eval(rhs)  # noqa: S307 — simple arithmetic only
            self.env[var] = str(int(result))
        except Exception as exc:
            return TerminalSnapshot(
                command=cmd,
                stderr=f"Arithmetic error: {exc}",
                exit_code=1,
            )

        return TerminalSnapshot(command=cmd, exit_code=0)

    def _do_echo(self, cmd: str) -> TerminalSnapshot:
        """Handle ``echo`` by expanding variables."""
        arg = cmd[5:].strip()
        # Strip surrounding quotes (single or double)
        if len(arg) >= 2 and arg[0] == arg[-1] and arg[0] in ('"', "'"):
            arg = arg[1:-1]
        output = self._expand_vars(arg)
        return TerminalSnapshot(
            command=cmd,
            stdout=output + "\n",
            exit_code=0,
        )

    def _do_source(self, cmd: str) -> TerminalSnapshot:
        """Handle ``source <file>`` — limited support."""
        return TerminalSnapshot(
            command=cmd,
            stdout="(sourced)\n",
            exit_code=0,
        )

    def _do_script(self, cmd: str, stdin_input: str | None = None) -> TerminalSnapshot:
        """Run an executable game script via subprocess."""
        script_name = cmd.lstrip("./").strip()
        script_path = self.cwd / script_name

        if not script_path.is_file():
            return TerminalSnapshot(
                command=cmd,
                stderr=f"bash: {cmd}: No such file or directory",
                exit_code=127,
            )

        # Expand variable references in stdin (e.g., ${USER})
        if stdin_input:
            stdin_input = self._expand_vars(stdin_input)

        env = self._build_subprocess_env()
        try:
            proc = subprocess.run(
                ["bash", str(script_path)],
                cwd=str(self.cwd),
                env=env,
                input=stdin_input,
                capture_output=True,
                text=True,
                timeout=15,
            )
            self._encounters.append(script_name)
            return TerminalSnapshot(
                command=cmd,
                stdin_input=stdin_input,
                stdout=proc.stdout,
                stderr=proc.stderr,
                exit_code=proc.returncode,
            )
        except subprocess.TimeoutExpired:
            return TerminalSnapshot(
                command=cmd,
                stderr="Script timed out after 15 seconds",
                exit_code=124,
            )

    def _do_subprocess(self, cmd: str) -> TerminalSnapshot:
        """Run a generic command via subprocess."""
        env = self._build_subprocess_env()
        try:
            proc = subprocess.run(
                ["bash", "-c", cmd],
                cwd=str(self.cwd),
                env=env,
                capture_output=True,
                text=True,
                timeout=10,
            )
            return TerminalSnapshot(
                command=cmd,
                stdout=proc.stdout,
                stderr=proc.stderr,
                exit_code=proc.returncode,
            )
        except subprocess.TimeoutExpired:
            return TerminalSnapshot(
                command=cmd,
                stderr="Command timed out after 10 seconds",
                exit_code=124,
            )

    # -- helpers -----------------------------------------------------------

    def _build_initial_env(self) -> dict[str, str]:
        """Build the starting environment for the demo."""
        env: dict[str, str] = {}
        env["HOME"] = str(self.game_root)
        env["BASHCRAWL_ROOT"] = str(self.game_root)
        env["PATH"] = os.environ.get("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
        env["SHELL"] = os.environ.get("SHELL", "/bin/bash")
        env["USER"] = os.environ.get("USER", "player")
        env["TERM"] = "xterm-256color"
        env["LANG"] = os.environ.get("LANG", "en_US.UTF-8")
        # Game variables start empty
        env["I"] = ""
        env["HP"] = "0"
        return env

    def _build_subprocess_env(self) -> dict[str, str]:
        """Build env dict for passing to subprocess.run."""
        env = os.environ.copy()
        env.update(self.env)
        return env

    def _format_prompt(self) -> str:
        """Generate a realistic-looking bash prompt."""
        user = self.env.get("USER", "player")
        rel = self._rel(self.cwd)
        if rel == ".":
            path_display = "~"
        else:
            path_display = f"~/{rel}"
        return f"{user}@bashcrawl:{path_display}$ "

    def _rel(self, path: Path) -> str:
        """Return path relative to game_root, or '.' for game_root itself."""
        try:
            return str(path.resolve().relative_to(self.game_root.resolve()))
        except ValueError:
            return str(path)

    def _expand_vars(self, text: str) -> str:
        """Expand ``$VAR`` and ``${VAR}`` references in text."""
        # Handle ${VAR} first
        def _replace_braced(m: re.Match) -> str:
            return self.env.get(m.group(1), "")

        text = re.sub(r'\$\{(\w+)\}', _replace_braced, text)

        # Handle $VAR (but not $$, $?, etc.)
        def _replace_bare(m: re.Match) -> str:
            return self.env.get(m.group(1), "")

        text = re.sub(r'\$([A-Za-z_]\w*)', _replace_bare, text)
        return text

    def _sanitize_output(self, text: str) -> str:
        """Replace sandbox temp paths with clean display paths."""
        if not text:
            return text
        # Replace the full sandbox path with ~/
        sandbox_str = str(self.game_root)
        text = text.replace(sandbox_str, "~")
        # Also handle /private prefix on macOS temp dirs
        if sandbox_str.startswith("/private"):
            text = text.replace(sandbox_str[8:], "~")  # without /private
        elif not sandbox_str.startswith("/private"):
            text = text.replace(f"/private{sandbox_str}", "~")
        return text
