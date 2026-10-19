---
title: "Making it executable"
teaches: [chmod, "chmod +x", "ls -F", permissions]
xp: 30
objectives:
  - text: "Look at the scripts first: ls -F inbox"
    when: {all: [{command: ls}, {option: F}, {output_includes: spell.sh}]}
    hint: "ls -F marks executables with a *"
    solution: "ls -F inbox"
  - text: "Make the spell executable: chmod +x inbox/spell.sh"
    when: {all: [{command: chmod}, {arg: "+x"}, {args_contains: spell.sh}]}
    hint: "+x adds the execute permission"
    solution: "chmod +x inbox/spell.sh"
  - text: "Look again: ls -F inbox now shows spell.sh*"
    when: {all: [{command: ls}, {option: F}, {output_includes: "spell.sh*"}]}
    hint: "The * after the name means executable"
    solution: "ls -F inbox"
---
Every file carries **permissions**: who may **r**ead, **w**rite and e**x**ecute it. A script is only text until it has the execute permission:

- `chmod +x FILE` adds execute, and `chmod -x FILE` removes it.
- `ls -F` marks executables with `*`, and `ls -l` (on a real system) shows the full `rwxr-xr-x` string.

```
ls -F inbox
chmod +x inbox/spell.sh
ls -F inbox
```

Real world: "Permission denied" when you run `./deploy.sh` almost always means a missing `chmod +x`. The numeric form, `chmod 755 FILE`, sets all three permission groups at once.
