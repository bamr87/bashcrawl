#!/usr/bin/env bash
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║               Dev Container Post-Create Setup Script                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# Runs automatically after the dev container is created.
# Installs project dependencies and configures the environment.

set -euo pipefail

echo "🐳 Setting up Bashcrawl development environment..."

# --------------------------------------------------------------------------
# System packages
# --------------------------------------------------------------------------
sudo apt-get update && sudo apt-get install -y --no-install-recommends \
    shellcheck \
    tree \
    less \
    file \
    && sudo rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------------------
# Python dependencies
# --------------------------------------------------------------------------
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir --upgrade pip

# Terminal-illness TUI
pip install --no-cache-dir -r src/terminal-illness/requirements.txt

# Flask viewer
pip install --no-cache-dir -r src/viewer/requirements.txt

# Test framework
pip install --no-cache-dir -r test/requirements.txt

# --------------------------------------------------------------------------
# Node.js tools
# --------------------------------------------------------------------------
echo "📦 Installing markdownlint..."
npm install -g markdownlint-cli@0.44.0

# --------------------------------------------------------------------------
# Game setup
# --------------------------------------------------------------------------
echo "🎮 Running game setup..."
bash setup.sh

# --------------------------------------------------------------------------
# Environment file
# --------------------------------------------------------------------------
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env from .env.example — add your API keys there"
fi

# --------------------------------------------------------------------------
# Log directories
# --------------------------------------------------------------------------
mkdir -p logs/sessions logs/screenshots logs/feedback

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║          ✅  Bashcrawl dev environment ready!                       ║"
echo "╠═══════════════════════════════════════════════════════════════════════╣"
echo "║                                                                       ║"
echo "║  Quick start:                                                         ║"
echo "║    make play          — Play the bash game                            ║"
echo "║    make test          — Run tests                                     ║"
echo "║    make lint          — Run linters                                   ║"
echo "║    make viewer        — Start log viewer on :5000                     ║"
echo "║                                                                       ║"
echo "║  Docker:                                                              ║"
echo "║    make docker-build  — Build all Docker images                       ║"
echo "║    make docker-test   — Run tests in Docker                           ║"
echo "║    make docker-game   — Play game in Docker                           ║"
echo "║                                                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
