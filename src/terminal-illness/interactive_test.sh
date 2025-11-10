#!/bin/bash
# Interactive gameplay simulation for Terminal Illness

cd /Users/bamr87/github/terminal-illness
source .venv/bin/activate

echo "=== SIMULATING FULL INTERACTIVE GAMEPLAY ==="
echo ""
echo "Starting fresh game..."
echo ""

# Simulate a complete playthrough with realistic timing
(
    sleep 1
    echo "n"  # Don't load save (fresh start)
    sleep 1
    echo "TestPlayer"  # Player name
    sleep 1
    echo "classic"  # Choose classic mode
    sleep 2
    
    # Quest 1: pwd
    echo "pwd"
    sleep 2
    
    # Quest 2: ls
    echo "ls"
    sleep 2
    
    # Explore a bit
    echo "ls /forest"
    sleep 2
    echo "cat /forest/scroll.txt"
    sleep 2
    
    # Quest 3: cd to /home/hero
    echo "cd /home/hero"
    sleep 2
    echo "ls"
    sleep 2
    echo "cat readme.txt"
    sleep 2
    
    # Quest 4: mkdir workshop
    echo "mkdir workshop"
    sleep 2
    echo "ls"
    sleep 2
    
    # Quest 5: touch notes.txt in workshop
    echo "cd workshop"
    sleep 2
    echo "touch notes.txt"
    sleep 2
    echo "ls"
    sleep 2
    
    # Quest 6: cat notes.txt
    echo "cat notes.txt"
    sleep 2
    
    # Add some content and read it
    echo "cd .."
    sleep 1
    echo "pwd"
    sleep 2
    
    # Quest 7: grep in /forest
    echo "cd /forest"
    sleep 2
    echo "ls"
    sleep 1
    echo "grep Whisper scroll.txt"
    sleep 2
    
    # Try merlin for help
    echo "merlin"
    sleep 2
    
    # Check help
    echo "help"
    sleep 2
    
    # Save and exit
    echo "save"
    sleep 1
    echo "exit"
    
) | python -m ti

echo ""
echo "=== GAMEPLAY SIMULATION COMPLETE ==="
