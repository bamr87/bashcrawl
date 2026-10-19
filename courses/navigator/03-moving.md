---
title: "Moving around"
teaches: [cd, relative paths, "..", "cd -"]
xp: 25
objectives:
  - text: "Walk two levels deep in one command: cd north/forest"
    when: {all: [{command: cd}, {cwd: /lab/navigator/north/forest}]}
    hint: "From the lab root: cd north/forest"
    solution: "cd north/forest"
  - text: "Climb up one level with cd .."
    when: {all: [{command: cd}, {arg: ".."}, {cwd: /lab/navigator/north}]}
    hint: ".. always means the parent directory"
    solution: "cd .."
  - text: "Jump straight back to where you just were with cd -"
    when: {all: [{command: cd}, {arg: "-"}, {cwd: /lab/navigator/north/forest}]}
    hint: "cd - toggles between your last two directories"
    solution: "cd -"
---
A path that does **not** start with `/` is **relative**: it starts from where you are now.

- `cd north/forest` goes into `north`, then into `forest`, in one step.
- `..` is the **parent** directory: `cd ..` climbs one level.
- `.` is the current directory itself.
- `cd -` jumps back to the previous directory, which is handy when you bounce between two places.

```
cd north/forest
pwd
cd ..
cd -
```

Real world: shells keep the previous directory in the variable `OLDPWD`, and `cd -` reads it. Two keystrokes save typing a long path twice.
