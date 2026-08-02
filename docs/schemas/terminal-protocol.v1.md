# Terminal Protocol v1

Normative contract for the TermForge **Line protocol** — the output currency shared by every command handler, frontend, and fixture in this repository.

Implementations: `termforge/core/protocol.js` (constants and validators), `termforge/core/shell.js` (producer), `termforge/core/view.js` + `termforge/core/sinks/` (consumers).

## The record

Every command handler returns an **array of Line records**:

```json
{ "kind": "output", "text": "may\ncontain\nnewlines" }
{ "kind": "control", "action": "clear" }
```

- `kind` (required): one of the display kinds below, or `control`.
- `text` (display kinds): the payload; may embed `\n` — consumers split it into visual lines.
- `action` (control kind only): one of the control actions below.

Consumers MUST pass through records whose `kind` they do not recognise (render them as `output`); new kinds are additive within v1.

## Display kinds

| Kind | Meaning | CSS class (web) | SGR (ANSI sink) |
|-----------|---------------------------------------------|------------------|-----------------|
| `output` | plain command output | `.kind-output` | none |
| `error` | failures: unknown command, damage taken | `.kind-error` | `31` red |
| `success` | positive results: quest done, item gained | `.kind-success` | `32` green |
| `info` | neutral guidance | `.kind-info` | `36` cyan |
| `dim` | de-emphasised side notes, prompt echoes | `.kind-dim` | `2` faint |
| `magic` | highlighted flavour: spells, XP | `.kind-magic` | `35` magenta |
| `art` | preformatted ASCII art | `.kind-art` | `33` yellow |
| `banner` | large headline text | `.kind-banner` | `1;36` bold cyan |

## Control actions

| Action | Host obligation |
|-----------|-----------------------------------------------------------------------|
| `clear` | empty the visible log (TerminalView wipes its buffer; stream sinks emit an erase-screen) |
| `reset` | session state was replaced wholesale — hosts re-sync anything derived from it (the record itself still lands in the log, preserving the historical web behavior) |
| `levelup` | celebratory fanfare; hosts may animate; the record is not logged |

## Pipeline stdin derivation

In `cmd1 | cmd2`, the stdin string handed to the next segment is derived from the previous segment's records as follows (see `Shell.runPipeline`): drop records whose `action` is `clear` or `reset` and records whose `kind` is `error`, then join the remaining `text` values with `\n`.

If any record of a non-final segment has `kind: "error"`, the pipeline stops there and returns the collected records — later segments never run.

An empty surviving set yields `""` (empty stdin), which is distinct from `null` (no pipe attached): commands like `wc` treat `""` as readable input.

## Redirection

`cmd > FILE` / `cmd >> FILE` capture the pipeline's records (those without an `action`), join their `text` with `\n`, and write the result into the session overlay; the pipeline's visible output is replaced by a single `dim` summary record. On any `error` record, the write is skipped and the records surface unchanged.

## Versioning

This is v1 (`PROTOCOL_VERSION = "1.0"` in `protocol.js`). Adding a display kind is a minor, backward-compatible change (consumers fall back to `output` styling). Adding a control action, changing stdin derivation, or changing record shape is a breaking change and requires a v2 document.
