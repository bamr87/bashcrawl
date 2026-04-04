# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                       🐳  BASHCRAWL MAKEFILE  🐳                        ║
# ║                                                                           ║
# ║  Common commands for Docker-first and local development                  ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# Usage:
#   make help              Show all available targets
#   make docker-build      Build all Docker images
#   make docker-test       Run tests in Docker
#   make docker-game       Play the game in Docker
#   make docker-viewer     Start the log viewer in Docker
#   make docker-lint       Run linters in Docker
#   make play              Play the game locally
#   make test              Run tests locally
#   make lint              Run linters locally

.PHONY: help play test lint viewer setup \
        docker-build docker-game docker-tui docker-viewer \
        docker-test docker-test-unit docker-test-integration docker-lint \
        docker-clean

COMPOSE := docker compose

# ============================================================================
# Help
# ============================================================================

help: ## Show this help message
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║                  🐳  Bashcrawl Makefile  🐳                 ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ============================================================================
# Local development targets
# ============================================================================

setup: ## Run game setup locally
	bash setup.sh

play: ## Play the game locally (bash)
	bash main.sh --interactive

test: ## Run tests locally (pytest)
	cd test && pytest -m "not ai and not demo" --timeout=30 -v

test-unit: ## Run unit tests locally
	cd test && pytest -m unit -v --timeout=30

test-integration: ## Run integration tests locally
	cd test && pytest -m integration -v --timeout=60

lint: ## Run all linters locally
	shellcheck *.sh src/help/*.sh lib/*.sh
	yamllint -c .yamllint.yml .github/workflows/*.yml
	markdownlint '**/*.md' --config .markdownlint.json

viewer: ## Start the log viewer locally on :5000 (localhost only for security)
	python3 -m src.viewer --host 127.0.0.1 --port 5000 --game-root .

# ============================================================================
# Docker targets
# ============================================================================

docker-build: ## Build all Docker images
	$(COMPOSE) build

docker-game: ## Play the game in Docker (interactive bash)
	$(COMPOSE) run --rm game

docker-tui: ## Launch the Textual TUI in Docker
	$(COMPOSE) run --rm tui

docker-viewer: ## Start the log viewer in Docker on :5000
	$(COMPOSE) up viewer

docker-test: ## Run full test suite in Docker
	$(COMPOSE) run --rm test

docker-test-unit: ## Run unit tests in Docker
	$(COMPOSE) run --rm test-unit

docker-test-integration: ## Run integration tests in Docker
	$(COMPOSE) run --rm test-integration

docker-lint: ## Run all linters in Docker
	$(COMPOSE) run --rm lint

docker-clean: ## Remove all Bashcrawl Docker images and volumes
	$(COMPOSE) down --rmi all --volumes --remove-orphans 2>/dev/null || true
	docker image prune -f --filter "label=org.opencontainers.image.description=Bashcrawl*" 2>/dev/null || true
