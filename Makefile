# Bashcrawl — Project Task Runner
# =================================
# Usage:
#   make setup          One-time game setup (quick mode)
#   make install-deps   Install all Python dependencies
#   make test           Run unit + integration tests
#   make test-mcp       Run MCP integration tests in .venv
#   make test-ai        Run AI playthrough tests (needs ANTHROPIC_API_KEY)
#   make lint           Run shellcheck, yamllint, markdownlint
#   make lint-shell     Run shellcheck only
#   make clean          Reset game state to defaults
#   make docker-build   Build all Docker images (compose)
#   make docker-web     Run web + MCP on :8080
#   make help           Show this help

.DEFAULT_GOAL := help
SHELL := /bin/bash

GAME_ROOT := $(shell pwd)
PYTHON := python3
PIP := pip3
PYTEST := $(PYTHON) -m pytest
SHELLCHECK := shellcheck
COMPOSE := docker compose

export PYTHONPATH := $(GAME_ROOT)/src/terminal-illness:$(GAME_ROOT)/src:$(GAME_ROOT)/test
export BASHCRAWL_ROOT := $(GAME_ROOT)

# ── Setup ──────────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Run first-time game setup (quick mode)
	@bash setup.sh --quick

VENV := .venv

.PHONY: install-deps
install-deps: ## Install all Python dependencies (use `make venv` on system Python)
	@$(PIP) install -r requirements.txt -r requirements-dev.txt || { \
		echo ""; \
		echo "pip install failed. On Debian/Ubuntu (externally-managed system"; \
		echo "Python) this usually means a system package cannot be uninstalled."; \
		echo "Use an isolated environment instead:  make venv"; \
		exit 1; \
	}

.PHONY: venv
venv: ## Create .venv and install all dependencies (recommended on system Python)
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/python -m pip install --upgrade pip
	$(VENV)/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
	@echo ""
	@echo "Virtualenv ready. Activate it with:  source $(VENV)/bin/activate"

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

.PHONY: test-ai
test-ai: ## Run AI playthrough tests (needs ANTHROPIC_API_KEY)
	@bash scripts/run_tests.sh ai

.PHONY: test-mcp
test-mcp: ## Run MCP integration tests in local .venv
	@bash scripts/test_mcp.sh

.PHONY: test-demo
test-demo: ## Run demo walkthrough tests
	@bash scripts/run_tests.sh demo

.PHONY: test-all
test-all: ## Run all tests including AI and demo
	@bash scripts/run_tests.sh all

# ── Linting ────────────────────────────────────────────────────────────

.PHONY: lint
lint: ## Run all linters
	@bash scripts/lint.sh all

.PHONY: lint-shell
lint-shell: ## Run ShellCheck on all shell scripts
	@bash scripts/lint.sh shell

# ── Docker (compose) ───────────────────────────────────────────────────

.PHONY: docker-build docker-game docker-tui docker-viewer docker-web \
        docker-test docker-test-unit docker-test-integration docker-lint docker-clean

docker-build: ## Build all Docker images
	$(COMPOSE) build

docker-game: ## Play the game in Docker (interactive bash)
	$(COMPOSE) run --rm game

docker-tui: ## Launch the Textual TUI in Docker
	$(COMPOSE) run --rm tui

docker-viewer: ## Start the log viewer in Docker on :5000
	$(COMPOSE) up viewer

docker-web: ## Run web UI + MCP in Docker on :8080
	$(COMPOSE) up web

docker-test: ## Run full test suite in Docker
	$(COMPOSE) run --rm test

docker-test-unit: ## Run unit tests in Docker
	$(COMPOSE) run --rm test-unit

docker-test-integration: ## Run integration tests in Docker
	$(COMPOSE) run --rm test-integration

docker-lint: ## Run all linters in Docker
	$(COMPOSE) run --rm lint

docker-clean: ## Remove compose services, images, and volumes
	$(COMPOSE) down --rmi all --volumes --remove-orphans 2>/dev/null || true

# ── Maintenance ───────────────────────────────────────────────────────

.PHONY: clean
clean: ## Reset game state to defaults
	@bash main.sh --reset 2>/dev/null || true
	@rm -f .game_data/command_history
	@echo "Game state reset."

.PHONY: clean-all
clean-all: clean ## Reset game state and remove generated files
	@rm -rf logs/sessions/* logs/screenshots/*
	@rm -f .bashcrawl_save.json .setup_complete
	@echo "All generated files removed."

.PHONY: validate-contracts
validate-contracts: ## Validate shared content contracts
	@python3 scripts/validate_content_contracts.py
	@python3 scripts/validate_walkthrough_fs.py
	@python3 scripts/validate_runtime_commands.py

.PHONY: generate-contract-docs
generate-contract-docs: ## Generate docs from shared contracts
	@python3 scripts/generate_contract_docs.py

.PHONY: web-build
web-build: ## Build static GitHub Pages web data
	@python3 scripts/export_static_web.py

.PHONY: web-test
web-test: web-build ## Validate static web bundle
	@python3 scripts/validate_static_web.py
	@python3 scripts/validate_runtime_commands.py

.PHONY: web-preview
web-preview: web-build ## Preview static web app at http://127.0.0.1:8000
	@cd web && python3 -m http.server 8000 --bind 127.0.0.1

# ── Help ───────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
