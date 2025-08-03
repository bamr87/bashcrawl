#!/usr/bin/env bash
#
# Bashcrawl Help System Demo
# This script demonstrates the intelligent help system in action
#

echo "🎮 Bashcrawl Intelligent Help System Demo"
echo "========================================"
echo

# Ensure we're in the right directory
if [ ! -f "./help.sh" ]; then
    echo "❌ Please run this demo from the bashcrawl root directory"
    exit 1
fi

echo "📍 Testing help system from different locations..."
echo

echo "🚪 1. Testing from entrance area:"
echo "   Command: cd entrance && ../help.sh"
echo "   Output:"
echo "   ----------------------------------------"
cd entrance
../help.sh | head -15
echo "   ----------------------------------------"
echo

echo "🏰 2. Testing context awareness with inventory:"
echo "   Command: export I=amulet,sword && ../help.sh"
echo "   Output (status section):"
echo "   ----------------------------------------"
export I=amulet,sword
../help.sh | grep -A 10 "Adventure Status:" | head -10
echo "   ----------------------------------------"
echo

echo "📚 3. Testing extended help features:"
echo "   Command: ../help.sh commands"
echo "   Output (sample):"
echo "   ----------------------------------------"
../help.sh commands | head -15
echo "   ----------------------------------------"
echo

echo "🎯 4. Testing AI suggestions:"
echo "   Command: cd cellar && ../../help.sh"
echo "   Output (AI section):"
echo "   ----------------------------------------"
cd cellar 2>/dev/null || echo "   (cellar directory not accessible in demo)"
if [ -d "../cellar" ]; then
    cd ../cellar
    ../../help.sh | grep -A 5 "AI Assistant Suggestions:" | head -6
else
    echo "   🤖 AI Assistant Suggestions would appear here"
    echo "   • Context-specific suggestions based on location"
    echo "   • Progress-aware recommendations"
fi
echo "   ----------------------------------------"
echo

echo "✅ Demo complete!"
echo
echo "🚀 To activate the help system in your game:"
echo "   1. Run: source help/init_help.sh"  
echo "   2. Use: help (from anywhere in bashcrawl)"
echo
echo "💡 The help system will automatically adapt to:"
echo "   • Your current location in the dungeon"
echo "   • Your inventory and health status"
echo "   • Your experience level"
echo "   • Available files and challenges in your area"
echo
