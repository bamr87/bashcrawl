---
title: "Reading from afar"
teaches: [relative paths, absolute paths, cat]
xp: 25
objectives:
  - text: "From the forest, read the river note without moving: cat ../../south/river.txt"
    when: {all: [{command: cat}, {args_contains: "../"}, {output_includes: "river runs south"}]}
    hint: "From north/forest, two .. climb to the lab root; then go into south"
    solution: "cat ../../south/river.txt"
  - text: "Read the compass by its absolute path"
    when: {all: [{command: cat}, {arg: /lab/navigator/north/compass.txt}]}
    hint: "cat /lab/navigator/north/compass.txt"
    solution: "cat /lab/navigator/north/compass.txt"
  - text: "Go back to the lab root in a single cd"
    when: {all: [{command: cd}, {cwd: /lab/navigator}]}
    hint: "Either cd ../.. or cd /lab/navigator works"
    solution: "cd /lab/navigator"
---
You don't have to walk somewhere to read a file there. A path can point at it from anywhere:

- **Relative:** `../../south/river.txt` climbs two levels, then goes down into `south`.
- **Absolute:** `/lab/navigator/north/compass.txt` works from any directory.

`cat FILE` prints a file's contents.

```
cat ../../south/river.txt
cat /lab/navigator/north/compass.txt
```

Which one should you use? Relative paths are short and work wherever you copy the whole tree. Absolute paths are unambiguous, which is why scripts and config files prefer them.
