# Contributing

## Reporting Issues

Open an issue at [github.com/bamr87/bashcrawl/issues](https://github.com/bamr87/bashcrawl/issues) with steps to reproduce.

## Development Setup

```bash
git clone https://github.com/bamr87/bashcrawl.git
cd bashcrawl
bash setup.sh
python3 -m pip install -e ".[dev]"
```

Canonical local workflow:

```bash
bash scripts/lint.sh all
bash scripts/run_tests.sh default
```

Playtest harness (MCP server for AI agents, plus scoring):

```bash
PYTHONPATH=src python3 -m playtest.mcp_server
PYTHONPATH=src python3 -m playtest.scorer
```

Static web workflow:

```bash
make web-build
make web-test
make web-preview
```

The static web app lives in `web/` and is rebuilt from `entrance/` plus `src/help/data/*.yaml`; do not hand-edit generated files under `web/data/`.

## Adding Game Content

### New Room

1. Create directory: `mkdir -p entrance/path/to/.newroom`
2. Add `scroll` file matching the [format standard](advanced.md#scroll-format-standards)
3. Add encounters (treasure, potion, etc.) with `chmod +x`
4. Wire unlock in a prerequisite treasure: `mv ../../.newroom ../../newroom 2>/dev/null`
5. Add reset logic in `lib/reset.sh`

### New Encounter

Follow the [executable template](advanced.md#executable-encounter-template):
- `#!/usr/bin/env bash` shebang
- 14-line "wandered out of bounds" boilerplate
- Story via `cat << EOF` heredocs (plain text, no ANSI)
- Game state via `export` instructions, `grep` checks, file flags
- **Never** use `rm`, `mv`, or `perl -i` on tracked game files

### Scroll Content

See `.github/instructions/scrolls.instructions.md` for the full standard. Key rules:
- 80-character width, readable with `cat`
- Level 1 (entrance): Pure ASCII with `===` dividers
- Level 2 (intermediate): Unicode box-drawing, emoji, `####` headers
- Level 3 (advanced): Full formatting
- Every room on the main path needs a scroll with 50+ lines

## Code Standards

### Shell Scripts

- Shebang: `#!/usr/bin/env bash`
- Infrastructure scripts: `set -euo pipefail`, source `lib/colors.sh`
- Game executables: No strict mode, plain text output
- macOS compatibility: `sed -i.bak` not `sed -i`, detect `ls` color flags
- Source colors from `lib/colors.sh` instead of defining inline

### Linting

```bash
shellcheck setup.sh help.sh lib/*.sh src/help/*.sh
```

CI runs ShellCheck, yamllint, markdownlint, and game content validation on every PR.

## Runtime Boundary Checklist

When implementing a feature, confirm these before opening a PR:

1. **Owner surface chosen first** (bash game content under `entrance/`, static web trainer in `web/`, or playtest harness in `src/playtest/`).
2. **Boundary tests updated** at the layer where behavior changed (unit/integration).
3. **Contract data checked** by running:
   - `python3 scripts/validate_content_contracts.py`
   - `python3 scripts/validate_walkthrough_fs.py`
4. **Data contracts kept in sync** (`src/help/data/*.yaml`, `test/datasets/walkthrough.json`), and the web bundle rebuilt (`make web-build`) when game content changes.

## Pull Request Process

1. Fork the repo and create a feature branch
2. Run `bash lib/reset.sh` and play through your changes
3. Run `shellcheck` on modified shell scripts
4. Submit PR against `main` with a description of changes
5. CI must pass before merge
