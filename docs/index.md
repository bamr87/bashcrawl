# Bashcrawl Documentation

Learn terminal commands by exploring a fantasy dungeon. Directories are rooms, files are scrolls, and executables are encounters.

## Contents

- [Getting Started](getting-started.md) — Installation, setup, and your first game
- [Gameplay Guide](gameplay.md) — Mechanics, rooms, inventory, combat, and progression
- [Complete Walkthrough](walkthrough.md) — Every path, puzzle, and command in the dungeon
- [Advanced Topics](advanced.md) — Hidden areas, scripting encounters, and scroll standards
- [Contributing](contributing.md) — How to add rooms, write scrolls, and submit changes
- [Improvement Plan](improvement-plan.md) — Known issues and planned enhancements
- [TermForge Architecture](termforge/architecture.md) — The universal terminal framework under the web game
- [Authoring TermForge Apps](termforge/authoring-apps.md) — Build your own terminal tools on the framework
- [Telnet Host](termforge/telnet-host.md) — Serve the game or your tools over lightweight telnet/TCP

## Quick Start

```bash
git clone https://github.com/bamr87/bashcrawl.git
cd bashcrawl
bash setup.sh
cd entrance && cat scroll
```

Prefer the browser? Run `make web-preview` (or open `web/index.html`) to play the static web trainer.
