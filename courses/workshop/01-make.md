---
title: "Making things"
teaches: [mkdir, touch]
xp: 20
objectives:
  - text: "Build a new directory: mkdir archive"
    when: {dir_exists: /lab/workshop/archive}
    hint: "From /lab/workshop: mkdir archive"
    solution: "mkdir archive"
  - text: "Create an empty file inside it: touch archive/index.txt"
    when: {file_exists: /lab/workshop/archive/index.txt}
    hint: "touch makes an empty file if none exists"
    solution: "touch archive/index.txt"
  - text: "Check your work: ls archive"
    when: {all: [{command: ls}, {output_includes: index.txt}]}
    hint: "ls archive"
    solution: "ls archive"
---
Start in your lab: `cd /lab/workshop`.

- `mkdir NAME` makes a directory. On a real system, `mkdir -p a/b/c` makes the whole chain at once.
- `touch FILE` creates an empty file, or, if the file exists, updates its modification time and leaves the content alone.

```
mkdir archive
touch archive/index.txt
ls archive
```

Real world: `touch` is how you create a placeholder (`.gitkeep`) or a marker that a script checks for, like the `.statue_defeated` flag in this very game.
