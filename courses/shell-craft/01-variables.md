---
title: "Variables"
teaches: [export, "$VAR", env]
xp: 25
objectives:
  - text: "Create a variable: export GUILD=forge"
    when: {exists: envVars.GUILD}
    hint: "No spaces around the =: export GUILD=forge"
    solution: "export GUILD=forge"
  - text: "Read it back: echo $GUILD"
    when: {all: [{command: echo}, {arg: "$GUILD"}, {output_includes: forge}]}
    hint: "The $ asks the shell for the variable's value"
    solution: "echo $GUILD"
  - text: "See every variable at once with env"
    when: {all: [{command: env}, {output_includes: "GUILD="}]}
    hint: "env prints NAME=value for every exported variable"
    solution: "env"
---
A **variable** is a name for a value. `export NAME=value` creates one, and `$NAME` uses it anywhere in a command line.

```
export GUILD=forge
echo $GUILD
env
```

Two rules trip everyone up once:

- There are **no spaces around `=`**. `export GUILD = forge` is three separate words.
- Names are case-sensitive, so `$GUILD` and `$guild` are different variables.

Real world: `$HOME`, `$PATH` and `$USER` are variables your system set for you. Programs read `$PATH` to decide where commands live.
