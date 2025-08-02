# ⚔️ Bashcrawl: The Terminal Adventure Game

## Where Heroes Are Forged in the Fires of the Command Line

Bashcrawl is an immersive text-based adventure game that teaches you the fundamentals of POSIX
terminal navigation through epic dungeon exploration. Transform from a terminal novice into a
command-line champion by battling monsters, collecting treasures, and solving puzzles—all while
mastering essential shell commands.

## 🌟 What Makes This Journey Special

- **Learn by Doing**: Master terminal commands through engaging gameplay
- **Progressive Difficulty**: Skills build naturally as you explore deeper
- **Real Terminal Skills**: Every command you learn applies to real-world development
- **Hidden Depths**: Secret areas and advanced features reward curious explorers
- **Multiple Paths**: Different routes through the catacombs teach different skills

## 🚀 Quick Start Your Adventure

### 🎮 Option 1: Local Installation (Recommended)

Clone or download this repository to your local machine:

```bash
# Clone the repository (download a copy to your computer)
git clone https://github.com/bamr87/bashcrawl.git

# Navigate into the downloaded directory
cd bashcrawl

# Enter the mystical realm - this is where your adventure begins
cd entrance

# Read the first scroll to start your journey
cat scroll
```

#### 🔍 Understanding These Commands

**`git clone`** - Downloads a complete copy of the repository to your local machine

- Creates a new directory with the project name
- Downloads all files, folders, and version history
- Connects your local copy to the remote repository

**`cd bashcrawl`** - Changes your current directory (think of it as "entering a folder")

- `cd` stands for "change directory"
- Takes you inside the bashcrawl folder that was just created
- Your terminal prompt will update to show you're now in this location

**`cd entrance`** - Navigate to the starting area of the game

- Moves you into the "entrance" subdirectory
- This is where your adventure officially begins
- Think of it as walking through the dungeon's front door

**`cat scroll`** - Display the contents of the scroll file

- `cat` shows the entire contents of a text file
- "scroll" is the name of the file containing your first instructions
- This command reveals the game's opening narrative and your first challenges

#### 🛠️ Essential Terminal Basics Before You Begin

**Navigation Commands:**

```bash
pwd                 # Print Working Directory - shows exactly where you are
ls                  # List - shows all files and folders in current location
ls -la              # List with details - shows hidden files, permissions, dates
cd ..               # Go up one directory level (like clicking "back")
cd ~                # Go to your home directory
cd /                # Go to the root directory of your system
```

**File Viewing Commands:**

```bash
cat filename        # Display entire file contents at once
less filename       # View file contents page by page (press 'q' to quit)
head filename       # Show first 10 lines of a file
tail filename       # Show last 10 lines of a file
wc filename         # Word count - shows lines, words, and characters
```

**Getting Help:**

```bash
man command         # Manual page for any command (press 'q' to exit)
command --help      # Quick help for most commands
which command       # Shows where a command is located
history             # Shows your recent command history
```

**File and Directory Operations:**

```bash
mkdir dirname       # Create a new directory
touch filename      # Create a new empty file
cp source dest      # Copy file or directory
mv old new          # Move/rename file or directory
rm filename         # Delete a file (be careful!)
rmdir dirname       # Delete an empty directory
```

#### 🎯 Pro Tips for New Terminal Users

**Command Shortcuts:**

- **Tab Completion**: Press `Tab` to auto-complete file/directory names
- **Up Arrow**: Scroll through previous commands
- **Ctrl + C**: Stop a running command
- **Ctrl + L**: Clear the terminal screen (same as `clear` command)
- **Ctrl + A**: Jump to beginning of current line
- **Ctrl + E**: Jump to end of current line

**Safety First:**

- Always know where you are with `pwd` before running commands
- Use `ls` to see what's in a directory before acting
- Be extra careful with `rm` (delete) commands - there's no recycle bin!
- When in doubt, use `--help` or `man` to understand a command

*You are now playing the game. May the gods save you.*

### ☁️ Option 2: Instant Play Online

Launch immediately in your browser:
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gl/nthiery%2Fbashcrawl/HEAD)

*Perfect for quick experimentation - no installation required!*

### 🍎 macOS Users: Special Instructions

macOS's default Archive Utility may incorrectly set file permissions. For the best experience:

```bash
# Download and extract using terminal
curl -L https://gitlab.com/slackermedia/bashcrawl/-/archive/master/bashcrawl-master.zip -o bashcrawl.zip
unzip bashcrawl.zip
cd bashcrawl-master/entrance
cat scroll
```

## 🎯 Learning Path & Skills

### 🟢 Novice Terminal Skills

**What you'll master in the first areas:**

- File and directory navigation (`ls`, `cd`, `pwd`)
- Reading file contents (`cat`, `less`, `more`)
- Understanding file permissions and types
- Basic shell aliases and environment variables

### 🟡 Intermediate Command Mastery

**As you venture deeper:**

- File searching and pattern matching (`find`, `grep`)
- Process management and system information
- Advanced directory operations (`mkdir`, `rmdir`, `tree`)
- Shell scripting fundamentals and variables

### 🔴 Advanced Terminal Sorcery

**In the deepest dungeons:**

- Complex command chaining and pipes
- Regular expressions and text processing
- System monitoring and troubleshooting
- Custom function creation and automation

## 🗺️ The Catacombs: Complete Adventure Map

Your journey follows a carefully designed progression through interconnected chambers, each teaching essential terminal skills:

### 📍 **Phase 1: Foundation Chambers**

**🚪 ENTRANCE** (Starting Point)

- **Skills Learned**: Basic navigation (`ls`, `cd`, `pwd`) and comprehensive file viewing
- **Key Commands**: `cat`, `less`, `head`, `tail`, `wc`
- **Challenge**: Master all viewing spells before proceeding
- **Next Step**: Descend to the Cellar

**🏰 THE CELLAR**

- **Skills Learned**: Advanced listing with `ls -F`, shell aliases, distinguishing file types
- **Key Commands**: `ls -F`, `alias`, file type recognition
- **Challenge**: Learn to see through illusions and identify directories vs executables
- **Treasures**: Emerald amulet (inventory system introduction)
- **Next Steps**: Multiple paths unlock - Armoury, Chapel, Vault, or Scrap

### 📍 **Phase 2: Specialization Chambers**

**🗡️ THE ARMOURY** (Combat & File Manipulation)

- **Skills Learned**: File operations, permissions, executable scripts
- **Key Commands**: `chmod`, `./script`, file manipulation
- **Challenge**: Master combat mechanics and file permissions
- **Special Features**: Weapon collection, combat system
- **Leads To**: Advanced combat chambers

**⛪ HIDDEN CHAPEL** (Secret Commands & Advanced Techniques)

- **Skills Learned**: Hidden commands, advanced shell features
- **Key Commands**: Hidden/advanced shell operations
- **Challenge**: Discover secret passages and easter eggs
- **Special Features**: Unlocked only after collecting treasures
- **Leads To**: Secret areas and advanced challenges

**💰 THE VAULT** (Data Management & Variables)

- **Skills Learned**: Environment variables, data storage, inventory management
- **Key Commands**: `export`, `echo $VAR`, variable manipulation
- **Challenge**: Master the inventory and wealth systems
- **Special Features**: Advanced treasure management
- **Leads To**: Economic and data management challenges

**🔧 THE SCRAP** (System Information & Debugging)

- **Skills Learned**: System diagnostics, process management, troubleshooting
- **Key Commands**: `ps`, `top`, `df`, `du`, system monitoring
- **Challenge**: Debug system issues and optimize performance
- **Special Features**: System health monitoring
- **Leads To**: Administrative and maintenance areas

### 📍 **Phase 3: Mastery Chambers**

**🏟️ ARENA CHAMBERS** (Ultimate Challenges)

- **Skills Learned**: Complex command chaining, pipes, advanced scripting
- **Key Commands**: Complex pipelines, advanced bash scripting
- **Challenge**: Face the ultimate terminal combat scenarios
- **Special Features**: Boss battles requiring multiple skill combinations

**📚 ANCIENT LIBRARIES** (Documentation & Help Systems)

- **Skills Learned**: Manual pages, help systems, documentation navigation
- **Key Commands**: `man`, `info`, `--help`, documentation tools
- **Challenge**: Become self-sufficient in learning new commands
- **Special Features**: Meta-learning and self-directed exploration

### 🎯 **Skill Progression Path**

```text
ENTRANCE (File Viewing)
    ↓
CELLAR (File Types & Aliases)
    ↓
[Choose Your Path]
    ├── ARMOURY (Combat/Permissions) → Arena Chambers
    ├── CHAPEL (Secrets/Advanced) → Hidden Areas  
    ├── VAULT (Variables/Data) → Data Management
    └── SCRAP (System/Debug) → Administration
         ↓
ANCIENT LIBRARIES (Documentation Mastery)
    ↓
[Graduation to Real-World Application]
```

### 🔄 **Interconnected Network**

The catacombs form a living network where:

- **Multiple Entry Points**: Some chambers can be reached via different paths
- **Skill Dependencies**: Certain areas require mastery from previous chambers
- **Secret Passages**: Hidden connections reward thorough exploration
- **Backtracking Rewards**: Returning to earlier areas with new skills unlocks secrets
- **Cross-Chamber Challenges**: Some puzzles require knowledge from multiple areas

### 🏆 **Mastery Indicators**

- **Treasure Collection**: Each chamber contains unique treasures validating skill mastery
- **Command Proficiency**: Successful completion of chamber-specific challenges
- **Secret Discovery**: Finding hidden areas and easter eggs
- **Real-World Application**: Successfully applying learned skills outside the game

## 🎮 Gameplay Mechanics

### 💰 Inventory System

Collect items and manage your adventure gear:

```bash
# Check your current inventory
echo $I

# Add items to your collection  
export I=sword,amulet,coins,$I
```

### ⚡ Health & Combat

Survive encounters with system challenges:

```bash
# Monitor your health points
echo $HP

# Recover from battles
let "HP=HP+5"
```

### 🔍 Exploration Commands

Essential spells for navigation:

```bash
ls -F        # See all items with type indicators
cd <room>    # Move between chambers
cat scroll   # Read instructions and lore
pwd          # Know your exact location
```

## 🚀 Modern Terminal Integration

Bashcrawl seamlessly integrates with contemporary development environments:

### 📱 Universal Compatibility

- **Linux/WSL**: Native bash/zsh experience
- **macOS**: Works with Terminal.app, iTerm2, and all popular shells
- **Windows**: Perfect with WSL2, Git Bash, or PowerShell  
- **Cloud**: Runs on GitHub Codespaces, Replit, and other cloud terminals

### 🔧 Development Workflow Enhancement

Skills learned in Bashcrawl directly apply to:

- **Version Control**: Git command-line mastery
- **Package Management**: npm, pip, brew navigation
- **Docker & Containers**: Container shell access and debugging
- **CI/CD Pipelines**: Script debugging and automation
- **Server Administration**: Remote system management

## ⚔️ Advanced Features

### 🎲 Dynamic Combat System

Engage in tactical battles that teach process management:

```bash
# Combat requires strategy and shell knowledge
./monster     # Engage in battle
roll          # Use probability and random numbers
```

### 🔮 Hidden Secrets

Discover easter eggs and advanced techniques:

- Secret passages accessible only through hidden commands
- Bonus areas that teach advanced shell scripting
- Achievement system for mastering different command categories
- Special items that unlock new gameplay mechanics

### 🏆 Mastery Validation

Track your progress with built-in checkpoints:

- Skill verification through practical challenges
- Progressive difficulty that adapts to your learning pace
- Achievement badges for completing different quest lines
- Integration with external learning platforms

## 🔄 Starting Fresh

Reset your adventure for practice or sharing:

```bash
# Method 1: Clean restart
rm -rf bashcrawl
git clone <repository-url>

# Method 2: Reset inventory and health
unset I HP
cd entrance
```

## 🌐 Community & Learning Resources

### 🤝 Join the Adventure

- **Source Code**: [GitLab Repository](https://gitlab.com/slackermedia/bashcrawl)
- **Bug Reports**: Create issues for problems or suggestions
- **Contributions**: Submit new rooms, puzzles, or features
- **Community**: Share your achievements and learn from others

### 📚 Extended Learning

Bashcrawl connects to broader terminal education:

- **IT-Journey.dev**: Progressive quests and skill-building
- **Command Line Tutorials**: Structured learning paths
- **Real-World Projects**: Apply skills to actual development tasks
- **Advanced Challenges**: Graduate to system administration and DevOps

### 🎖️ For Educators

Perfect for computer science education:

- **Classroom Integration**: Engaging way to teach command-line basics
- **Progress Tracking**: Monitor student advancement through areas
- **Customizable Content**: Add institution-specific challenges
- **Assessment Tools**: Validate learning through gameplay completion

---

**Ready to begin your transformation from GUI dependent to command-line champion?**

```bash
cd entrance && cat scroll
```

*Adventure awaits, brave terminal warrior. The catacombs test not just your memory of commands,
but your ability to think like the system itself. May your paths be swift, your permissions
correct, and your exit codes always zero.*

**Happy Hacking!** ⚡
