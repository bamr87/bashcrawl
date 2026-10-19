---
title: "How big is it?"
teaches: [wc, "wc -l", "wc -w"]
xp: 20
objectives:
  - text: "Count the ballad's lines: wc -l ballad.txt"
    when: {all: [{command: wc}, {option: l}, {args_contains: ballad.txt}]}
    hint: "-l counts lines"
    solution: "wc -l ballad.txt"
  - text: "Count its words with wc -w"
    when: {all: [{command: wc}, {option: w}, {args_contains: ballad.txt}]}
    hint: "-w counts words"
    solution: "wc -w ballad.txt"
  - text: "Get lines, words and bytes at once with a plain wc"
    when: {all: [{command: wc}, {args_contains: ballad.txt}, {not: {args_contains: "-"}}]}
    hint: "wc with no flags prints all three counts"
    solution: "wc ballad.txt"
---
`wc` (*word count*) measures text:

- `wc -l` counts **lines**.
- `wc -w` counts **words**.
- `wc -c` counts **bytes**.
- a plain `wc` prints lines, words and bytes together.

```
wc -l ballad.txt
wc ballad.txt
```

Real world: "how many?" is the most common question you'll ask a terminal: how many errors, users, or files. `wc -l` is the usual answer, especially at the end of a pipeline, which is a later course.
