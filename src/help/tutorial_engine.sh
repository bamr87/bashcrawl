#!/usr/bin/env bash
#
# Bashcrawl Interactive Tutorial Mode
# Guided learning experience for new terminal users
#
# Refactored to:
#   - Use lib/log.sh JSONL logging instead of custom state files
#   - Read tutorial content from src/help/data/tutorials.yaml
#

# Resolve BASHCRAWL_ROOT if not already set
if [[ -z "${BASHCRAWL_ROOT:-}" ]]; then
    _TUT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    BASHCRAWL_ROOT="$(cd "$_TUT_SCRIPT_DIR/../.." 2>/dev/null && pwd)"
fi

# Source logging framework
if [[ -f "${BASHCRAWL_ROOT}/lib/log.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/log.sh"
fi

# Source YAML reader
if [[ -f "${BASHCRAWL_ROOT}/lib/yaml_reader.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/yaml_reader.sh"
fi

_BC_TUTORIAL_FILE="src/help/data/tutorials.yaml"

# Initialize tutorial mode
init_tutorial() {
    # Log tutorial start via unified logging
    if declare -f bc_log &>/dev/null; then
        bc_log "tutorial_start"
    fi
    
    cat << 'EOF'

╔══════════════════════════════════════════════════════════════╗
║            🎓 BASHCRAWL INTERACTIVE TUTORIAL MODE 🎓         ║
║                  Learn Terminal Magic Step-by-Step          ║
╚══════════════════════════════════════════════════════════════╝

Welcome, brave adventurer! This tutorial will guide you through
your first steps in the terminal realm. Each lesson builds upon
the previous one, ensuring you master the basics before advancing.

🎯 Tutorial Features:
   • Step-by-step guided lessons
   • Interactive practice sessions  
   • Progress tracking and achievements
   • Personalized hints and corrections
   • Safe practice environment

EOF
}

# Display tutorial menu
show_tutorial_menu() {
    echo "🎓 Choose your learning path:"
    echo
    echo "   1️⃣  Absolute Beginner - Start here if terminals are new to you"
    echo "   2️⃣  Quick Refresher - Review basics if you have some experience"
    echo "   3️⃣  Bashcrawl-Specific - Learn game mechanics and special features"
    echo "   4️⃣  Advanced Techniques - Master power-user commands"
    echo "   5️⃣  Challenge Mode - Test your skills with progressively harder tasks"
    echo
    echo "   📊 Progress Report - See your learning achievements"
    echo "   🚪 Exit Tutorial - Return to normal help mode"
    echo
}

# Absolute beginner tutorial
tutorial_absolute_beginner() {
    cat << 'EOF'

📚 LESSON 1: Understanding Your Environment

Before we explore dungeons, let's understand where you are:

🔍 TRY THIS: Type the following command (then press Enter)
   pwd

This command stands for "Print Working Directory" - it shows your
exact location in the file system. Think of it as your GPS coordinates!

Expected output: You'll see a path like /Users/yourname/bashcrawl

What this means:
• You're in a folder called "bashcrawl"
• That folder is inside another folder (maybe "yourname")
• Which is inside another folder called "Users"
• This creates a hierarchy like a filing cabinet

🎯 QUICK CHALLENGE: Can you tell me what directory you're in?
   Use the pwd command and look for the last part of the path.

EOF
}

# Interactive lesson system
run_interactive_lesson() {
    local lesson_id="$1"
    
    case "$lesson_id" in
        "pwd_lesson")
            echo "🎯 Interactive Lesson: Finding Your Location"
            echo
            echo "Step 1: Type 'pwd' and press Enter"
            echo "Expected: You should see your current directory path"
            echo
            echo "When you're ready, run the command and observe the output."
            echo "Then type 'help tutorial next' to continue."
            ;;
        "ls_lesson")
            echo "🎯 Interactive Lesson: Seeing What's Around You"
            echo
            echo "Step 1: Type 'ls' and press Enter"
            echo "Expected: You should see a list of files and directories"
            echo
            echo "Step 2: Type 'ls -F' and press Enter"
            echo "Expected: Same list but with special symbols:"
            echo "  • / after directory names"
            echo "  • * after executable files"
            echo "  • @ after symbolic links"
            echo
            echo "When you've tried both commands, type 'help tutorial next' to continue."
            ;;
        "cd_lesson")
            echo "🎯 Interactive Lesson: Moving Around"
            echo
            echo "Step 1: Type 'ls -F' to see available directories"
            echo "Step 2: Choose a directory name that ends with /"
            echo "Step 3: Type 'cd [directory_name]' (replace with actual name)"
            echo "Step 4: Type 'pwd' to confirm you moved"
            echo "Step 5: Type 'cd ..' to go back up one level"
            echo
            echo "Practice this a few times, then type 'help tutorial next' to continue."
            ;;
        *)
            echo "🎓 Tutorial lesson '$lesson_id' not found."
            echo "Available lessons: pwd_lesson, ls_lesson, cd_lesson"
            ;;
    esac
}

# Progress tracking for tutorial (delegates to lib/log.sh JSONL)
track_tutorial_progress() {
    local lesson="$1"
    local status="$2"  # started, completed, mastered
    
    if declare -f bc_log &>/dev/null; then
        bc_log "tutorial_progress" "lesson=$lesson" "status=$status"
    fi
}

# Show tutorial progress (reads from JSONL session logs)
show_tutorial_progress() {
    echo "📊 Your Learning Journey:"
    echo
    
    local log_dir="${BASHCRAWL_ROOT}/logs/sessions"
    
    if [[ ! -d "$log_dir" ]] || [[ -z "$(ls -A "$log_dir" 2>/dev/null)" ]]; then
        echo "   🌱 No progress yet - ready to start your adventure!"
        return
    fi
    
    echo "   📅 Tutorial History:"
    echo "   ===================="
    
    local total_lessons=0
    local completed_lessons=0
    
    # Read tutorial events from all JSONL session logs
    while IFS= read -r line; do
        local lesson status ts
        lesson=$(echo "$line" | grep -o '"lesson":"[^"]*"' | head -1 | cut -d'"' -f4)
        status=$(echo "$line" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        ts=$(echo "$line" | grep -o '"ts":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        [[ -z "$lesson" ]] && continue
        ((total_lessons++))
        
        case "$status" in
            "completed"|"mastered")
                ((completed_lessons++))
                echo "   ✅ $lesson - $status ($ts)"
                ;;
            "started")
                echo "   🔄 $lesson - in progress ($ts)"
                ;;
            *)
                echo "   📋 $lesson - $status ($ts)"
                ;;
        esac
    done < <(grep '"tutorial_progress"' "$log_dir"/*.jsonl 2>/dev/null)
    
    echo
    echo "   📈 Progress Summary:"
    echo "   • Lessons Attempted: $total_lessons"
    echo "   • Lessons Completed: $completed_lessons"
    
    if [ "$total_lessons" -gt 0 ]; then
        local percentage=$((completed_lessons * 100 / total_lessons))
        echo "   • Completion Rate: $percentage%"
        
        # Read achievement tiers from YAML
        local tier_shown=false
        for threshold in 80 50 25; do
            if [[ "$percentage" -ge "$threshold" ]] && ! $tier_shown; then
                local tier_title tier_desc tier_emoji
                # Find the matching tier
                tier_emoji=$(yaml_get "$_BC_TUTORIAL_FILE" "achievement_tiers" 2>/dev/null || true)
                case "$threshold" in
                    80) echo "   🏆 Achievement: Terminal Master! You're ready for advanced challenges!" ;;
                    50) echo "   🎯 Achievement: Getting There! You're building solid skills!" ;;
                    25) echo "   🌱 Achievement: First Steps! Keep up the great progress!" ;;
                esac
                tier_shown=true
            fi
        done
    fi
}

# Context-aware tutorial suggestions
suggest_tutorial_lesson() {
    local current_location="$1"
    local player_inventory="$2"
    local recent_commands="$3"
    
    echo "🎓 Suggested Tutorial Based on Your Situation:"
    
    # Analyze current context
    if [ "$current_location" = "entrance" ] && [ -z "$player_inventory" ]; then
        echo "   📚 Beginner Navigation Tutorial - Perfect for your current location!"
        echo "   📝 'help tutorial pwd_lesson' - Learn to find your location"
        echo "   📝 'help tutorial ls_lesson' - Learn to see what's available"
    elif [ -n "$(echo "$recent_commands" | grep "permission denied")" ]; then
        echo "   🔐 File Permissions Tutorial - Solve those 'permission denied' errors!"
        echo "   📝 'help tutorial permissions' - Master chmod and file permissions"
    elif [ "$current_location" = "cellar" ]; then
        echo "   💰 Inventory Management Tutorial - Perfect for the treasure-rich cellar!"
        echo "   📝 'help tutorial inventory' - Learn to collect and manage treasures"
    else
        echo "   🎯 General Skills Tutorial - Build confidence with core commands"
        echo "   📝 'help tutorial basics' - Review fundamental techniques"
    fi
}

# Gamified learning achievements (reads from JSONL session logs)
show_achievements() {
    echo "🏆 Learning Achievements:"
    echo
    
    local log_dir="${BASHCRAWL_ROOT}/logs/sessions"
    
    # Check for various achievements based on JSONL logs
    if [[ -d "$log_dir" ]] && [[ -n "$(ls -A "$log_dir" 2>/dev/null)" ]]; then
        local achievements=()
        local completed_lessons
        completed_lessons=$(grep '"tutorial_progress"' "$log_dir"/*.jsonl 2>/dev/null | grep '"completed"' || true)
        
        # Check for completion achievements — try YAML first, fall back to hardcoded
        if echo "$completed_lessons" | grep -q "pwd_lesson"; then
            local emoji name desc
            emoji=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.pwd_lesson.achievement_emoji" 2>/dev/null || echo "🧭")
            name=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.pwd_lesson.achievement_name" 2>/dev/null || echo "Navigator")
            desc=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.pwd_lesson.achievement_description" 2>/dev/null || echo "Mastered location awareness")
            achievements+=("$emoji $name - $desc")
        fi
        
        if echo "$completed_lessons" | grep -q "ls_lesson"; then
            local emoji name desc
            emoji=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.ls_lesson.achievement_emoji" 2>/dev/null || echo "👁️")
            name=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.ls_lesson.achievement_name" 2>/dev/null || echo "Observer")
            desc=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.ls_lesson.achievement_description" 2>/dev/null || echo "Can see the digital world clearly")
            achievements+=("$emoji $name - $desc")
        fi
        
        if echo "$completed_lessons" | grep -q "cd_lesson"; then
            local emoji name desc
            emoji=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.cd_lesson.achievement_emoji" 2>/dev/null || echo "🚶")
            name=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.cd_lesson.achievement_name" 2>/dev/null || echo "Explorer")
            desc=$(yaml_get "$_BC_TUTORIAL_FILE" "lessons.cd_lesson.achievement_description" 2>/dev/null || echo "Moves confidently through directories")
            achievements+=("$emoji $name - $desc")
        fi
        
        # Display achievements
        if [ ${#achievements[@]} -eq 0 ]; then
            echo "   🌱 No achievements yet - start your learning journey!"
        else
            for achievement in "${achievements[@]}"; do
                echo "   $achievement"
            done
        fi
    else
        echo "   🌱 No achievements yet - ready to earn your first badge?"
    fi
}

# Export tutorial functions
export -f init_tutorial show_tutorial_menu tutorial_absolute_beginner run_interactive_lesson track_tutorial_progress show_tutorial_progress suggest_tutorial_lesson show_achievements
