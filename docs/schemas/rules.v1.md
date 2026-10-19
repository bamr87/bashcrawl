# Rules v1

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
| | `args_contains: "-name"` | the space-joined arguments contain the text |
| | `option: a` | a short-flag token carries the letter (`-la` has `a` and `l`); a longer value matches `--value` |
| | `piped: true` | the command received non-empty stdin |
| | `ok: true` | the command produced no `error` record |
| | `output_includes: "text"` | some output record's text contains it |
| | `line_includes: grep` or `[…]` | the whole input line contains one of these (checks a pipeline's other stages) |
| location | `cwd: /abs/path` or `[…]` | the working directory is one of these |
| | `cwd_includes: part` or `[…]` | the working directory contains one of these |
| state | `state: a.b.c` (+ comparator) | the value compares true (truthy with no comparator) |
| | `count: a.b` (+ comparator) | the array length or object key count compares true |
| | `has: inventory`, `value: x` or `[…]` | the array holds every value |
| | `flag: name` | `state.flags[name]` is truthy |
| | `exists: a.b` | the value isn't `null` or `undefined` |
| filesystem | `file_exists: path` | the path reads as a file (relative paths resolve against `cwd`) |
| | `dir_exists: path` | the path is a directory |
| | `file_contains: path`, `text: "…"` | the file's content contains the text |
| constant | `always: true` or `false` | always this value |

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

Command heads are simply false without a command context, so one rule can serve both "after a command" checks (lesson objectives) and "after a line" checks (achievements). `evaluate` never throws for missing data.

## Safety

- State paths walk **own properties only**. `__proto__`, `prototype`, and `constructor` segments are rejected by `validate` and read as `undefined` by `evaluate`.
- `matches` patterns are capped at 200 characters and must compile.

## Validation

`validate(rule, where)` returns located error strings: wrong head count, an unexpected companion key, empty combinator lists, non-numeric bounds, bad booleans, invalid state paths, and patterns that don't compile. Content CI fails on any of them.
