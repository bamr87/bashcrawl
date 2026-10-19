---
title: "Aliases"
teaches: [alias, shortcuts]
xp: 25
objectives:
  - text: "Make a shortcut: alias ll='ls -F'"
    when: {exists: aliases.ll}
    hint: "Quote the command so the space stays inside it"
    solution: "alias ll='ls -F'"
  - text: "Use it: type ll"
    when: {all: [{command: ls}, {option: F}, {exists: aliases.ll}, {not: {line_includes: ls}}]}
    hint: "Just ll, and the shell expands it to ls -F"
    solution: "ll"
  - text: "List your aliases: alias"
    when: {all: [{command: alias}, {output_includes: "alias ll="}]}
    hint: "alias with no arguments lists them all"
    solution: "alias"
---
An **alias** is a nickname for a longer command line. The shell swaps it in before running anything.

```
alias ll='ls -F'
ll
alias
```

The quotes matter: without them, `alias ll=ls -F` gives the alias only `ls`, and `-F` becomes a separate argument.

Real world: aliases live in `~/.bashrc` or `~/.zshrc`, so they load in every new shell. Common ones are `ll`, `la`, `..='cd ..'`, and `gs='git status'`.
