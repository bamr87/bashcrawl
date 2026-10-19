#!/usr/bin/env bash
# ============================================================================
# Bashcrawl play shell — lib/playrc.sh
#
# The rcfile for `bashcrawl play`: an interactive bash subshell started in
# entrance/. It deliberately does NOT source your ~/.bashrc, so aliases and
# functions from your own setup can't change how the lesson commands behave.
# Your game state ($I, $HP) lives in this subshell's environment; `exit`
# returns you to your own shell.
# ============================================================================

# Show the room you are standing in, like a dungeon map marker.
PS1='\[\e[36m\]bashcrawl\[\e[0m\]:\[\e[33m\]\W\[\e[0m\] $ '
export PS1

# Contextual help from anywhere in the dungeon.
hint() { bash "${BASHCRAWL_ROOT:?}/help.sh" "$@"; }
