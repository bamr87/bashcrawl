---
title: "Capstone: the guild report"
teaches: [pipelines, "sort -rn", "head -n 1"]
xp: 50
objectives:
  - text: "Find the member with the most deposits: grep deposit ledger.csv | cut -d, -f2 | sort | uniq -c | sort -rn | head -n 1"
    when: {all: [{command: head}, {piped: true}, {line_includes: "uniq -c"}, {line_includes: "sort -rn"}, {output_includes: alice}]}
    hint: "Build it one stage at a time and run it after each |"
    solution: "grep deposit ledger.csv | cut -d, -f2 | sort | uniq -c | sort -rn | head -n 1"
  - text: "Save the full ranking: grep deposit ledger.csv | cut -d, -f2 | sort | uniq -c | sort -rn > report.txt"
    when: {all: [{file_contains: /lab/pipelines/report.txt, text: cara}, {line_includes: "sort -rn"}]}
    hint: "Same pipeline, minus head, plus > report.txt"
    solution: "grep deposit ledger.csv | cut -d, -f2 | sort | uniq -c | sort -rn > report.txt"
---
Time to put the whole forge to work. The question: **which member made the most deposits?**

Build the answer one stage at a time. Run each line before adding the next stage:

```
grep deposit ledger.csv
grep deposit ledger.csv | cut -d, -f2
grep deposit ledger.csv | cut -d, -f2 | sort | uniq -c
grep deposit ledger.csv | cut -d, -f2 | sort | uniq -c | sort -rn
grep deposit ledger.csv | cut -d, -f2 | sort | uniq -c | sort -rn | head -n 1
```

`sort -rn` sorts by the count (`-n`, numerically) from biggest to smallest (`-r`), so `head -n 1` is the winner.

That six-stage pipeline is a real analytics query, written without a database. Swap `ledger.csv` for an access log and `-f2` for the IP column, and you've built "top 10 visitors" for a web server.

Tip: type `explain` right after running a pipeline, and each stage is broken down for you.
