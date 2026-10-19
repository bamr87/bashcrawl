---
title: "Arithmetic"
teaches: [let, numbers]
xp: 25
objectives:
  - text: "Store a number: export MANA=10"
    when: {exists: envVars.MANA}
    hint: "export MANA=10"
    solution: "export MANA=10"
  - text: "Add to it with let: let MANA=MANA+5"
    when: {all: [{command: let}, {args_contains: MANA}]}
    hint: "Inside let you write MANA without the $"
    solution: "let MANA=MANA+5"
  - text: "Check the result: echo $MANA"
    when: {all: [{command: echo}, {arg: "$MANA"}]}
    hint: "echo $MANA"
    solution: "echo $MANA"
---
Shell variables hold **text**. To do arithmetic, you have to ask for it:

```
export MANA=10
let MANA=MANA+5
echo $MANA
```

Inside `let`, names are read as numbers, so no `$` is needed. Bash also has `$(( MANA + 5 ))`, which you'll meet in real scripts.

This game uses the same trick: your health lives in `$HP`, and `let HP=HP-5` is how a monster hurts you.
