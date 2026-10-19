---
title: "Look around"
teaches: [ls, ls -a, ls -F, hidden files]
xp: 20
objectives:
  - text: "List what is in the lab with ls"
    when: {all: [{command: ls}, {cwd: /lab/navigator}, {output_includes: north}]}
    hint: "From /lab/navigator, type ls"
    solution: "ls"
  - text: "Reveal the hidden entries in south: ls -a south"
    when: {all: [{command: ls}, {option: a}, {output_includes: .cave}]}
    hint: "The -a flag means all, including names that start with a dot"
    solution: "ls -a south"
  - text: "Tell directories from files with ls -F"
    when: {all: [{command: ls}, {option: F}, {output_includes: "north/"}]}
    hint: "-F adds a / after every directory"
    solution: "ls -F"
---
`ls` lists a directory: the current one by default, or any directory you name (`ls south`).

**Flags** change what a command does. They start with a dash:

- `ls -a` shows **all** entries, including hidden ones. A name that starts with `.` is hidden from a plain `ls`. That's how config files like `.bashrc` stay out of your way.
- `ls -F` adds a marker after each name: `/` for a directory, `*` for an executable.

Flags combine: `ls -aF` is the same as `ls -a -F`.

```
ls
ls -a south
ls -F
```

Real world: `ls -la` is probably the most-typed command on Earth. It's the first look inside any directory, hidden files and all.
