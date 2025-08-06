#!/usr/bin/env bash
#
# Bashcrawl Setup Script
# Prepares the interactive terminal environment
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🏗️  Setting up Bashcrawl Interactive Terminal Environment..."
echo ""

# Make sure all scripts are executable
echo "📋 Setting up executable permissions..."
chmod +x "$SCRIPT_DIR/bashcrawl-terminal.sh"
chmod +x "$SCRIPT_DIR/start-adventure.sh"  
chmod +x "$SCRIPT_DIR/demo-terminal.sh"
chmod +x "$SCRIPT_DIR/help.sh"

# Set up any other game files that need to be executable
find "$SCRIPT_DIR" -name "treasure" -type f -exec chmod +x {} \;
find "$SCRIPT_DIR" -name "potion" -type f -exec chmod +x {} \;
find "$SCRIPT_DIR" -name "spell" -type f -exec chmod +x {} \;
find "$SCRIPT_DIR" -name "monster" -type f -exec chmod +x {} \;
find "$SCRIPT_DIR" -name "ghost" -type f -exec chmod +x {} \;

# Create game state directory if needed
mkdir -p "$SCRIPT_DIR/.game_data"

echo "✅ Setup complete!"
echo ""
echo "🎮 Ready to play! Choose your adventure:"
echo ""
echo "   🎯 Interactive Terminal (Recommended for beginners):"
echo "      ./start-adventure.sh"
echo ""
echo "   ⚡ Direct Terminal Launch:"
echo "      ./bashcrawl-terminal.sh"
echo ""
echo "   📖 View Demo:"
echo "      ./demo-terminal.sh"
echo ""
echo "   🏠 Traditional Experience:"
echo "      cd entrance && cat scroll"
echo ""

echo "Happy adventuring! ⚔️"
