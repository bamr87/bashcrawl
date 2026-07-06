---
name: test-doc-commit-push
description: Review open changes, run tests, update documentation and changelog, then commit and push for the bashcrawl repository.
---

# Commit & Publish Workflow for Bashcrawl

Review open changes, run appropriate tests, create/update documentation, update the changelog, and push to main (or open a pull request) for the bashcrawl educational shell adventure game.

## Task Overview

Execute the complete release pipeline for bashcrawl. This workflow covers shell script linting, Python test suite execution, game content validation, documentation updates, and a semantic git commit.

## Step 1: Review Open Changes

1. **Analyze Git Changes**:
   - Run `git status` to identify all modified, added, and deleted files
   - Run `git diff --cached` for staged changes and `git diff` for unstaged changes
   - Categorize changes by type:
     - **Features**: New rooms, encounters, game mechanics, or web trainer functionality
     - **Bug Fixes**: Issues resolved in game scripts, help system, or lib utilities
     - **Breaking Changes**: Room renames, inventory format changes, unlock path alterations
     - **Content**: `scroll` file additions or edits (educational text)
     - **Documentation**: README, CHANGELOG, or `docs/` updates
     - **Refactoring**: Code improvements without gameplay changes
     - **Dependencies**: root `requirements.txt` / `requirements-dev.txt` or `test/requirements.txt` updates
     - **Tests**: Additions or modifications in `test/`
     - **CI**: Changes to `.github/workflows/` or `.shellcheckrc`

2. **Summarize Changes**:
   - Create a concise summary of all changes grouped by category above
   - Note any breaking changes that affect existing player state or room unlock paths

3. **Bashcrawl-Specific Change Categories**:
   - **Game Content** (`entrance/`, `entrance/cellar/`, `entrance/cellar/armoury/`, hidden dirs): scrolls, treasures, potions, spells, encounters
   - **Setup** (`setup.sh`): permissions, system checks
   - **Help System** (`help.sh`, `src/help/`): contextual help, AI engine, command suggester
   - **Lib Utilities** (`lib/`): `colors.sh`, `log.sh`, `yaml_reader.sh`, `reset.sh`
   - **Static Web Trainer** (`web/`, `scripts/export_static_web.py`): browser-based trainer, rebuilt with `make web-build`
   - **Playtest Harness** (`src/playtest/`): MCP server, sandbox, recorder, scorer
   - **Tests** (`test/`): unit and integration test suites

## Step 2: Run Appropriate Tests

1. **Identify Test Requirements**:
   - Shell script changes → run shellcheck lint
   - Game content changes → run integration tests and game-content CI validation
   - Python component changes (`src/`, `test/`) → run pytest
   - For all changes → run the full suite below

2. **Execute Shell Linting**:
   ```bash
   # Lint all shell scripts (respects .shellcheckrc)
   shellcheck *.sh src/help/*.sh lib/*.sh
   
   # YAML and Markdown lint (matches CI)
   yamllint -c .yamllint.yml .
   markdownlint '**/*.md' --config .markdownlint.json
   ```

3. **Execute Python Tests**:
   ```bash
   # Activate virtualenv first
   source .venv/bin/activate
   
   # Fast deterministic tests (default CI run)
   cd test && pytest -m "unit" -q
   
   # Real filesystem + bash integration tests
   cd test && pytest -m "integration" -q
   
   # Full suite (unit + integration, matches CI default)
   cd test && pytest -q
   ```

4. **Validate Game Setup**:
   ```bash
   bash setup.sh          # Verify permissions and system checks pass
   bash lib/reset.sh --dry  # Preview reset without modifying state
   ```

5. **Verify Test Results**:
   - Ensure all unit and integration tests pass before proceeding
   - If shellcheck reports errors, fix them (SC2034, SC2086, SC1091, SC2154 are suppressed via `.shellcheckrc`)
   - Document any test warnings

## Step 3: Create/Update Documentation

1. **Update Affected README Files**:
   - Update `README.md` for user-facing gameplay or setup changes
   - Update `docs/` pages for new mechanics, rooms, or advanced features
   - Update `src/help/HELP_REFERENCE.md` if help system commands change
   - Rebuild the static web bundle with `make web-build` if game content or YAML registries changed

2. **Update Game Content Documentation**:
   - Ensure new `scroll` files follow the depth-appropriate format (see `.github/instructions/scrolls.instructions.md`):
     - Level 1 (`entrance/`): Pure ASCII, 80-char width, no ANSI
     - Level 2 (`cellar/`, `armoury/`): Unicode box-drawing, emojis OK
     - Level 3 (hidden areas): Markdown features allowed
   - Document new room unlock paths in `docs/walkthrough.md` if needed

3. **Update HELP_REFERENCE and Map**:
   - If new commands are introduced, add them to `src/help/data/`
   - If new rooms are added, update the dungeon map in `help.sh` output

## Step 4: Update CHANGELOG.md

1. **Determine Release Type** based on changes:
   - **MAJOR**: Breaking changes to room structure, inventory format, or unlock paths
   - **MINOR**: New rooms, encounters, game mechanics, or Python features (backward-compatible)
   - **PATCH**: Bug fixes, scroll edits, documentation, minor improvements

2. **Add Changelog Entry** following Keep a Changelog format:
   ```markdown
   ## [Unreleased] - YYYY-MM-DD

   ### Added
   - **New Room: `entrance/workshop/`** - Description of what it teaches
   - **New Encounter: `cellar/treasure`** - Description of mechanic
   - New features or content

   ### Changed
   - **Enhanced: `entrance/scroll`** - Description of improvements
   - Changes to existing gameplay or scripts

   ### Fixed
   - **Critical: issue description** - Resolution details
   - Bug fixes with context

   ### Removed
   - Removed content or deprecated scripts
   ```

3. **Reference Issues/PRs** if applicable

## Step 5: Prepare Commit and Push

1. **Stage All Changes**:
   ```bash
   git add -A
   ```

2. **Create Semantic Commit Message**:
   Format: `<type>(<scope>): <description>`

   Types:
   - `feat`: New room, encounter, mechanic, or feature
   - `fix`: Bug fix in game scripts or infrastructure
   - `content`: Scroll edits or educational content updates
   - `docs`: Documentation-only changes
   - `refactor`: Code restructuring without gameplay change
   - `test`: Test additions or modifications
   - `chore`: Maintenance (deps, CI config, linting)
   - `style`: Formatting only

   Scopes (bashcrawl-specific):
   - `game`: Core game content (`entrance/` tree, encounters)
   - `scroll`: Educational scroll content
   - `help`: Help system (`help.sh`, `src/help/`)
   - `lib`: Shared utilities (`lib/`)
   - `web`: Static web trainer (`web/`, `scripts/export_static_web.py`)
   - `playtest`: MCP playtest harness (`src/playtest/`)
   - `test`: Test suite (`test/`)
   - `ci`: GitHub Actions workflows

3. **Commit Changes**:
   ```bash
   git commit -m "<type>(<scope>): <description>

   <detailed description of changes>

   - Change 1
   - Change 2
   - Change 3

   Closes #<issue-number> (if applicable)"
   ```

4. **Push to Main Branch**:
   ```bash
   git push origin main
   ```

5. **Open a Pull Request** (if working on a feature branch):
   ```bash
   gh pr create --base main --head <branch> \
     --title "<type>(<scope>): <description>" \
     --body "## Summary
   
   <description of changes>
   
   ## Test Results
   - shellcheck: PASSED
   - pytest unit: PASSED
   - pytest integration: PASSED
   
   ## Checklist
   - [ ] Shell scripts pass shellcheck
   - [ ] Tests pass
   - [ ] CHANGELOG.md updated
   - [ ] Documentation updated"
   ```

## Success Criteria

- [ ] `shellcheck *.sh src/help/*.sh lib/*.sh` passes with no errors
- [ ] `pytest -m "unit"` passes
- [ ] `pytest -m "integration"` passes
- [ ] `bash setup.sh` completes without errors
- [ ] All new/modified `scroll` files follow the depth-appropriate format standard
- [ ] Game executables start with `#!/usr/bin/env bash` and use `cat << EOF` heredocs
- [ ] No git-tracked files are modified by game executables (only `export` instructions to player)
- [ ] CHANGELOG.md updated with new entry
- [ ] Git commit follows semantic commit format
- [ ] Changes pushed to main (or PR opened)

## Output Format

After completing all steps, provide a summary:

```markdown
## Release Summary

**Date**: YYYY-MM-DD

### Changes Included
- [ ] New room: `entrance/workshop/`
- [ ] New encounter: `cellar/treasure`
- [ ] Scroll update: description
- [ ] etc.

### Test Results
- shellcheck: PASSED/FAILED
- pytest unit: PASSED/FAILED
- pytest integration: PASSED/FAILED
- setup.sh validation: OK/FAILED

### Files Modified
- entrance/scroll
- entrance/cellar/treasure
- lib/reset.sh
- src/help/bashcrawl_help.sh

### Documentation Updated
- [ ] README.md
- [ ] CHANGELOG.md
- [ ] docs/walkthrough.md
- [ ] src/help/HELP_REFERENCE.md

### Commit Information
- Hash: <commit-hash>
- Message: <commit-message>
- Branch: main

### Publication Status
- Pull Request: https://github.com/bamr87/bashcrawl/pull/<pr-number> (if applicable)
- CI Status: Pending / Passed
```

## Rollback Procedure

If issues are discovered after pushing:

1. **Revert the Commit**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Reset Game State** (if room structure changed):
   ```bash
   bash lib/reset.sh       # Restore hidden dirs and permissions
   ```

3. **Close/Revert a Pull Request** (if using PR workflow):
   ```bash
   gh pr close <pr-number>
   # or after merge:
   git revert <merge-commit-hash>
   git push origin main
   ```

4. **Create a Fix Release**:
   - Fix the issues on a branch
   - Follow this workflow again to create a new commit/PR

---

## Quick Reference Commands

```bash
# Shell linting
shellcheck *.sh src/help/*.sh lib/*.sh   # Lint all scripts
yamllint -c .yamllint.yml .              # Lint YAML files

# Python tests
source .venv/bin/activate
cd test
pytest -m "unit" -q                      # Fast unit tests
pytest -m "integration" -q              # Integration tests
pytest -q                               # Default: unit + integration

# Game validation
bash setup.sh                           # Validate setup
bash lib/reset.sh --dry                 # Preview state reset
bash lib/reset.sh                       # Execute state reset
cd entrance && cat scroll               # Verify game entry point

# Help system
bash help.sh                            # Contextual help
bash help.sh map                        # Dungeon map
bash help.sh commands                   # Command reference

# Static web trainer
make web-build                          # Rebuild web/ data from the registries
make web-preview                        # Serve web/ at http://127.0.0.1:8000

# Git workflow
git add -A                              # Stage all changes
git commit -m "feat(game): add workshop room"  # Semantic commit
git push origin main                    # Push to main

# Pull request
gh pr create --base main --head <branch> --title "feat(game): add workshop room"
```

---

**Note**: Game executables must never modify git-tracked files. All player state changes are done via `export` commands printed to the player. Always run shellcheck and the unit+integration test suite before pushing.
