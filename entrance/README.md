# 🚪 Welcome to the Entrance - Your Terminal Adventure Begins Here

## 🌟 First Steps into the Catacombs

Congratulations, brave adventurer! You've successfully entered the mystical catacombs of Bashcrawl. This entrance chamber is where you'll learn the fundamental magic spells (terminal commands) needed to survive your journey through the underground dungeons.

## 📜 Your First Scroll

Start your adventure by reading the ancient scroll in this room:

```bash
cat scroll
```

This scroll contains the essential viewing spells and navigation magic you'll need throughout your journey.

## 🎯 Essential Spells to Master

Before venturing deeper, master these fundamental incantations:

### Navigation Magic

- `ls` - Reveals all items in your current location
- `ls -F` - Shows item types (directories end with `/`, executables with `*`)
- `cd directory` - Moves you to a different chamber
- `pwd` - Shows your exact location in the catacombs

### Viewing Spells

- `cat filename` - Displays entire scroll contents
- `less filename` - Reads long scrolls page by page (press 'q' to quit)
- `head filename` - Shows the beginning of a scroll (first 10 lines)
- `tail filename` - Shows the end of a scroll (last 10 lines)
- `wc filename` - Counts words, lines, and characters in a scroll

## 🗺️ Your Learning Path

The entrance connects to several chambers, each teaching different skills:

### 🏰 **THE CELLAR** (Next Recommended Step)

- **Access**: `cd cellar`
- **Focus**: Learning to distinguish between doorways and objects
- **Skills**: Advanced listing (`ls -F`), shell aliases, file type recognition
- **Reward**: Emerald amulet (your first treasure!)

### Hidden Chambers (Unlocked Later)

- **Chapel**: Prayer and reflection skills
- **Vault**: Treasure management and inventory systems
- **Scrap**: Symlinks, shortcuts, and portal creation
- **Armoury**: Combat skills and executable files

## 🎮 Game Mechanics

### Inventory System

As you progress, you'll collect treasures and items. Create an inventory variable to track your wealth:

```bash
export I=treasure_name,$I
echo $I  # Check your current inventory
```

### Shell Aliases

Make your spells more powerful with aliases:

```bash
alias ls='ls -F'  # Now 'ls' automatically shows file types
```

## 💡 Pro Tips for New Terminal Adventurers

1. **Read Every Scroll**: Each scroll contains crucial knowledge
2. **Experiment Safely**: Practice commands in this safe starting area
3. **Use Tab Completion**: Press Tab to auto-complete file names
4. **Ask for Help**: Use `--help` with most commands for guidance
5. **Stay Curious**: Hidden files (starting with `.`) contain secrets

## 🚨 Important Notes

- **Hidden Files**: Some files start with `.` and are hidden by default
- **Executable Files**: Files ending with `*` can be run as programs
- **Safety First**: This is a learning environment - experiment freely!

## 🎯 Your Mission

1. **Master the Basic Spells**: Practice all viewing commands on the scroll
2. **Explore Thoroughly**: Use `ls` to see all available paths
3. **Descend to the Cellar**: Your next major challenge awaits below
4. **Build Your Skills**: Each chamber teaches essential terminal abilities

## 🆘 Need Help?

- Stuck on a command? Try `command --help`
- Lost? Use `pwd` to see where you are
- Confused? Re-read the scrolls - they contain all the answers
- Really stuck? Check the project's GitLab repository for hints

## 🎊 Begin Your Adventure

When you're ready to start learning, read the scroll:

```bash
cat scroll
```

Then practice the viewing spells and prepare to descend into the cellar:

```bash
cd cellar
```

**May your terminal skills grow strong, brave adventurer!**

---

*Remember: Every expert was once a beginner. Take your time, experiment, and enjoy the journey of* *mastering the command line through adventure!*
