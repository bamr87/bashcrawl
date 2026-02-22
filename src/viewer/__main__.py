"""Launch the Bashcrawl Observatory viewer."""
import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Bashcrawl Observatory — Log & Screenshot Viewer")
    parser.add_argument("--port", type=int, default=5000, help="Port to listen on (default: 5000)")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to (default: 127.0.0.1)")
    parser.add_argument("--game-root", type=str, default=None,
                        help="Path to bashcrawl game root (default: auto-detect)")
    parser.add_argument("--debug", action="store_true", help="Enable Flask debug mode")
    args = parser.parse_args()

    # Auto-detect game root
    game_root = args.game_root
    if game_root is None:
        # Walk up from this file to find the repo root (contains entrance/)
        candidate = Path(__file__).resolve().parent.parent.parent
        if (candidate / "entrance").is_dir():
            game_root = str(candidate)
        else:
            print("Error: Could not auto-detect game root. Use --game-root.", file=sys.stderr)
            sys.exit(1)

    from .app import create_app
    app = create_app(game_root=game_root)
    print(f"\n⚔️  Bashcrawl Observatory")
    print(f"   http://{args.host}:{args.port}/")
    print(f"   Game root: {game_root}\n")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
