---
title: "Open the scroll"
teaches: [cat, file]
xp: 20
objectives:
  - text: "Print the whole ballad with cat"
    when: {all: [{command: cat}, {args_contains: ballad.txt}]}
    hint: "From /lab/reading: cat ballad.txt"
    solution: "cat ballad.txt"
  - text: "Ask what kind of thing ballad.txt is with file"
    when: {all: [{command: file}, {args_contains: ballad.txt}]}
    hint: "file ballad.txt"
    solution: "file ballad.txt"
  - text: "Ask the same about notes"
    when: {all: [{command: file}, {args_contains: notes}]}
    hint: "file notes"
    solution: "file notes"
---
Start in your lab: `cd /lab/reading`.

- `cat FILE` prints a file from top to bottom. The name comes from *concatenate*, because `cat` can join files together.
- `file PATH` tells you **what** something is before you open it: text, a directory, a program.

```
cat ballad.txt
file ballad.txt
file notes
```

Real world: run `file` on anything you downloaded before you `cat` it. Printing a binary file sprays garbage characters into your terminal.
