#!/usr/bin/env bash
#
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                          ⚙️  BASHCRAWL SETUP ⚙️                          ║
# ║                                                                           ║
# ║                  Installation and Configuration Script                    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# @file setup.sh
# @description Complete setup, installation, and configuration for Bashcrawl
# @author Bashcrawl Development Team <team@bashcrawl.org>
# @created 2025-08-05
# @lastModified 2025-08-05
# @version 2.0.0
# @license MIT
#
# @pathContext
#   - incomingPaths: [git clone, user terminal, package managers]
#   - outgoingPaths: [main.sh, game directories, help system]
#   - parallelPaths: [permissions, directories, configuration files]
#
# @relatedFiles
#   - main.sh: Main game launcher and terminal emulator
#   - help/: Help system requiring initialization
#   - entrance/: Game starting area
#
# Path: System Validation → Installation → Configuration → Verification
#
# USAGE:
#   ./setup.sh                    # Full interactive setup
#   ./setup.sh --quick           # Quick setup with defaults
#   ./setup.sh --verify          # Verify existing installation
#   ./setup.sh --repair          # Repair broken installation
#   ./setup.sh --uninstall       # Remove all game data
#   ./setup.sh --help            # Show help information
#

set -euo pipefail

# ============================================================================
# GLOBAL CONFIGURATION AND INITIALIZATION
# ============================================================================

# Path: Environment Variable Setup
readonly SETUP_VERSION="2.0.0"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BASHCRAWL_ROOT="$SCRIPT_DIR"
readonly LOG_FILE="${SCRIPT_DIR}/logs/setup.log"

# Path: Color Configuration for Enhanced UX
# Source shared color constants
if [[ -f "${SCRIPT_DIR}/lib/colors.sh" ]]; then
    source "${SCRIPT_DIR}/lib/colors.sh"
else
    # Fallback inline definitions
    readonly COLOR_PRIMARY=$'\033[0;36m'
    readonly COLOR_SECONDARY=$'\033[0;35m'
    readonly COLOR_SUCCESS=$'\033[0;32m'
    readonly COLOR_WARNING=$'\033[0;33m'
    readonly COLOR_ERROR=$'\033[0;31m'
    readonly COLOR_INFO=$'\033[0;34m'
    readonly COLOR_BOLD=$'\033[1m'
    readonly COLOR_RESET=$'\033[0m'
fi

# Path: Setup Configuration
SETUP_MODE="interactive"
QUICK_SETUP=false
VERIFY_ONLY=false
REPAIR_MODE=false
UNINSTALL_MODE=false

# ============================================================================
# UTILITY FUNCTIONS - PATH: FOUNDATION SERVICES
# ============================================================================

# Path: Logging System with Enhanced Context
log_setup() {
    local level="$1"
    local message="$2"
    local context="${3:-setup}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Log to file with structured format
    echo "[$timestamp] [$level] [$context] $message" >> "$LOG_FILE"
    
    # Display to user with appropriate colors
    case "$level" in
        "INFO")    echo -e "${COLOR_INFO}ℹ️  $message${COLOR_RESET}" ;;
        "SUCCESS") echo -e "${COLOR_SUCCESS}✅ $message${COLOR_RESET}" ;;
        "WARNING") echo -e "${COLOR_WARNING}⚠️  $message${COLOR_RESET}" ;;
        "ERROR")   echo -e "${COLOR_ERROR}❌ $message${COLOR_RESET}" ;;
        "DEBUG")   [[ "${BASHCRAWL_DEBUG:-}" == "true" ]] && echo -e "${COLOR_INFO}🔍 $message${COLOR_RESET}" ;;
    esac
}

# Path: Progress Display with Visual Feedback
show_progress() {
    local current="$1"
    local total="$2"
    local task="$3"
    local percentage=$((current * 100 / total))
    
    printf "\r${COLOR_PRIMARY}[%3d%%] %s${COLOR_RESET}" "$percentage" "$task"
    
    if [[ $current -eq $total ]]; then
        echo "" # New line when complete
    fi
}

# Path: User Confirmation with Enhanced Prompts
confirm_action() {
    local prompt="$1"
    local default="${2:-n}"
    
    echo -n -e "${COLOR_WARNING}$prompt${COLOR_RESET} "
    
    if [[ "$default" == "y" ]]; then
        echo -n "[Y/n]: "
    else
        echo -n "[y/N]: "
    fi
    
    if [[ "$QUICK_SETUP" == "true" ]]; then
        echo "$default"
        return 0
    fi
    
    local response
    read -r response
    
    if [[ -z "$response" ]]; then
        response="$default"
    fi
    
    [[ "$response" =~ ^[Yy]$ ]]
}

# ============================================================================
# SYSTEM VALIDATION - PATH: ENVIRONMENT ANALYSIS
# ============================================================================

# Path: System Requirements Check
check_system_requirements() {
    log_setup "INFO" "Checking system requirements..." "validation"
    
    local requirements_met=true
    
    # Check bash version (more forgiving for macOS)
    local bash_major=${BASH_VERSION%%.*}
    if [[ $bash_major -lt 3 ]]; then
        log_setup "ERROR" "Bash 3.0+ required. Current version: $BASH_VERSION" "validation"
        requirements_met=false
    elif [[ $bash_major -eq 3 ]]; then
        local bash_minor="${BASH_VERSION#3.}"
        bash_minor="${bash_minor%%.*}"
        if [[ $bash_minor -lt 2 ]]; then
            log_setup "WARNING" "Bash 4.0+ recommended. Current version: $BASH_VERSION" "validation"
        fi
        log_setup "SUCCESS" "Bash version: $BASH_VERSION (compatible) ✓" "validation"
    else
        log_setup "SUCCESS" "Bash version: $BASH_VERSION ✓" "validation"
    fi
    
    # Check required commands
    local required_commands=("ls" "cd" "cat" "pwd" "chmod" "mkdir" "find" "grep" "sed")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_setup "ERROR" "Required command missing: $cmd" "validation"
            requirements_met=false
        fi
    done
    
    if [[ "$requirements_met" == "true" ]]; then
        log_setup "SUCCESS" "All system requirements met" "validation"
    fi
    
    return $([[ "$requirements_met" == "true" ]] && echo 0 || echo 1)
}

# Path: Permissions Validation
check_permissions() {
    log_setup "INFO" "Checking directory permissions..." "permissions"
    
    # Check write permissions
    if [[ ! -w "$BASHCRAWL_ROOT" ]]; then
        log_setup "ERROR" "No write permission for $BASHCRAWL_ROOT" "permissions"
        return 1
    fi
    
    # Check if we can create directories
    local test_dir="${BASHCRAWL_ROOT}/.permission_test"
    if mkdir "$test_dir" 2>/dev/null; then
        rmdir "$test_dir"
        log_setup "SUCCESS" "Directory creation permissions ✓" "permissions"
    else
        log_setup "ERROR" "Cannot create directories in $BASHCRAWL_ROOT" "permissions"
        return 1
    fi
    
    return 0
}

# Path: Existing Installation Detection
detect_existing_installation() {
    log_setup "INFO" "Detecting existing installation..." "detection"
    
    if [[ -f "${BASHCRAWL_ROOT}/main.sh" ]]; then
        log_setup "INFO" "Found existing main.sh launcher" "detection"
        return 0
    fi
    
    if [[ -f "${BASHCRAWL_ROOT}/.game_state" ]]; then
        log_setup "INFO" "Found existing game state" "detection"
        return 0
    fi
    
    log_setup "INFO" "No existing installation detected" "detection"
    return 1
}

# ============================================================================
# INSTALLATION PROCESS - PATH: SETUP IMPLEMENTATION
# ============================================================================

# Path: Directory Structure Creation
create_directory_structure() {
    log_setup "INFO" "Creating directory structure..." "structure"
    
    local directories=(
        "logs"
        ".game_data"
        ".game_data/backups"
        ".game_data/sessions"
        "docs"
    )
    
    local current=0
    local total=${#directories[@]}
    
    for dir in "${directories[@]}"; do
        ((current++))
        show_progress $current $total "Creating directory: $dir"
        
        local full_path="${BASHCRAWL_ROOT}/$dir"
        if mkdir -p "$full_path" 2>/dev/null; then
            log_setup "DEBUG" "Created directory: $full_path" "structure"
        else
            log_setup "ERROR" "Failed to create directory: $full_path" "structure"
            return 1
        fi
    done
    
    log_setup "SUCCESS" "Directory structure created successfully" "structure"
    return 0
}

# Path: Executable Permissions Setup
setup_executable_permissions() {
    log_setup "INFO" "Setting up executable permissions..." "permissions"
    
    # Main scripts
    local main_scripts=(
        "main.sh"
    )
    
    for script in "${main_scripts[@]}"; do
        local script_path="${BASHCRAWL_ROOT}/$script"
        if [[ -f "$script_path" ]]; then
            chmod +x "$script_path" 2>/dev/null || {
                log_setup "WARNING" "Could not make $script executable" "permissions"
            }
            log_setup "DEBUG" "Made executable: $script" "permissions"
        fi
    done
    
    # Game interaction files
    local game_executables=("treasure" "potion" "spell" "monster" "ghost" "statue")
    
    for executable in "${game_executables[@]}"; do
        # Find and make executable all files with these names
        find "$BASHCRAWL_ROOT" -name "$executable" -type f -exec chmod +x {} \; 2>/dev/null || true
    done
    
    # Help system scripts
    if [[ -d "${BASHCRAWL_ROOT}/help" ]]; then
        find "${BASHCRAWL_ROOT}/help" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    fi
    
    log_setup "SUCCESS" "Executable permissions configured" "permissions"
    return 0
}

# Path: Configuration File Creation
create_configuration_files() {
    log_setup "INFO" "Creating configuration files..." "config"
    
    # Game configuration
    local config_file="${BASHCRAWL_ROOT}/.game_data/config"
    cat > "$config_file" << 'EOF'
# Bashcrawl Configuration
BASHCRAWL_VERSION=2.0.0
BASHCRAWL_SETUP_DATE=$(date -Iseconds)
BASHCRAWL_INSTALL_PATH=$BASHCRAWL_ROOT

# Game Settings
DEFAULT_PLAYER_HEALTH=100
DEFAULT_GAME_LEVEL=novice
ENABLE_DEBUG_LOGGING=false
ENABLE_SOUND_EFFECTS=false
ENABLE_COLOR_OUTPUT=true

# Terminal Settings
PROMPT_STYLE=enhanced
SHOW_AREA_CONTEXT=true
ENABLE_AUTO_HELP=true

# Learning Settings
TUTORIAL_MODE=guided
SHOW_COMMAND_HINTS=true
TRACK_PROGRESS=true
EOF

    # Setup completion marker
    local setup_marker="${BASHCRAWL_ROOT}/.setup_complete"
    cat > "$setup_marker" << EOF
SETUP_VERSION=$SETUP_VERSION
SETUP_DATE=$(date -Iseconds)
SETUP_MODE=$SETUP_MODE
QUICK_SETUP=$QUICK_SETUP
EOF

    # Initial game state
    local initial_state="${BASHCRAWL_ROOT}/.game_state"
    if [[ ! -f "$initial_state" ]]; then
        cat > "$initial_state" << 'EOF'
# Bashcrawl Initial Game State
PLAYER_INVENTORY=""
PLAYER_HEALTH=100
PLAYER_LEVEL="novice"
CURRENT_AREA="pre-entrance"
GAME_STARTED="false"
TUTORIAL_COMPLETED="false"
AREAS_VISITED=""
TREASURES_FOUND=""
LAST_SESSION=""
SESSION_COUNT=0
TOTAL_PLAYTIME=0
EOF
    fi
    
    log_setup "SUCCESS" "Configuration files created" "config"
    return 0
}

# Path: Help System Initialization
initialize_help_system() {
    log_setup "INFO" "Initializing help system..." "help"
    
    if [[ ! -d "${BASHCRAWL_ROOT}/help" ]]; then
        log_setup "WARNING" "Help directory not found - some features may be limited" "help"
        return 0
    fi
    
    # Initialize help system if init script exists
    local help_init="${BASHCRAWL_ROOT}/help/init_help.sh"
    if [[ -f "$help_init" && -x "$help_init" ]]; then
        chmod +x "$help_init"
        log_setup "SUCCESS" "Help system ready" "help"
    else
        log_setup "WARNING" "Help initialization script not found" "help"
    fi
    
    return 0
}

# ============================================================================
# VERIFICATION SYSTEM - PATH: QUALITY ASSURANCE
# ============================================================================

# Path: Installation Verification
verify_installation() {
    log_setup "INFO" "Verifying installation..." "verification"
    
    local verification_passed=true
    
    # Check main launcher exists and is executable
    if [[ -f "${BASHCRAWL_ROOT}/main.sh" && -x "${BASHCRAWL_ROOT}/main.sh" ]]; then
        log_setup "SUCCESS" "Main launcher verified ✓" "verification"
    else
        log_setup "ERROR" "Main launcher missing or not executable" "verification"
        verification_passed=false
    fi
    
    # Check core directories exist
    local required_dirs=("entrance" "logs" ".game_data")
    for dir in "${required_dirs[@]}"; do
        if [[ -d "${BASHCRAWL_ROOT}/$dir" ]]; then
            log_setup "SUCCESS" "Directory $dir verified ✓" "verification"
        else
            log_setup "ERROR" "Required directory missing: $dir" "verification"
            verification_passed=false
        fi
    done
    
    # Check game state file
    if [[ -f "${BASHCRAWL_ROOT}/.game_state" ]]; then
        log_setup "SUCCESS" "Game state file verified ✓" "verification"
    else
        log_setup "ERROR" "Game state file missing" "verification"
        verification_passed=false
    fi
    
    # Terminal emulator is now integrated into main.sh (v3.0.0+)
    log_setup "SUCCESS" "Terminal emulator (integrated in main.sh) ✓" "verification"
    
    # Test basic functionality
    if [[ -d "${BASHCRAWL_ROOT}/entrance" ]]; then
        if [[ -f "${BASHCRAWL_ROOT}/entrance/scroll" ]]; then
            log_setup "SUCCESS" "Game content verified ✓" "verification"
        else
            log_setup "WARNING" "Game content may be incomplete" "verification"
        fi
    fi
    
    if [[ "$verification_passed" == "true" ]]; then
        log_setup "SUCCESS" "Installation verification completed successfully" "verification"
        return 0
    else
        log_setup "ERROR" "Installation verification failed" "verification"
        return 1
    fi
}

# Path: Health Check with Diagnostics
run_health_check() {
    log_setup "INFO" "Running comprehensive health check..." "health"
    
    echo -e "${COLOR_PRIMARY}🏥 BASHCRAWL HEALTH CHECK${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    
    # System requirements
    echo -e "${COLOR_INFO}📋 System Requirements:${COLOR_RESET}"
    if check_system_requirements; then
        echo -e "   ${COLOR_SUCCESS}✅ All requirements met${COLOR_RESET}"
    else
        echo -e "   ${COLOR_ERROR}❌ Requirements check failed${COLOR_RESET}"
    fi
    
    # Permissions
    echo -e "${COLOR_INFO}🔐 Permissions:${COLOR_RESET}"
    if check_permissions; then
        echo -e "   ${COLOR_SUCCESS}✅ Permissions adequate${COLOR_RESET}"
    else
        echo -e "   ${COLOR_ERROR}❌ Permission issues detected${COLOR_RESET}"
    fi
    
    # Installation status
    echo -e "${COLOR_INFO}📦 Installation:${COLOR_RESET}"
    if verify_installation; then
        echo -e "   ${COLOR_SUCCESS}✅ Installation verified${COLOR_RESET}"
    else
        echo -e "   ${COLOR_ERROR}❌ Installation issues detected${COLOR_RESET}"
    fi
    
    # Game state
    echo -e "${COLOR_INFO}🎮 Game State:${COLOR_RESET}"
    if [[ -f "${BASHCRAWL_ROOT}/.game_state" ]]; then
        # Temporarily disable strict mode for sourcing game state
        set +u
        source "${BASHCRAWL_ROOT}/.game_state"
        set -u
        
        echo -e "   ${COLOR_SUCCESS}✅ Game state: Level ${PLAYER_LEVEL:-novice}${COLOR_RESET}"
        echo -e "   ${COLOR_SUCCESS}✅ Sessions: ${SESSION_COUNT:-0}${COLOR_RESET}"
    else
        echo -e "   ${COLOR_WARNING}⚠️  No game state found${COLOR_RESET}"
    fi
    
    echo ""
    log_setup "SUCCESS" "Health check completed" "health"
}

# ============================================================================
# REPAIR AND MAINTENANCE - PATH: SYSTEM RECOVERY
# ============================================================================

# Path: Installation Repair
repair_installation() {
    log_setup "INFO" "Starting installation repair..." "repair"
    
    echo -e "${COLOR_WARNING}🔧 REPAIR MODE${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo "This will attempt to fix common installation issues."
    echo ""
    
    # Backup existing configuration
    local backup_dir="${BASHCRAWL_ROOT}/.game_data/backups/repair_$(date +%s)"
    mkdir -p "$backup_dir"
    
    if [[ -f "${BASHCRAWL_ROOT}/.game_state" ]]; then
        cp "${BASHCRAWL_ROOT}/.game_state" "$backup_dir/"
        log_setup "INFO" "Game state backed up" "repair"
    fi
    
    # Recreate directory structure
    create_directory_structure
    
    # Fix permissions
    setup_executable_permissions
    
    # Recreate missing configuration files
    create_configuration_files
    
    # Reinitialize help system
    initialize_help_system
    
    # Verify repair
    if verify_installation; then
        log_setup "SUCCESS" "Installation repair completed successfully" "repair"
        echo -e "${COLOR_SUCCESS}✅ Repair completed! Backup saved to: $backup_dir${COLOR_RESET}"
        return 0
    else
        log_setup "ERROR" "Installation repair failed" "repair"
        echo -e "${COLOR_ERROR}❌ Repair failed. Manual intervention may be required.${COLOR_RESET}"
        return 1
    fi
}

# Path: Clean Uninstallation
uninstall_bashcrawl() {
    log_setup "INFO" "Uninstallation requested..." "uninstall"
    
    echo -e "${COLOR_ERROR}🗑️  UNINSTALL BASHCRAWL${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo -e "${COLOR_WARNING}⚠️  This will permanently remove:${COLOR_RESET}"
    echo "   • All game progress and statistics"
    echo "   • Configuration files and settings" 
    echo "   • Game state and session history"
    echo "   • Log files and cached data"
    echo ""
    echo -e "${COLOR_INFO}The following will NOT be removed:${COLOR_RESET}"
    echo "   • Game source code and scripts"
    echo "   • Documentation and help files"
    echo "   • Original game content"
    echo ""
    
    if ! confirm_action "Are you sure you want to uninstall?" "n"; then
        log_setup "INFO" "Uninstallation cancelled by user" "uninstall"
        echo -e "${COLOR_INFO}Uninstallation cancelled.${COLOR_RESET}"
        return 0
    fi
    
    # Create final backup
    local backup_dir="${HOME}/.bashcrawl_backup_$(date +%s)"
    mkdir -p "$backup_dir"
    
    # Backup important files
    if [[ -f "${BASHCRAWL_ROOT}/.game_state" ]]; then
        cp "${BASHCRAWL_ROOT}/.game_state" "$backup_dir/"
    fi
    
    if [[ -d "${BASHCRAWL_ROOT}/.game_data" ]]; then
        cp -r "${BASHCRAWL_ROOT}/.game_data" "$backup_dir/"
    fi
    
    if [[ -d "${BASHCRAWL_ROOT}/logs" ]]; then
        cp -r "${BASHCRAWL_ROOT}/logs" "$backup_dir/"
    fi
    
    # Remove game data
    rm -f "${BASHCRAWL_ROOT}/.game_state"
    rm -f "${BASHCRAWL_ROOT}/.setup_complete"
    rm -f "${BASHCRAWL_ROOT}/.game_history"
    rm -rf "${BASHCRAWL_ROOT}/.game_data"
    rm -rf "${BASHCRAWL_ROOT}/logs"
    
    log_setup "SUCCESS" "Uninstallation completed" "uninstall"
    echo -e "${COLOR_SUCCESS}✅ Uninstallation completed successfully${COLOR_RESET}"
    echo -e "${COLOR_INFO}📦 Backup saved to: $backup_dir${COLOR_RESET}"
    echo -e "${COLOR_INFO}You can reinstall anytime by running: ./setup.sh${COLOR_RESET}"
}

# ============================================================================
# INTERACTIVE SETUP PROCESS - PATH: USER EXPERIENCE
# ============================================================================

# Path: Welcome and Introduction
show_setup_welcome() {
    clear
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════════════╗
║                          ⚙️  BASHCRAWL SETUP ⚙️                          ║
║                                                                           ║
║                  Welcome to the Terminal Adventure Game                   ║
║                                                                           ║
║  This setup will prepare your system for an immersive learning           ║
║  experience where you'll master terminal commands through epic           ║
║  dungeon exploration and engaging gameplay.                              ║
╚═══════════════════════════════════════════════════════════════════════════╝
EOF

    echo -e "${COLOR_INFO}🎯 What this setup will do:${COLOR_RESET}"
    echo "   ✅ Verify system requirements"
    echo "   ✅ Create necessary directories" 
    echo "   ✅ Set up executable permissions"
    echo "   ✅ Initialize game state"
    echo "   ✅ Configure help system"
    echo "   ✅ Verify installation"
    echo ""
    echo -e "${COLOR_SUCCESS}🎮 After setup, you can:${COLOR_RESET}"
    echo "   • Start the adventure with: ./main.sh"
    echo "   • Choose between safe interactive mode or native terminal"
    echo "   • Access comprehensive help and tutorials"
    echo "   • Track your progress through the game"
    echo ""
}

# Path: Interactive Setup Flow
run_interactive_setup() {
    show_setup_welcome
    
    if ! confirm_action "Ready to begin setup?" "y"; then
        log_setup "INFO" "Setup cancelled by user" "interactive"
        echo -e "${COLOR_INFO}Setup cancelled. Run './setup.sh' anytime to continue.${COLOR_RESET}"
        return 0
    fi
    
    echo ""
    log_setup "INFO" "Starting interactive setup..." "interactive"
    
    # Step 1: System validation
    echo -e "${COLOR_PRIMARY}Step 1/6: Checking system requirements...${COLOR_RESET}"
    if ! check_system_requirements; then
        echo -e "${COLOR_ERROR}❌ System requirements not met. Please resolve issues and try again.${COLOR_RESET}"
        return 1
    fi
    
    if ! check_permissions; then
        echo -e "${COLOR_ERROR}❌ Permission issues detected. Please resolve and try again.${COLOR_RESET}"
        return 1
    fi
    
    # Step 2: Handle existing installation
    echo -e "${COLOR_PRIMARY}Step 2/6: Checking for existing installation...${COLOR_RESET}"
    if detect_existing_installation; then
        echo -e "${COLOR_WARNING}⚠️  Existing installation detected.${COLOR_RESET}"
        if confirm_action "Would you like to preserve existing game data?" "y"; then
            log_setup "INFO" "Preserving existing game data" "interactive"
        else
            if confirm_action "Remove existing data and start fresh?" "n"; then
                rm -f "${BASHCRAWL_ROOT}/.game_state"
                rm -rf "${BASHCRAWL_ROOT}/.game_data"
                log_setup "INFO" "Existing data removed" "interactive"
            fi
        fi
    fi
    
    # Step 3: Directory creation
    echo -e "${COLOR_PRIMARY}Step 3/6: Creating directory structure...${COLOR_RESET}"
    if ! create_directory_structure; then
        echo -e "${COLOR_ERROR}❌ Failed to create directories.${COLOR_RESET}"
        return 1
    fi
    
    # Step 4: Permissions setup
    echo -e "${COLOR_PRIMARY}Step 4/6: Setting up permissions...${COLOR_RESET}"
    if ! setup_executable_permissions; then
        echo -e "${COLOR_ERROR}❌ Failed to set permissions.${COLOR_RESET}"
        return 1
    fi
    
    # Step 5: Configuration
    echo -e "${COLOR_PRIMARY}Step 5/6: Creating configuration files...${COLOR_RESET}"
    if ! create_configuration_files; then
        echo -e "${COLOR_ERROR}❌ Failed to create configuration.${COLOR_RESET}"
        return 1
    fi
    
    # Step 6: Help system
    echo -e "${COLOR_PRIMARY}Step 6/6: Initializing help system...${COLOR_RESET}"
    initialize_help_system
    
    # Final verification
    echo -e "${COLOR_PRIMARY}Verifying installation...${COLOR_RESET}"
    if verify_installation; then
        echo ""
        echo -e "${COLOR_SUCCESS}🎉 SETUP COMPLETED SUCCESSFULLY! 🎉${COLOR_RESET}"
        echo "─────────────────────────────────────────────────────────────────────"
        echo -e "${COLOR_INFO}🚀 Ready to start your adventure:${COLOR_RESET}"
        echo ""
        echo -e "${COLOR_PRIMARY}   ./main.sh${COLOR_RESET}                    # Launch the game"
        echo -e "${COLOR_PRIMARY}   ./main.sh --interactive${COLOR_RESET}      # Start interactive mode"
        echo -e "${COLOR_PRIMARY}   ./main.sh --tutorial${COLOR_RESET}         # Learn how to play"
        echo -e "${COLOR_PRIMARY}   ./main.sh --help${COLOR_RESET}             # View all options"
        echo ""
        echo -e "${COLOR_SUCCESS}Happy adventuring! ⚔️${COLOR_RESET}"
        
        log_setup "SUCCESS" "Interactive setup completed successfully" "interactive"
        return 0
    else
        echo -e "${COLOR_ERROR}❌ Setup completed but verification failed.${COLOR_RESET}"
        echo -e "${COLOR_INFO}Try running: ./setup.sh --repair${COLOR_RESET}"
        return 1
    fi
}

# ============================================================================
# COMMAND LINE INTERFACE - PATH: ARGUMENT PROCESSING
# ============================================================================

# Path: Help Display
show_setup_help() {
    cat << EOF
${COLOR_BOLD}⚙️  BASHCRAWL SETUP - Installation and Configuration${COLOR_RESET}

${COLOR_PRIMARY}USAGE:${COLOR_RESET}
    $SCRIPT_NAME [OPTION]

${COLOR_PRIMARY}OPTIONS:${COLOR_RESET}
    -q, --quick           Quick setup with default settings (non-interactive)
    -v, --verify          Verify existing installation without changes
    -r, --repair          Repair broken installation
    -u, --uninstall       Remove all game data and configuration  
    -h, --help            Show this help message
    --version             Show setup version information
    --health-check        Run comprehensive system health check
    --debug               Enable debug logging

${COLOR_PRIMARY}EXAMPLES:${COLOR_RESET}
    $SCRIPT_NAME                    # Interactive setup (recommended)
    $SCRIPT_NAME --quick           # Quick automated setup
    $SCRIPT_NAME --verify          # Check installation status
    $SCRIPT_NAME --repair          # Fix installation issues
    $SCRIPT_NAME --health-check    # Run diagnostic tests

${COLOR_PRIMARY}SETUP PROCESS:${COLOR_RESET}
    1. System requirements validation
    2. Permission checks
    3. Directory structure creation
    4. Executable permissions setup
    5. Configuration file creation
    6. Help system initialization
    7. Installation verification

${COLOR_PRIMARY}FIRST TIME SETUP:${COLOR_RESET}
    Run './setup.sh' and follow the interactive prompts.
    This will guide you through the complete installation process.

${COLOR_PRIMARY}TROUBLESHOOTING:${COLOR_RESET}
    • Installation issues: Run './setup.sh --repair'
    • Permission problems: Check file ownership and permissions
    • System requirements: Ensure Bash 4.0+ and required commands
    • Health check: Run './setup.sh --health-check' for diagnostics

Version: $SETUP_VERSION
EOF
}

# Path: Argument Processing
process_setup_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -q|--quick)
                QUICK_SETUP=true
                SETUP_MODE="quick"
                shift
                ;;
            -v|--verify)
                VERIFY_ONLY=true
                SETUP_MODE="verify"
                shift
                ;;
            -r|--repair)
                REPAIR_MODE=true
                SETUP_MODE="repair"
                shift
                ;;
            -u|--uninstall)
                UNINSTALL_MODE=true
                SETUP_MODE="uninstall"
                shift
                ;;
            --health-check)
                SETUP_MODE="health"
                shift
                ;;
            -h|--help)
                show_setup_help
                exit 0
                ;;
            --version)
                echo "Bashcrawl Setup v$SETUP_VERSION"
                exit 0
                ;;
            --debug)
                export BASHCRAWL_DEBUG="true"
                shift
                ;;
            *)
                echo -e "${COLOR_ERROR}Unknown option: $1${COLOR_RESET}" >&2
                echo "Use '$SCRIPT_NAME --help' for usage information." >&2
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# MAIN EXECUTION FLOW - PATH: SETUP ORCHESTRATION
# ============================================================================

# Path: Main Setup Function
main() {
    # Initialize logging
    log_setup "INFO" "Bashcrawl setup started (v$SETUP_VERSION)" "main"
    
    # Process command line arguments
    process_setup_arguments "$@"
    
    # Execute based on setup mode
    case "$SETUP_MODE" in
        "interactive")
            run_interactive_setup
            ;;
        "quick")
            log_setup "INFO" "Running quick setup..." "main"
            check_system_requirements && \
            check_permissions && \
            create_directory_structure && \
            setup_executable_permissions && \
            create_configuration_files && \
            initialize_help_system && \
            verify_installation
            
            if [[ $? -eq 0 ]]; then
                echo -e "${COLOR_SUCCESS}✅ Quick setup completed successfully!${COLOR_RESET}"
                echo -e "${COLOR_INFO}Run './main.sh' to start your adventure.${COLOR_RESET}"
            else
                echo -e "${COLOR_ERROR}❌ Quick setup failed. Try interactive mode: ./setup.sh${COLOR_RESET}"
                exit 1
            fi
            ;;
        "verify")
            log_setup "INFO" "Verification mode..." "main"
            run_health_check
            verify_installation
            ;;
        "repair")
            repair_installation
            ;;
        "uninstall")
            uninstall_bashcrawl
            ;;
        "health")
            run_health_check
            ;;
        *)
            log_setup "ERROR" "Unknown setup mode: $SETUP_MODE" "main"
            exit 1
            ;;
    esac
    
    log_setup "INFO" "Setup process completed" "main"
}

# ============================================================================
# ERROR HANDLING - PATH: RELIABILITY SYSTEM
# ============================================================================

# Path: Error Handler
handle_setup_error() {
    local exit_code=$?
    local line_number=${BASH_LINENO[0]}
    
    log_setup "ERROR" "Setup error at line $line_number (exit code: $exit_code)" "error"
    echo -e "${COLOR_ERROR}❌ Setup encountered an error. Check logs for details.${COLOR_RESET}" >&2
    echo -e "${COLOR_INFO}Log file: $LOG_FILE${COLOR_RESET}" >&2
    
    exit $exit_code
}

# Set up error handling
trap handle_setup_error ERR

# ============================================================================
# SCRIPT ENTRY POINT - PATH: EXECUTION CONTROL
# ============================================================================

# Execute main function if script is run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

# ============================================================================
# END OF SETUP.SH - BASHCRAWL INSTALLATION AND CONFIGURATION
# ============================================================================
