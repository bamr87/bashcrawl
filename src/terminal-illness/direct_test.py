#!/usr/bin/env python3
"""
Direct interactive gameplay testing
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ti.game_state import GameState
from ti.vfs import VirtualFileSystem
from ti.terminal_engine import TerminalEngine

def test_gameplay():
    """Run interactive test scenarios"""
    
    print("=" * 60)
    print("DIRECT INTERACTIVE GAMEPLAY TEST")
    print("=" * 60)
    
    # Load existing save
    state = GameState.load()
    vfs = VirtualFileSystem()
    engine = TerminalEngine(state, vfs)
    
    print(f"\n📊 Game State:")
    print(f"   Player: {state.player_name}")
    print(f"   Quests Completed: {len(state.completed_quest_ids)}/7")
    print(f"   XP: {state.experience_points}")
    print(f"   Current Location: {engine._cwd}")
    print(f"   Learned Commands: {', '.join(state.learned_commands)}")
    
    # Test error conditions
    print("\n" + "=" * 60)
    print("TESTING ERROR CONDITIONS")
    print("=" * 60)
    
    test_cases = [
        ("Invalid command", "notacommand", []),
        ("cd to non-existent", "cd", ["/nonexistent"]),
        ("cat non-existent file", "cat", ["/fake.txt"]),
        ("grep no args", "grep", []),
        ("mkdir no args", "mkdir", []),
        ("touch no args", "touch", []),
    ]
    
    for desc, cmd, args in test_cases:
        print(f"\n🧪 Test: {desc}")
        print(f"   Command: {cmd} {' '.join(args)}")
        try:
            if cmd not in engine._registry:
                print(f"   ❌ Unknown command")
            else:
                kind, title, message = engine._registry[cmd].handler(args)
                print(f"   ✅ [{kind}] {message[:80]}...")
        except Exception as e:
            print(f"   ⚠️  Error: {e}")
    
    # Test valid navigation and exploration
    print("\n" + "=" * 60)
    print("TESTING NAVIGATION & EXPLORATION")
    print("=" * 60)
    
    navigation_tests = [
        ("Navigate to dungeon", "cd", ["/dungeon"]),
        ("Check dungeon contents", "ls", []),
        ("Create treasure room", "mkdir", ["treasure"]),
        ("Enter treasure", "cd", ["treasure"]),
        ("Create loot", "touch", ["gold.txt"]),
        ("List treasure", "ls", []),
        ("Go back to root", "cd", ["/"]),
        ("Check location", "pwd", []),
    ]
    
    for desc, cmd, args in navigation_tests:
        print(f"\n🎮 Action: {desc}")
        print(f"   Command: {cmd} {' '.join(args)}")
        try:
            kind, title, message = engine._registry[cmd].handler(args)
            if cmd == "cd" and args:
                engine._cwd = message.split()[-1] if "Moved to" in message else engine._cwd
            print(f"   ✅ [{kind}] {message}")
            print(f"   📍 Current: {engine._cwd}")
        except Exception as e:
            print(f"   ⚠️  Error: {e}")
    
    # Test file operations
    print("\n" + "=" * 60)
    print("TESTING FILE OPERATIONS")
    print("=" * 60)
    
    file_tests = [
        ("Read scroll", "cat", ["/forest/scroll.txt"]),
        ("Search for 'Whisper'", "grep", ["Whisper", "/forest/scroll.txt"]),
        ("Search for 'spell'", "grep", ["spell", "/forest/scroll.txt"]),
        ("Search for 'pwd'", "grep", ["pwd", "/forest/scroll.txt"]),
        ("Read readme", "cat", ["/home/hero/readme.txt"]),
    ]
    
    for desc, cmd, args in file_tests:
        print(f"\n📄 Test: {desc}")
        print(f"   Command: {cmd} {' '.join(args)}")
        try:
            kind, title, message = engine._registry[cmd].handler(args)
            print(f"   ✅ [{kind}]")
            if message:
                print(f"   📝 Content: {message[:100]}{'...' if len(message) > 100 else ''}")
        except Exception as e:
            print(f"   ⚠️  Error: {e}")
    
    # Test utility commands
    print("\n" + "=" * 60)
    print("TESTING UTILITY COMMANDS")
    print("=" * 60)
    
    utility_tests = [
        ("Get help", "help", []),
        ("Ask Merlin", "merlin", []),
        ("Save progress", "save", []),
    ]
    
    for desc, cmd, args in utility_tests:
        print(f"\n🛠️  Test: {desc}")
        print(f"   Command: {cmd}")
        try:
            kind, title, message = engine._registry[cmd].handler(args)
            print(f"   ✅ [{kind}]")
            lines = message.split('\n')
            if len(lines) > 5:
                print(f"   📝 Output: (showing first 5 lines)")
                for line in lines[:5]:
                    print(f"      {line}")
            else:
                print(f"   📝 Output: {message}")
        except Exception as e:
            print(f"   ⚠️  Error: {e}")
    
    # Test filesystem exploration
    print("\n" + "=" * 60)
    print("FILESYSTEM EXPLORATION")
    print("=" * 60)
    
    print("\n🗂️  Virtual Filesystem Structure:")
    
    def explore_dir(path, vfs, indent=0):
        try:
            items = vfs.ls('/', path)
            for item in items:
                item_path = f"{path}/{item}".replace('//', '/')
                node = vfs._traverse(item_path)
                if hasattr(node, 'children'):  # Directory
                    print("  " * indent + f"📁 {item}/")
                    explore_dir(item_path, vfs, indent + 1)
                else:  # File
                    print("  " * indent + f"📄 {item}")
        except:
            pass
    
    print("📁 /")
    explore_dir('/', vfs, 1)
    
    # Final status
    print("\n" + "=" * 60)
    print("FINAL GAME STATUS")
    print("=" * 60)
    
    state = GameState.load()
    print(f"✅ All Quests: {'COMPLETE' if len(state.completed_quest_ids) >= 7 else 'IN PROGRESS'}")
    print(f"✅ Total XP: {state.experience_points}/550")
    print(f"✅ Commands Mastered: {len(state.learned_commands)}")
    print(f"✅ Current Location: {state.current_location}")
    print(f"✅ Session History: {len(state.session_history)} entries")
    
    print("\n" + "=" * 60)
    print("INTERACTIVE GAMEPLAY TEST COMPLETE!")
    print("=" * 60)

if __name__ == "__main__":
    test_gameplay()
