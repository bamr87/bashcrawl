#!/usr/bin/env python3
"""
Comprehensive Terminal Illness Game Explorer
Tests all commands, quests, and edge cases
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ti.game_state import GameState
from ti.vfs import VirtualFileSystem
from ti.terminal_engine import TerminalEngine
from ti.quests import quest_list, check_quest_completion

def reset_game():
    """Reset to fresh game state"""
    save_file = os.path.join(os.getcwd(), ".ti_save.json")
    if os.path.exists(save_file):
        os.remove(save_file)
    return GameState(), VirtualFileSystem()

def simulate_command(engine, command, args=None):
    """Simulate running a command and return the result"""
    if args is None:
        args = []
    try:
        kind, title, message = engine._registry[command].handler(args)
        if command not in engine.state.learned_commands:
            engine.state.learned_commands.append(command)
        engine._maybe_advance_quest()
        return f"[{kind}] {message}"
    except Exception as e:
        return f"[error] {e}"

def explore_filesystem(engine, vfs):
    """Explore the virtual filesystem structure"""
    print("=== FILESYSTEM EXPLORATION ===")

    # Check root directory
    print(f"Root contents: {vfs.ls('/', '/')}")
    print(f"Home contents: {vfs.ls('/', '/home')}")
    print(f"Hero contents: {vfs.ls('/', '/home/hero')}")
    print(f"Forest contents: {vfs.ls('/', '/forest')}")
    print(f"Dungeon contents: {vfs.ls('/', '/dungeon')}")

    # Read seeded files
    try:
        readme = vfs.read_file('/', '/home/hero/readme.txt')
        print(f"Readme content: {readme}")
    except:
        print("Could not read readme")

    try:
        scroll = vfs.read_file('/', '/forest/scroll.txt')
        print(f"Scroll content: {scroll}")
    except:
        print("Could not read scroll")

def test_all_commands(engine):
    """Test every available command"""
    print("\n=== COMMAND TESTING ===")

    commands_to_test = [
        ("pwd", []),
        ("ls", []),
        ("ls", ["/home"]),
        ("cd", ["/home"]),
        ("pwd", []),
        ("ls", []),
        ("cd", ["hero"]),
        ("pwd", []),
        ("ls", []),
        ("mkdir", ["test_dir"]),
        ("ls", []),
        ("touch", ["test.txt"]),
        ("ls", []),
        ("cat", ["readme.txt"]),
        ("cat", ["test.txt"]),
        ("cd", ["/forest"]),
        ("pwd", []),
        ("ls", []),
        ("grep", ["Whisper", "scroll.txt"]),
        ("cd", ["/"]),
        ("help", []),
        ("merlin", []),
    ]

    for cmd, args in commands_to_test:
        result = simulate_command(engine, cmd, args)
        print(f"{cmd} {' '.join(args)} -> {result}")

def complete_all_quests():
    """Complete all quests in sequence"""
    print("\n=== QUEST COMPLETION WALKTHROUGH ===")

    state, vfs = reset_game()
    engine = TerminalEngine(state, vfs)

    quests = quest_list()

    # Quest 0: pwd
    print(f"Quest 0: {quests[0].title}")
    print(f"Objective: {quests[0].objective}")
    result = simulate_command(engine, "pwd", [])
    print(f"Result: {result}")
    print(f"Completed: {len(state.completed_quest_ids)}, XP: {state.experience_points}")

    # Quest 1: ls
    print(f"\nQuest 1: {quests[1].title}")
    print(f"Objective: {quests[1].objective}")
    result = simulate_command(engine, "ls", [])
    print(f"Result: {result}")
    print(f"Completed: {len(state.completed_quest_ids)}, XP: {state.experience_points}")

    # Quest 2: cd to /home/hero
    print(f"\nQuest 2: {quests[2].title}")
    print(f"Objective: {quests[2].objective}")
    result = simulate_command(engine, "cd", ["/home/hero"])
    print(f"Result: {result}")
    print(f"Completed: {len(state.completed_quest_ids)}, XP: {state.experience_points}")

    # Quest 3: mkdir workshop
    print(f"\nQuest 3: {quests[3].title}")
    print(f"Objective: {quests[3].objective}")
    result = simulate_command(engine, "mkdir", ["workshop"])
    print(f"Result: {result}")
    print(f"Completed: {len(state.completed_quest_ids)}, XP: {state.experience_points}")

    # Quest 4: touch notes.txt
    print(f"\nQuest 4: {quests[4].title}")
    print(f"Objective: {quests[4].objective}")
    result = simulate_command(engine, "cd", ["workshop"])
    print(f"cd workshop: {result}")
    result = simulate_command(engine, "touch", ["notes.txt"])
    print(f"Result: {result}")
    print(f"Completed: {len(state.completed_quest_ids)}, XP: {state.experience_points}")

    # Quest 5: cat notes.txt
    print(f"\nQuest 5: {quests[5].title}")
    print(f"Objective: {quests[5].objective}")
    result = simulate_command(engine, "cat", ["notes.txt"])
    print(f"Result: {result}")
    print(f"Completed: {len(state.completed_quest_ids)}, XP: {state.experience_points}")

    # Quest 6: grep in /forest
    print(f"\nQuest 6: {quests[6].title}")
    print(f"Objective: {quests[6].objective}")
    result = simulate_command(engine, "cd", ["/forest"])
    print(f"cd /forest: {result}")
    result = simulate_command(engine, "grep", ["Whisper", "scroll.txt"])
    print(f"Result: {result}")
    print(f"Completed: {len(state.completed_quest_ids)}, XP: {state.experience_points}")

    print(f"\nFinal State: {len(state.completed_quest_ids)} quests completed, {state.experience_points} XP")
    print(f"Learned commands: {state.learned_commands}")

def test_edge_cases(engine):
    """Test edge cases and error conditions"""
    print("\n=== EDGE CASE TESTING ===")

    test_cases = [
        ("cd", ["/nonexistent"], "Non-existent directory"),
        ("cat", ["/nonexistent/file.txt"], "Non-existent file"),
        ("mkdir", ["/"], "Create dir at root"),
        ("touch", ["/existing"], "Touch existing path"),
        ("grep", ["pattern", "/nonexistent"], "Grep non-existent file"),
        ("ls", ["/nonexistent"], "List non-existent directory"),
        ("cd", [".."], "Go up from root"),
        ("cd", ["."], "Stay in place"),
        ("pwd", [], "Print working directory"),
    ]

    for cmd, args, description in test_cases:
        try:
            result = simulate_command(engine, cmd, args)
            print(f"{description}: {result}")
        except Exception as e:
            print(f"{description}: ERROR - {e}")

def test_path_completions(engine, vfs):
    """Test path completion functionality"""
    print("\n=== PATH COMPLETION TESTING ===")

    # Test from different directories
    test_dirs = ["/", "/home", "/home/hero"]

    for cwd in test_dirs:
        engine._cwd = cwd
        print(f"\nFrom {cwd}:")
        completions = vfs.match_paths(cwd, "")
        print(f"  All items: {completions}")
        completions = vfs.match_paths(cwd, "r")
        print(f"  Items starting with 'r': {completions}")

def main():
    print("Terminal Illness - Comprehensive Game Explorer")
    print("=" * 50)

    # Reset and explore filesystem
    state, vfs = reset_game()
    engine = TerminalEngine(state, vfs)

    explore_filesystem(engine, vfs)

    # Test all commands
    test_all_commands(engine)

    # Complete all quests
    complete_all_quests()

    # Test edge cases
    state, vfs = reset_game()
    engine = TerminalEngine(state, vfs)
    test_edge_cases(engine)

    # Test completions
    test_path_completions(engine, vfs)

    print("\n=== EXPLORATION COMPLETE ===")
    print("All paths, commands, and possibilities have been tested!")

if __name__ == "__main__":
    main()