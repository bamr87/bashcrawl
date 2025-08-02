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
# Clone the repository
git clone https://github.com/bamr87/bashcrawl.git
cd bashcrawl

# Enter the mystical realm
cd entrance
cat scroll
```

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

## 🗺️ The Catacombs Await

Your journey begins in the **entrance**, but the catacombs contain vast networks of interconnected chambers:

- **🏰 The Cellar**: Learn basic navigation and file operations
- **⛪ Hidden Chapel**: Discover secret commands and advanced techniques  
- **🗡️ The Armoury**: Master combat (file manipulation) skills
- **🏟️ Arena Chambers**: Face ultimate terminal challenges
- **📚 Ancient Libraries**: Uncover documentation and help systems

Each area contains **scrolls** (tutorials), **treasures** (useful tools), and **monsters**
(challenging problems) that test your growing command-line prowess.

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
