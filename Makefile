# Bashcrawl — Project Task Runner
# =================================
# Two things live here: the terminal-core game (play it with real cd/cat under
# entrance/) and the static web trainer generated from it. Plus a lean MCP
# playtest harness. Usage:
#   make setup             One-time game setup (make encounters executable)
#   make web-build         Build the static web bundle (web/data/*.json)
#   make web-preview       Serve the web app at http://127.0.0.1:8000
#   make web-test          Build + validate the web bundle
#   make validate-contracts  Validate YAML registries against the filesystem
#   make test              Run unit + integration tests
#   make test-mcp          Run the playtest-harness smoke tests in a .venv
#   make playtest          Blank-slate playtest: Claude Code plays via MCP, then score
#   make lint              Run shellcheck, yamllint, markdownlint
#   make clean             Reset game state to defaults
#   make help              Show this help

.DEFAULT_GOAL := help
SHELL := /bin/bash

GAME_ROOT := $(shell pwd)
PYTHON := python3
NODE := node
VENV := .venv

export PYTHONPATH := $(GAME_ROOT)/src:$(GAME_ROOT)/test
export BASHCRAWL_ROOT := $(GAME_ROOT)

# ── Setup ──────────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Make encounters executable and print how to start
	@bash setup.sh

.PHONY: venv
venv: ## Create .venv and install web-build + test dependencies
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/python -m pip install --upgrade pip
	$(VENV)/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
	@echo ""
	@echo "Virtualenv ready. Activate it with:  source $(VENV)/bin/activate"

# ── Web (the flagship) ─────────────────────────────────────────────────

.PHONY: web-build
web-build: ## Build the static web bundle from entrance/ + src/help/data/*.yaml
	@$(PYTHON) scripts/export_static_web.py
	@$(PYTHON) scripts/vendor_termforge.py

.PHONY: web-test
web-test: web-build ## Build + validate the static web bundle
	@$(PYTHON) scripts/validate_static_web.py
	@$(PYTHON) scripts/validate_runtime_commands.py

.PHONY: web-preview
web-preview: web-build ## Preview the web app at http://127.0.0.1:8000
	@cd web && $(PYTHON) -m http.server 8000 --bind 127.0.0.1

# ── TermForge hosts (the same game/tools, off the browser) ─────────────

.PHONY: tty-demo
tty-demo: web-build ## Play bashcrawl in this terminal (JS emulator on node)
	@$(NODE) termforge/node/host-tty.js --app bashcrawl

.PHONY: telnet-demo
telnet-demo: web-build ## Serve bashcrawl at telnet://127.0.0.1:2323 (ARGS="--raw" for nc)
	@$(NODE) termforge/node/host-telnet.js --app bashcrawl $(ARGS)

# ── Content contracts ──────────────────────────────────────────────────

.PHONY: validate-contracts
validate-contracts: ## Validate shared content contracts against the filesystem
	@$(PYTHON) scripts/validate_content_contracts.py
	@$(PYTHON) scripts/validate_walkthrough_fs.py
	@$(PYTHON) scripts/validate_runtime_commands.py
	@$(PYTHON) scripts/generate_content_index.py --check

.PHONY: generate-contract-docs
generate-contract-docs: ## Generate docs from shared contracts
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

.PHONY: test-mcp
test-mcp: ## Run the playtest-harness smoke tests in a local .venv
	@bash scripts/test_mcp.sh

.PHONY: playtest
playtest: ## Blank-slate playtest: Claude Code (OAuth) plays via MCP, then score
	@bash scripts/playtest.sh

# ── Linting ────────────────────────────────────────────────────────────

.PHONY: lint
lint: ## Run all linters (shellcheck, yamllint, markdownlint, ruff)
	@bash scripts/lint.sh all

.PHONY: lint-shell
lint-shell: ## Run ShellCheck on all shell scripts
	@bash scripts/lint.sh shell

.PHONY: lint-js
lint-js: ## Syntax-check every tracked JS file with node --check
	@set -e; for f in $$(git ls-files '*.js'); do $(NODE) --check "$$f"; done; \
		echo "lint-js: OK ($$(git ls-files '*.js' | wc -l | tr -d ' ') files)"

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
