#!/bin/bash
# Test error cases and edge conditions

cd /Users/bamr87/github/terminal-illness
source .venv/bin/activate

echo "=== TESTING ERROR CASES AND EDGE CONDITIONS ==="
echo ""

(
    sleep 1
    echo "y"  # Load previous save
    sleep 1
    echo ""  # Default mode
    sleep 2
    
    # Test invalid commands
    echo "invalid_command"
    sleep 1
    echo "xyz123"
    sleep 1
    
    # Test cd to non-existent directory
    echo "cd /nonexistent"
    sleep 1
    
    # Test cat on non-existent file
    echo "cat /fake/file.txt"
    sleep 1
    
    # Test grep with wrong arguments
    echo "grep"
    sleep 1
    echo "grep pattern"
    sleep 1
    
    # Test mkdir without args
    echo "mkdir"
    sleep 1
    
    # Test cd with ..
    echo "cd /dungeon"
    sleep 1
    echo "ls"
    sleep 1
    echo "cd .."
    sleep 1
    echo "pwd"
    sleep 1
    
    # Test relative paths
    echo "cd home"
    sleep 1
    echo "pwd"
    sleep 1
    echo "cd hero"
    sleep 1
    echo "pwd"
    sleep 1
    
    # Test ls with paths
    echo "ls ."
    sleep 1
    echo "ls .."
    sleep 1
    echo "ls workshop"
    sleep 1
    
    # Explore dungeon
    echo "cd /dungeon"
    sleep 1
    echo "ls"
    sleep 1
    echo "mkdir treasure"
    sleep 1
    echo "cd treasure"
    sleep 1
    echo "touch gold.txt"
    sleep 1
    echo "ls"
    sleep 1
    
    # Test grep patterns
    echo "cd /forest"
    sleep 1
    echo "grep spell scroll.txt"
    sleep 1
    echo "grep pwd scroll.txt"
    sleep 1
    echo "grep NOTFOUND scroll.txt"
    sleep 1
    
    echo "exit"
    
) | python -m ti

echo ""
echo "=== ERROR TESTING COMPLETE ==="
