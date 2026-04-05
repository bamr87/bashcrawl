# Runtime Architecture

This document defines ownership boundaries for Bashcrawl runtime layers so features can evolve without cross-layer coupling.

## Layer Boundaries

1. **Launcher / orchestration**
   - Owner: `main.sh`
   - Responsibilities:
     - parse CLI arguments
     - choose gameplay mode (classic shell, native, Python TUI/agent)
     - initialize common environment and logging
   - Must not implement gameplay command semantics directly.

2. **Shell gameplay runtime**
   - Owners: `lib/emulator.sh`, `lib/state.sh`, `lib/quests.sh`, `lib/room_loader.sh`
   - Responsibilities:
     - command execution in classic shell mode
     - persistent shell-side state serialization
     - quest progression in bash runtime
   - May consume shared content/registry data, but not depend on Python internals.

3. **Python gameplay runtime**
   - Owners: `src/terminal-illness/ti/terminal_engine.py`, `src/terminal-illness/ti/game_state.py`
   - Responsibilities:
     - command execution for Textual/MCP/agent/web flows
     - persistent Python-side state serialization compatible with shell runtime
   - May consume shared content/registry data, but not source shell runtime internals.

4. **UI/adapters**
   - Owners: `src/terminal-illness/ti/app.py`, `src/terminal-illness/ti/mcp_*.py`, `src/terminal-illness/ti/web.py`, `src/terminal-illness/ti/agent.py`
   - Responsibilities:
     - present or expose runtime behavior
     - route commands to the Python runtime
   - Must not own core game rules/state schema.

5. **Content and data contracts**
   - Owners: `entrance/`, `src/help/data/*.yaml`, `test/datasets/walkthrough.json`, `.bashcrawl_save.json`
   - Responsibilities:
     - world content, metadata, walkthrough and state schema
   - Must remain runtime-agnostic and validated by tooling/tests.

## Dependency Rules

- `main.sh` can invoke shell and Python runtimes.
- Shell and Python runtimes can read shared content/data contracts.
- UI/adapters can call runtime APIs, but should not duplicate game rules.
- Content/data files cannot depend on runtime implementation details.

## Change Policy

When adding a feature:

1. Decide owner layer first.
2. Add tests at that layer boundary.
3. Update shared schemas/contracts when data shape changes.
4. Keep parity checks between shell and Python runtimes where behavior is expected to match.
