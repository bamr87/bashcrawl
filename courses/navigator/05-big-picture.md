---
title: "The big picture"
teaches: [tree, find]
xp: 30
objectives:
  - text: "Draw the whole lab as a tree: tree /lab/navigator"
    when: {all: [{command: tree}, {output_includes: forest}]}
    hint: "tree DIR draws every directory under DIR"
    solution: "tree /lab/navigator"
  - text: "Hunt the gem by name: find /lab/navigator -name gem.txt"
    when: {all: [{command: find}, {output_includes: gem.txt}]}
    hint: "find walks every directory, hidden ones too, and -name filters by file name"
    solution: "find /lab/navigator -name gem.txt"
  - text: "Read the gem's message"
    when: {all: [{command: cat}, {output_includes: "hidden gem"}]}
    hint: "Use the path find printed: cat /lab/navigator/south/.cave/gem.txt"
    solution: "cat /lab/navigator/south/.cave/gem.txt"
---
Moving around with `cd` and `ls` is fine for a few directories. For a whole tree you want the overview:

- `tree DIR` draws the structure under `DIR`.
- `find DIR -name NAME` searches every directory under `DIR`, hidden ones included, and prints the path of each match.
- `find DIR -type d` lists only directories, and `-type f` lists only files.

```
tree /lab/navigator
find /lab/navigator -name gem.txt
```

Real world: `find / -name nginx.conf` is how you locate a config file on a machine you have never seen before. Pipe the result into other tools, and that comes in a later course.
