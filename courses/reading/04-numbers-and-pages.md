---
title: "Numbered lines and paging"
teaches: [nl, less]
xp: 25
objectives:
  - text: "Number every line of the ballad with nl"
    when: {all: [{command: nl}, {args_contains: ballad.txt}]}
    hint: "nl ballad.txt"
    solution: "nl ballad.txt"
  - text: "Open the ballad in the pager: less ballad.txt (q quits)"
    when: {all: [{command: less}, {args_contains: ballad.txt}]}
    hint: "less ballad.txt, then Space for the next page, b to go back, q to quit"
    solution: "less ballad.txt"
---
- `nl FILE` prints a file with **line numbers**, which helps when someone says "look at line 7".
- `less FILE` is a **pager**. It shows one screen at a time: Space or PgDn goes forward, b or PgUp goes back, q quits. It never loads the whole file at once, so it opens huge logs instantly.

```
nl ballad.txt
less ballad.txt
```

Real world: `man` pages open in `less`. Anything you learn here (Space, b, q, and `/word` to search on a real system) works there too.
