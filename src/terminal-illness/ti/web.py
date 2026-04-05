"""Serve the Bashcrawl Textual TUI in a web browser via textual-serve.

Usage
-----
    python -m ti.web                        # default: localhost:8080
    python -m ti.web --host 0.0.0.0         # bind to all interfaces
    python -m ti.web --port 9000            # custom port
    python -m ti.web --game-root /path/to   # explicit game root
"""

from __future__ import annotations

import sys
import shlex
from pathlib import Path
from typing import Any

from aiohttp import web
import aiohttp_jinja2


def _build_command(game_root: str | None = None) -> str:
    """Build the shell command that textual-serve will spawn per connection."""
    cmd = "python3 -m ti"
    if game_root:
        cmd += f" --game-root {shlex.quote(game_root)}"
    return cmd


def _textual_serve_package_root() -> Path:
    import textual_serve.server as textual_serve_server

    return Path(textual_serve_server.__file__).resolve().parent


def _make_bashcrawl_server_class() -> type:
    from textual_serve.server import Server, to_int

    class _BashcrawlTextualServeServerImpl(Server):
        def __init__(
            self,
            command: str,
            host: str = "localhost",
            port: int = 8000,
            title: str | None = None,
            public_url: str | None = None,
            *,
            inject_automation_css: bool = False,
        ) -> None:
            super().__init__(command, host, port, title, public_url, "./static", "./templates")
            pkg = _textual_serve_package_root()
            self.statics_path = pkg / "static"
            self.templates_path = Path(__file__).resolve().parent / "web_templates"
            self._inject_automation_css = inject_automation_css

        @aiohttp_jinja2.template("app_index.html")
        async def handle_index(self, request: web.Request) -> dict[str, Any]:
            router = request.app.router
            font_size = to_int(request.query.get("fontsize", "16"), 16)

            def get_url(route: str, **args: Any) -> str:
                path = router[route].url_for(**args)
                return f"{self.public_url}{path}"

            def get_websocket_url(route: str, **args: Any) -> str:
                url = get_url(route, **args)
                if self.public_url.startswith("https"):
                    return "wss:" + url.split(":", 1)[1]
                return "ws:" + url.split(":", 1)[1]

            context: dict[str, Any] = {
                "font_size": font_size,
                "app_websocket_url": get_websocket_url("websocket"),
                "inject_automation_css": self._inject_automation_css,
            }
            context["config"] = {
                "static": {
                    "url": get_url("static", filename="/").rstrip("/") + "/",
                },
            }
            context["application"] = {"name": self.title}
            return context

    return _BashcrawlTextualServeServerImpl


def serve(
    host: str = "0.0.0.0",
    port: int = 8080,
    game_root: str | None = None,
    debug: bool = False,
    automation: bool = False,
) -> None:
    """Start the textual-serve web server."""
    import os

    try:
        from textual_serve.server import Server as _ServerCheck  # noqa: F401
    except ImportError:
        print(
            "Error: textual-serve is not installed.\n"
            "Install it with: pip install textual-serve",
            file=sys.stderr,
        )
        sys.exit(1)

    # Each subprocess spawned by textual-serve inherits this env var,
    # triggering per-session save file isolation via PID-based session IDs.
    os.environ["BASHCRAWL_WEB_MODE"] = "1"
    if automation:
        os.environ["BASHCRAWL_BROWSER_AUTOMATION"] = "1"

    command = _build_command(game_root)

    ServerCls = _make_bashcrawl_server_class()
    server = ServerCls(
        command=command,
        host=host,
        port=port,
        title="Bashcrawl — Terminal Dungeon",
        inject_automation_css=automation,
    )

    print(f"Serving Bashcrawl TUI at http://{host}:{port}")
    print("Each browser tab gets its own game session.")
    print("Press Ctrl+C to stop.\n")

    server.serve(debug=debug)


def main() -> None:
    """CLI entry point with argument parsing."""
    args = sys.argv[1:]

    host = "0.0.0.0"
    port = 8080
    game_root: str | None = None
    debug = False
    automation = False

    i = 0
    while i < len(args):
        if args[i] == "--host" and i + 1 < len(args):
            host = args[i + 1]
            i += 2
        elif args[i] == "--port" and i + 1 < len(args):
            port = int(args[i + 1])
            i += 2
        elif args[i] == "--game-root" and i + 1 < len(args):
            game_root = args[i + 1]
            i += 2
        elif args[i] == "--debug":
            debug = True
            i += 1
        elif args[i] == "--automation":
            automation = True
            i += 1
        else:
            print(f"Unknown argument: {args[i]}", file=sys.stderr)
            sys.exit(1)

    serve(host=host, port=port, game_root=game_root, debug=debug, automation=automation)


if __name__ == "__main__":
    main()
