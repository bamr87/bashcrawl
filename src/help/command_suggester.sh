#!/usr/bin/env bash
#
# Bashcrawl Intelligent Command Suggester
# Provides contextual command recommendations based on current situation
#

# Command suggestion database
suggest_commands() {
    local current_location="$1"
    local current_context="$2"
    local player_level="$3"
    
    echo -e "${HELP_BOLD}${HELP_GREEN}🎯 Smart Command Suggestions:${HELP_NC}"
    echo
    
    # Analyze current directory content
    local has_scroll=$([ -f "scroll" ] && echo "true" || echo "false")
    local has_readme=$([ -f "README.md" ] && echo "true" || echo "false")
    local has_executables=$(find . -maxdepth 1 -type f -executable 2>/dev/null | grep -v "^\./\." | wc -l)
    local has_directories=$(find . -maxdepth 1 -type d ! -name "." | wc -l)
    local has_hidden=$(ls -la 2>/dev/null | grep "^-.*\s\." | wc -l)
    
    echo "   📊 Situation Analysis:"
    echo "   • Location: $current_location"
    echo "   • Documentation: $([ "$has_scroll" = "true" ] && echo "scroll available" || echo "no scroll")"
    echo "   • Interactive elements: $has_executables"
    echo "   • Explorable areas: $has_directories"
    echo "   • Hidden files: $has_hidden"
    echo
    
    # Priority-based suggestions
    echo "   🎯 Recommended Next Steps:"
    
    local suggestions=()
    local priorities=()
    
    # High priority: Documentation
    if [ "$has_scroll" = "true" ]; then
        suggestions+=("cat scroll")
        priorities+=("HIGH")
        echo -e "   🔥 ${HELP_RED}HIGH PRIORITY${HELP_NC}: ${HELP_GREEN}cat scroll${HELP_NC} - Read essential guidance for this area"
    fi
    
    # Medium-high priority: Executables
    if [ "$has_executables" -gt 0 ]; then
        suggestions+=("ls -F")
        priorities+=("MEDIUM-HIGH")
        echo -e "   ⚡ ${HELP_YELLOW}MEDIUM-HIGH${HELP_NC}: ${HELP_GREEN}ls -F${HELP_NC} - Identify interactive elements (look for *)"
        
        # Suggest specific executables
        find . -maxdepth 1 -type f -executable 2>/dev/null | grep -v "^\./\." | head -3 | while read -r exe; do
            local name=$(basename "$exe")
            echo -e "   ⚡ ${HELP_YELLOW}INTERACTIVE${HELP_NC}: ${HELP_GREEN}./$name${HELP_NC} - Run this interactive element"
        done
    fi
    
    # Medium priority: Exploration
    if [ "$has_directories" -gt 0 ]; then
        suggestions+=("cd <directory>")
        priorities+=("MEDIUM")
        echo -e "   🚪 ${HELP_BLUE}MEDIUM${HELP_NC}: ${HELP_GREEN}cd <directory>${HELP_NC} - Explore available areas"
        
        # Suggest specific directories
        find . -maxdepth 1 -type d ! -name "." | head -2 | while read -r dir; do
            local dir_name=$(basename "$dir")
            echo -e "   🚪 ${HELP_BLUE}EXPLORE${HELP_NC}: ${HELP_GREEN}cd $dir_name${HELP_NC} - Enter this area"
        done
    fi
    
    # Low-medium priority: Hidden content
    if [ "$has_hidden" -gt 0 ]; then
        suggestions+=("ls -la")
        priorities+=("LOW-MEDIUM")
        echo -e "   🔍 ${HELP_PURPLE}DISCOVERY${HELP_NC}: ${HELP_GREEN}ls -la${HELP_NC} - Reveal hidden files and secrets"
    fi
    
    # Basic exploration if nothing special
    if [ "$has_scroll" = "false" ] && [ "$has_executables" -eq 0 ] && [ "$has_directories" -eq 0 ]; then
        echo -e "   🧭 ${HELP_CYAN}BASIC${HELP_NC}: ${HELP_GREEN}pwd${HELP_NC} - Confirm your location"
        echo -e "   🧭 ${HELP_CYAN}BASIC${HELP_NC}: ${HELP_GREEN}ls -la${HELP_NC} - See everything in this area"
        echo -e "   🧭 ${HELP_CYAN}BASIC${HELP_NC}: ${HELP_GREEN}cd ..${HELP_NC} - Go back to parent directory"
    fi
    
    # Player-level specific suggestions
    echo
    echo "   📈 Level-Appropriate Suggestions:"
    case "$player_level" in
        novice)
            echo -e "   📚 ${HELP_GREEN}help tutorial${HELP_NC} - Start interactive learning mode"
            echo -e "   📚 ${HELP_GREEN}pwd${HELP_NC} - Always know where you are"
            echo -e "   📚 ${HELP_GREEN}ls -F${HELP_NC} - Use this often to see what's available"
            ;;
        intermediate)
            echo -e "   🎯 ${HELP_GREEN}find . -name \"*\"${HELP_NC} - Search for files"
            echo -e "   🎯 ${HELP_GREEN}grep -r \"pattern\" .${HELP_NC} - Search within files"
            echo -e "   🎯 ${HELP_GREEN}history${HELP_NC} - Review your recent commands"
            ;;
        advanced)
            echo -e "   🚀 ${HELP_GREEN}find . -type f -executable${HELP_NC} - Find all executables"
            echo -e "   🚀 ${HELP_GREEN}ls -la | grep \"^d\"${HELP_NC} - Show only directories"
            echo -e "   🚀 ${HELP_GREEN}file *${HELP_NC} - Analyze file types"
            ;;
    esac
}

# Context-aware error help
suggest_error_solutions() {
    local error_type="$1"
    
    echo -e "${HELP_BOLD}${HELP_RED}🆘 Error Solution Guide:${HELP_NC}"
    echo
    
    case "$error_type" in
        "permission")
            echo "   ❌ Common Issue: Permission Denied"
            echo -e "   💡 ${HELP_GREEN}Solution 1${HELP_NC}: chmod +x <filename> - Make file executable"
            echo -e "   💡 ${HELP_GREEN}Solution 2${HELP_NC}: ls -la <filename> - Check current permissions"
            echo -e "   💡 ${HELP_GREEN}Solution 3${HELP_NC}: ./<filename> - Run with explicit path"
            ;;
        "not_found")
            echo "   ❌ Common Issue: Command/File Not Found"
            echo -e "   💡 ${HELP_GREEN}Solution 1${HELP_NC}: ls -la - See what files actually exist"
            echo -e "   💡 ${HELP_GREEN}Solution 2${HELP_NC}: pwd - Check you're in the right directory"
            echo -e "   💡 ${HELP_GREEN}Solution 3${HELP_NC}: which <command> - Find where command is located"
            ;;
        "no_directory")
            echo "   ❌ Common Issue: No Such Directory"
            echo -e "   💡 ${HELP_GREEN}Solution 1${HELP_NC}: ls -F - See available directories (marked with /)"
            echo -e "   💡 ${HELP_GREEN}Solution 2${HELP_NC}: cd .. - Go back up one level"
            echo -e "   💡 ${HELP_GREEN}Solution 3${HELP_NC}: pwd - Confirm current location"
            ;;
        *)
            echo "   💡 General troubleshooting steps:"
            echo -e "   1. ${HELP_GREEN}pwd${HELP_NC} - Confirm your location"
            echo -e "   2. ${HELP_GREEN}ls -la${HELP_NC} - See what's actually available"
            echo -e "   3. ${HELP_GREEN}help${HELP_NC} - Get contextual assistance"
            echo -e "   4. ${HELP_GREEN}cat scroll${HELP_NC} - Read area documentation"
            ;;
    esac
}

# Workflow suggestions based on common patterns
suggest_workflows() {
    local goal="$1"
    
    echo -e "${HELP_BOLD}${HELP_BLUE}🔄 Workflow Suggestions:${HELP_NC}"
    echo
    
    case "$goal" in
        "explore_new_area")
            echo "   🗺️ Exploring a New Area Workflow:"
            echo -e "   1. ${HELP_GREEN}pwd${HELP_NC} - Confirm where you are"
            echo -e "   2. ${HELP_GREEN}ls -F${HELP_NC} - See what's available"
            echo -e "   3. ${HELP_GREEN}cat scroll${HELP_NC} - Read documentation (if available)"
            echo -e "   4. ${HELP_GREEN}ls -la${HELP_NC} - Check for hidden files"
            echo -e "   5. ${HELP_GREEN}./<executable>${HELP_NC} - Try interactive elements"
            echo -e "   6. ${HELP_GREEN}cd <directory>${HELP_NC} - Move to next area"
            ;;
        "collect_treasure")
            echo "   💰 Treasure Collection Workflow:"
            echo -e "   1. ${HELP_GREEN}ls -F${HELP_NC} - Look for executables (*)"
            echo -e "   2. ${HELP_GREEN}./treasure${HELP_NC} - Run treasure scripts"
            echo -e "   3. ${HELP_GREEN}export I=item,\$I${HELP_NC} - Add items to inventory"
            echo -e "   4. ${HELP_GREEN}echo \$I${HELP_NC} - Verify inventory"
            ;;
        "debug_problem")
            echo "   🐛 Problem Debugging Workflow:"
            echo -e "   1. ${HELP_GREEN}pwd${HELP_NC} - Confirm location"
            echo -e "   2. ${HELP_GREEN}ls -la${HELP_NC} - See all files and permissions"
            echo -e "   3. ${HELP_GREEN}cat scroll${HELP_NC} - Re-read instructions"
            echo -e "   4. ${HELP_GREEN}help${HELP_NC} - Get contextual help"
            echo -e "   5. ${HELP_GREEN}history${HELP_NC} - Review recent commands"
            ;;
        *)
            echo "   Available workflows:"
            echo -e "   • ${HELP_GREEN}help suggest explore_new_area${HELP_NC}"
            echo -e "   • ${HELP_GREEN}help suggest collect_treasure${HELP_NC}"
            echo -e "   • ${HELP_GREEN}help suggest debug_problem${HELP_NC}"
            ;;
    esac
}

# Export suggestion functions
export -f suggest_commands suggest_error_solutions suggest_workflows
