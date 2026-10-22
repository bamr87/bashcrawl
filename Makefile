# Bashcrawl — Project Task Runner
# =================================
# Two things live here: the terminal-core game (play it with real cd/cat under
# entrance/) and the static web trainer generated from it. Plus a lean MCP
# playtest harness. Every target documents itself with a `##` comment:
# `make help` prints them, and `make generate-contract-docs` writes the same
# list to docs/generated/make-targets.md.

.DEFAULT_GOAL := help
SHELL := /bin/bash

GAME_ROOT := $(shell pwd)
PYTHON := $(shell if [ -x .venv/bin/python ]; then echo "$(GAME_ROOT)/.venv/bin/python"; else echo python3; fi)
NODE := node
VENV := .venv

export PYTHONPATH := $(GAME_ROOT)/src:$(GAME_ROOT)/test
export BASHCRAWL_ROOT := $(GAME_ROOT)
export PYTHON
export PATH := $(GAME_ROOT)/.venv/bin:$(PATH)

# ── Setup ──────────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Make encounters executable and print how to start
	@bash setup.sh

.PHONY: doctor
doctor: ## Check this machine for every surface: [ OK ]/[WARN]/[CRIT] (bin/bashcrawl doctor)
	@bash bin/bashcrawl doctor

.PHONY: venv
venv: ## Create .venv and install web-build + test dependencies
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/python -m pip install --upgrade pip
	$(VENV)/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
	@echo ""
	@echo "Virtualenv ready. Activate it with:  source $(VENV)/bin/activate"

# ── Web (the flagship) ─────────────────────────────────────────────────

.PHONY: web-install
web-install: ## Install the web app's toolchain (npm, always-latest ranges, no lockfile)
	@npm install --no-audit --no-fund

.PHONY: web-build
web-build: ## Regenerate the engine's data bundles, motion clips and vendored core (python only)
	@$(PYTHON) scripts/export_static_web.py
	@$(PYTHON) scripts/build_motion.py
	@$(PYTHON) scripts/vendor_termforge.py

.PHONY: web-bundle
web-bundle: web-build ## web-build, then compile the React app into web/dist (node >= 22.22)
	@npm run build

.PHONY: web-dev
web-dev: web-build ## Vite dev server with hot reload at http://127.0.0.1:5173
	@npm run dev

.PHONY: web-preview
web-preview: web-bundle ## Serve the production build at http://127.0.0.1:4173
	@npm run preview

.PHONY: web-test
web-test: web-build ## Validate the bundle, then lint, test and build the React app
	@$(PYTHON) scripts/validate_static_web.py
	@$(PYTHON) scripts/validate_runtime_commands.py
	@npm run lint
	@npm run test:web
	@npm run build

# ── TermForge hosts (the same game/tools, off the browser) ─────────────

.PHONY: tty-demo
tty-demo: web-build ## Play bashcrawl in this terminal (JS emulator on node; ARGS="--no-hud" for the classic stream)
	@$(NODE) termforge/node/host-tty.js --app bashcrawl $(ARGS)

.PHONY: telnet-demo
telnet-demo: web-build ## Serve bashcrawl at telnet://127.0.0.1:2323 (ARGS="--raw" for nc)
	@$(NODE) termforge/node/host-telnet.js --app bashcrawl $(ARGS)

.PHONY: telnet-hub
telnet-hub: web-build ## Serve bashcrawl as a shared hub (who/say/shout/top) at telnet://127.0.0.1:2323
	@$(NODE) termforge/node/host-telnet.js --app bashcrawl --hub $(ARGS)

.PHONY: agentwatch
agentwatch: ## AI-agent task dashboard (ARGS="--data-dir logs/sessions" for real playtest logs)
	@$(NODE) termforge/node/host-tty.js --app agentwatch $(ARGS)

# ── Content contracts ──────────────────────────────────────────────────

.PHONY: validate-contracts
validate-contracts: ## Validate shared content contracts against the filesystem (and docs/generated/ freshness)
	@$(PYTHON) scripts/validate_content_contracts.py
	@$(PYTHON) scripts/validate_walkthrough_fs.py
	@$(PYTHON) scripts/validate_runtime_commands.py
	@$(PYTHON) scripts/generate_content_index.py --check
	@$(PYTHON) scripts/generate_contract_docs.py --check

.PHONY: generate-contract-docs
generate-contract-docs: ## Rewrite docs/generated/ from the registries, the Makefile and the launcher
	@$(PYTHON) scripts/generate_contract_docs.py

# ── Testing ────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run unit + integration tests
	@bash scripts/run_tests.sh default

.PHONY: test-unit
test-unit: ## Run unit tests only
	@bash scripts/run_tests.sh unit

.PHONY: test-integration
test-integration: ## Run integration tests only
	@bash scripts/run_tests.sh integration

.PHONY: test-js
test-js: ## Run the TermForge framework tests (node --test, zero deps)
	@$(NODE) --test termforge/test/*.test.js

.PHONY: motion
motion: ## Preview an ASCII Motion file in this terminal (CLIP=motion/clips/warp.asciimtn; ARGS="--loop")
	@$(NODE) termforge/node/motion-cli.js play $(or $(CLIP),motion/clips/warp.asciimtn) $(ARGS)

.PHONY: motion-info
motion-info: ## Summarize every ASCII Motion file (size, frames, duration, warnings)
	@$(NODE) termforge/node/motion-cli.js info termforge/motion/*.asciimtn motion/clips/* motion/art/*

.PHONY: ux-review
ux-review: ## Score the terminal stage: log art, stage hold, wipes, overlap
	@$(NODE) termforge/node/ux.js

.PHONY: test-mcp
test-mcp: ## Run the playtest-harness smoke tests in a local .venv
	@bash scripts/test_mcp.sh

.PHONY: playtest
playtest: ## Blank-slate playtest: Claude Code (OAuth) plays via MCP, then score
	@bash scripts/playtest.sh

.PHONY: playtest-grok
playtest-grok: ## Grok plays the sandboxed dungeon (OpenCode xAI OAuth, else XAI_API_KEY)
	@bash scripts/playtest_grok.sh $(ARGS)

.PHONY: agent-sandbox
agent-sandbox: ## Clean sandbox for an agent (ARGS="--json|--pty|--blind|--full")
	@$(PYTHON) -m playtest.agent $(ARGS)

# ── Linting ────────────────────────────────────────────────────────────

.PHONY: lint
lint: ## Run all linters (shellcheck, yamllint, markdownlint, ruff)
	@bash scripts/lint.sh all

.PHONY: lint-shell
lint-shell: ## Run ShellCheck on all shell scripts
	@bash scripts/lint.sh shell

.PHONY: lint-js
lint-js: ## Syntax-check every tracked JS file with node --check
	@set -e; for f in $$(git ls-files --cached --others --exclude-standard '*.js'); do $(NODE) --check "$$f"; done; \
		echo "lint-js: OK ($$(git ls-files --cached --others --exclude-standard '*.js' | wc -l | tr -d ' ') files)"

# ── Maintenance ───────────────────────────────────────────────────────

.PHONY: clean
clean: ## Reset game state to defaults (re-hide unlocked rooms, clear flags)
	@bash lib/reset.sh
	@echo "Game state reset."

.PHONY: clean-all
clean-all: clean ## Reset game state and remove generated logs
	@rm -rf logs/sessions/* 2>/dev/null || true
	@echo "All generated files removed."

# ── Help ───────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
