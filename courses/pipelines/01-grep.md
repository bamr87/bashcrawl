---
title: "Searching with grep"
teaches: [grep, "grep -c", "grep -v", "grep -i"]
xp: 25
objectives:
  - text: "Find every line about alice: grep alice guild.log"
    when: {all: [{command: grep}, {arg: alice}, {args_contains: guild.log}]}
    hint: "grep PATTERN FILE, from /lab/pipelines"
    solution: "grep alice guild.log"
  - text: "Count bob's lines instead of printing them: grep -c bob guild.log"
    when: {all: [{command: grep}, {option: c}, {arg: bob}]}
    hint: "-c prints only the number of matching lines"
    solution: "grep -c bob guild.log"
  - text: "Show every line that is NOT a login: grep -v login guild.log"
    when: {all: [{command: grep}, {option: v}, {arg: login}]}
    hint: "-v inverts the match"
    solution: "grep -v login guild.log"
  - text: "Catch the alert whatever its case: grep -i alert guild.log"
    when: {all: [{command: grep}, {option: i}, {output_includes: ALERT}]}
    hint: "-i ignores upper and lower case"
    solution: "grep -i alert guild.log"
---
Start in your lab: `cd /lab/pipelines`.

`grep PATTERN FILE` prints every line of FILE that contains PATTERN. Its flags reshape the question:

- `-c`: *how many* lines match?
- `-v`: show the lines that *don't* match.
- `-i`: ignore case, so `alert` finds `ALERT`.
- `-n`: prefix each match with its line number.

```
grep alice guild.log
grep -c bob guild.log
grep -v login guild.log
```

Real world: `grep -i error /var/log/syslog` is step one of nearly every investigation. The pattern is a *regular expression*, so `grep '^2026-03-01 23'` finds everything from 23:00 on.
