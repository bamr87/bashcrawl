---
title: "Saving your work"
teaches: [">", ">>", redirection]
xp: 30
objectives:
  - text: "Save alice's lines to a file: grep alice guild.log > alice.txt"
    when: {file_contains: /lab/pipelines/alice.txt, text: alice}
    hint: "> sends the output into a file instead of the screen"
    solution: "grep alice guild.log > alice.txt"
  - text: "Append bob's lines to the same file: grep bob guild.log >> alice.txt"
    when: {all: [{file_contains: /lab/pipelines/alice.txt, text: alice}, {file_contains: /lab/pipelines/alice.txt, text: bob}]}
    hint: ">> adds to the end; a single > would replace alice's lines"
    solution: "grep bob guild.log >> alice.txt"
  - text: "Write a clean roster: sort names.txt | uniq > roster.txt"
    when: {all: [{file_contains: /lab/pipelines/roster.txt, text: dmitri}, {line_includes: uniq}]}
    hint: "Redirect the end of a whole pipeline"
    solution: "sort names.txt | uniq > roster.txt"
---
Output doesn't have to go to the screen:

- `cmd > FILE` writes the output into FILE, **replacing** whatever was there.
- `cmd >> FILE` **appends** to the end of FILE.

The redirect applies to the end of the whole pipeline:

```
grep alice guild.log > alice.txt
grep bob guild.log >> alice.txt
sort names.txt | uniq > roster.txt
cat roster.txt
```

Careful: `>` doesn't ask before it overwrites. `sort names.txt > names.txt` empties the file before `sort` even reads it. (Your lab is safe to break, and `lab reset` restores it.)

Real world: `command > output.txt 2>&1` saves both normal output and errors, which is how cron jobs keep their logs.
