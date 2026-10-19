---
title: "Removing things"
teaches: [rm]
xp: 20
objectives:
  - text: "Delete the junk file: rm inbox/junk.old"
    when: {all: [{command: rm}, {not: {file_exists: /lab/workshop/inbox/junk.old}}]}
    hint: "rm inbox/junk.old"
    solution: "rm inbox/junk.old"
  - text: "Confirm it's gone: ls inbox"
    when: {all: [{command: ls}, {args_contains: inbox}, {not: {output_includes: junk}}]}
    hint: "ls inbox"
    solution: "ls inbox"
---
`rm FILE` deletes a file. **There is no trash can.** A shell `rm` is final.

That's why the habit is: **look, then delete.** Run `ls` (or `echo` the same glob) first, read what it would touch, and only then `rm`.

```
ls inbox
rm inbox/junk.old
ls inbox
```

Type `explain rm inbox/junk.old` before running it. `explain` flags dangerous commands.

Real world: `rm -rf` (recursive, force) on the wrong path is the classic career-ending typo. Many admins alias `rm` to `rm -i`, which asks before each deletion.
