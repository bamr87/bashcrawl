---
title: "Columns with cut"
teaches: [cut, "-d", "-f", CSV]
xp: 30
objectives:
  - text: "Pull out the member column: cut -d, -f2 ledger.csv"
    when: {all: [{command: cut}, {args_contains: "-d"}, {any: [{args_contains: "-f2"}, {args_contains: "-f 2"}]}, {output_includes: alice}]}
    hint: "-d, says fields are separated by commas; -f2 keeps field 2"
    solution: "cut -d, -f2 ledger.csv"
  - text: "Count rows per member: cut -d, -f2 ledger.csv | sort | uniq -c"
    when: {all: [{command: uniq}, {option: c}, {piped: true}, {line_includes: cut}]}
    hint: "Three tools: cut picks the column, sort groups, uniq -c counts"
    solution: "cut -d, -f2 ledger.csv | sort | uniq -c"
  - text: "Drop the header row with grep -v member ledger.csv"
    when: {all: [{command: grep}, {option: v}, {arg: member}, {args_contains: ledger.csv}]}
    hint: "The header is the only line containing the word member"
    solution: "grep -v member ledger.csv"
---
`ledger.csv` is **comma-separated values**: one record per line, with fields split by `,`. The first line is a header that names the fields: `date,member,action,gold`.

`cut` slices columns out of each line:

- `-d,` sets the field delimiter to a comma.
- `-f2` keeps the second field, `-f2,4` keeps fields two and four, and `-f2-` keeps everything from two on.

```
cut -d, -f2 ledger.csv
cut -d, -f2 ledger.csv | sort | uniq -c
```

Notice `member` in the count: the header row came along for the ride. `grep -v member` removes it.

Real world: exports from spreadsheets, databases and cloud consoles are almost always CSV. `cut` gives you answers in seconds, without opening a spreadsheet.
