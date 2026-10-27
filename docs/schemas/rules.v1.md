# Rules v1

> The normative contract for TermForge rules — declarative predicates over a session that let content say when something is true, as data.

Normative contract for TermForge **rules**: declarative predicates over a session. With rules, content says *when* something is true as data. Authors extend a TermForge app in YAML or Markdown frontmatter without writing JavaScript.

Implementation: `termforge/core/rules.js` (`evaluate`, `validate`, `lookup`). It has a structural mirror for node-free CI in `scripts/validate_content_contracts.py` (`rule_errors`), and `termforge/test/progression.test.js` keeps the two head lists identical.

Consumers today:

- achievements: the `when` field in `src/help/data/progression.yaml`
- lesson objectives: `objectives[].when` in `courses/*/*.md`

## Shape

A rule is a mapping with exactly **one head key**. Some heads take companion keys.

| Group | Head | True when |
|---|---|---|
| combinators | `all: [rule, …]` | every rule holds (non-empty list) |
| | `any: [rule, …]` | at least one rule holds (non-empty list) |
| | `not: rule` | the rule does not hold |
| the command that just ran | `command: ls` or `[map, tree]` | the command name is one of these |
| | `arg: notes.txt` or `[…]` | some argument equals one of these |
| | `args_contains: "-name"` or `[…]` | the space-joined arguments contain one of these |
| | `option: a` or `[…]` | a short-flag token carries one of the letters (`-la` has `a` and `l`); a longer value matches `--value` |
| | `piped: true` | the command received non-empty stdin |
| | `ok: true` | the command produced no `error` record |
| | `output_includes: "text"` or `[…]` | some output record's text contains one of these |
| | `line_includes: grep` or `[…]` | the whole input line contains one of these (checks a pipeline's other stages) |
| location | `cwd: /abs/path` or `[…]` | the working directory is one of these |
| | `cwd_includes: part` or `[…]` | the working directory contains one of these |
| state | `state: a.b.c` (+ comparator) | the value compares true (truthy with no comparator) |
| | `count: a.b` (+ comparator) | the array length or object key count compares true |
| | `has: inventory`, `value: x` or `[…]` | the array holds every value |
| | `flag: name` | `state.flags[name]` is truthy |
| | `exists: a.b` | the value isn't `null` or `undefined` |
| filesystem | `file_exists: path` or `[…]` | one of the paths reads as a file (relative paths resolve against `cwd`) |
| | `dir_exists: path` or `[…]` | one of the paths is a directory |
| | `file_contains: path` or `[…]`, `text: "…"` | one of the files' content contains the text |
| constant | `always: true` or `false` | always this value |

Wherever a string head takes a list, the list means **any of** (`has` is the one head that means every value). Spell out "every one of them" with `all`. `validate` and `evaluate` agree on this: any shape the validator accepts is a shape the evaluator can satisfy.

**Comparators** (with `state` and `count`): `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in` (the value is in a list), `includes` (a string or array value contains the operand), `matches` (a regex of at most 200 characters). Several comparators on one rule must all hold.

Numeric comparisons read a **missing value as 0**, so `{state: stats.commands.pwd, gt: 0}` is false, not an error, on a fresh save.

## Evaluation context

`evaluate(rule, ctx)` takes:

```js
{ state,                 // the session state (required for state/location heads)
  cmd, args, stdin,      // present when checked right after a command ran
  outputs,               // that command's Line records
  line,                  // the whole input line the command was part of
  shell }                // anything with resolve/isDir/readFile, for filesystem heads
```

Without a command context the command heads (`command`, `arg`, `args_contains`, `option`, `piped`, `ok`, `output_includes` — exported as `COMMAND_HEADS`) are **unknown** rather than false: `not` of an unknown is still unknown, `all` and `any` propagate it the way SQL treats `NULL`, and an unknown rule is unmet. So one rule can serve both "after a command" checks (lesson objectives) and "after a line" or "after a save" checks (the curriculum's per-line pass, achievements) without `not: {command: cd}` handing out a free pass where no command ran, while `not: {file_exists: x}`, which needs no command, still decides. `evaluate` never throws for missing data.

## Safety

- State paths walk **own properties only**. `__proto__`, `prototype`, and `constructor` segments are rejected by `validate` and read as `undefined` by `evaluate`.
- `matches` patterns are capped at 200 characters and must compile.

## Validation

`validate(rule, where)` returns located error strings: wrong head count, an unexpected companion key, empty combinator lists, non-numeric bounds, bad booleans, invalid state paths, and patterns that don't compile. Content CI fails on any of them.
