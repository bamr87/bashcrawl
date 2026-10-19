---
title: "Your first pipe"
teaches: [pipes, "|", "wc -l", head]
xp: 30
objectives:
  - text: "Count the log's lines through a pipe: cat guild.log | wc -l"
    when: {all: [{command: wc}, {option: l}, {piped: true}]}
    hint: "The | sends cat's output into wc -l"
    solution: "cat guild.log | wc -l"
  - text: "Count only the deposits: grep deposit guild.log | wc -l"
    when: {all: [{command: wc}, {piped: true}, {line_includes: grep}, {line_includes: deposit}]}
    hint: "grep picks the deposit lines; wc -l counts them"
    solution: "grep deposit guild.log | wc -l"
  - text: "Keep just the first 5 lines of the log: cat guild.log | head -n 5"
    when: {all: [{command: head}, {piped: true}]}
    hint: "head works on piped input too"
    solution: "cat guild.log | head -n 5"
---
The `|` (pipe) takes everything the command on its left **prints** and feeds it to the command on its right as **input**. Neither command knows the other exists.

```
cat guild.log | wc -l
grep deposit guild.log | wc -l
```

The second line asks *how many deposits were there?* `grep` answers "which lines?", `wc -l` answers "how many?", and the pipe composes them into a question neither tool can answer alone.

Real world: `ps aux | grep python | wc -l` counts how many Python processes are running. Same shape, different data.
