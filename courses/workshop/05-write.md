---
title: "Writing files from the shell"
teaches: [echo, ">", ">>", cat]
xp: 25
objectives:
  - text: "Write a note: echo hello forge > note.txt"
    when: {file_contains: /lab/workshop/note.txt, text: hello}
    hint: "echo prints text; > sends it into a file"
    solution: "echo hello forge > note.txt"
  - text: "Add a second line: echo second line >> note.txt"
    when: {all: [{file_contains: /lab/workshop/note.txt, text: hello}, {file_contains: /lab/workshop/note.txt, text: second}]}
    hint: ">> appends instead of replacing"
    solution: "echo second line >> note.txt"
  - text: "Read it back: cat note.txt"
    when: {all: [{command: cat}, {output_includes: second}]}
    hint: "cat note.txt"
    solution: "cat note.txt"
---
You don't need an editor for small files. `echo` plus a redirect is enough:

```
echo hello forge > note.txt
echo second line >> note.txt
cat note.txt
```

The rule from the pipelines course still holds: `>` replaces, `>>` appends.

Real world: `echo "export PATH=$HOME/bin:$PATH" >> ~/.bashrc` is how a lot of install instructions add a line to your shell config. Now you know why it's `>>`.
