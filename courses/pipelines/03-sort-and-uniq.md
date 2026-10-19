---
title: "Sorting and counting"
teaches: [sort, uniq, "uniq -c"]
xp: 30
objectives:
  - text: "Sort names.txt alphabetically"
    when: {all: [{command: sort}, {args_contains: names.txt}]}
    hint: "sort names.txt"
    solution: "sort names.txt"
  - text: "See why order matters: uniq names.txt (without sorting first)"
    when: {all: [{command: uniq}, {args_contains: names.txt}, {piped: false}]}
    hint: "Run uniq straight on the file and compare with the sorted version"
    solution: "uniq names.txt"
  - text: "List each name once: sort names.txt | uniq"
    when: {all: [{command: uniq}, {piped: true}, {line_includes: sort}]}
    hint: "Sort first, so duplicates sit next to each other"
    solution: "sort names.txt | uniq"
  - text: "Count each name: sort names.txt | uniq -c"
    when: {all: [{command: uniq}, {option: c}, {piped: true}]}
    hint: "-c prefixes each line with how many times it appeared"
    solution: "sort names.txt | uniq -c"
---
- `sort` puts lines in order: `-r` reverses it, and `-n` sorts by number instead of by text.
- `uniq` collapses **adjacent** duplicate lines, and `-c` counts them.

That word *adjacent* matters. `uniq` only compares each line with the one right before it, so you nearly always `sort` first:

```
uniq names.txt
sort names.txt | uniq
sort names.txt | uniq -c
```

Real world: `sort | uniq -c` is the shell's GROUP BY. It's how you count visitors per IP, errors per type, or commits per author.
