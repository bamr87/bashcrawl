# Events v1

> The normative contract for TermForge typed events: the event shape, delivery rules, every type and how events relate to the HUD's state diff.

Normative contract for TermForge **typed events**: the structured channel between a session and everything that watches it. The [Line protocol](terminal-protocol.v2.md) is what a command *prints*; events are what *happened*.

Implementation: `termforge/core/events.js` (`EventBus`, `TYPES`). The Shell owns one bus per session (`shell.events`). The design mirrors bashOS's `src/bashos/events.py`: the kernel emits typed facts, and surfaces render them. Kernel code never prints.

## The event

```json
{ "type": "progress.xp", "seq": 42, "session": "telnet-3", "amount": 25, "total": 310, "reason": "quest" }
```

- `type` (required): a dotted `noun.verb` string.
- `seq` (required): a per-bus counter, starting at 1. Ordering without a clock.
- `session` (optional): stamped when the bus was created with a session id.
- `origin` (optional): the source session of an event forwarded with `bus.pipe()`.
- Payload fields sit beside these. A payload can't overwrite `type`, `seq`, or `session`.

Events are frozen. They carry **no wall-clock time**: determinism is the kernel default, and a sink that wants a time reads its own clock.

## Delivery rules

1. **Sinks are synchronous and must never block.** They run inside `Shell#execute` while a line is in flight. To update a UI, post to its loop and return.
2. **A throwing sink is isolated.** The bus reports the error to `onError` and keeps delivering. One broken subscriber can't break a session.
3. **Subscription forms:** an exact type (`"progress.xp"`), a family (`"progress.*"`), or everything (`"*"`). The order is exact, then family, then wildcard.
4. **Bare shells emit nothing.** A shell built with `bare: true` runs no hooks, and in the same way it emits no events. The Practice Arcade sandboxes stay silent.
5. **Unknown types are ignored.** New types are additive within v1. Changing a documented payload field's meaning requires v2.

## Types

| Type | Emitted by | Payload |
|---|---|---|
| `line.executed` | kernel, once per input line | `line`, `ok` |
| `command.run` | kernel, once per pipeline segment | `cmd`, `args`, `piped`, `ok`, `unknown?` |
| `location.changed` | kernel, when `cwd` differs after a line | `from`, `to` |
| `session.reset` | apps, when state is replaced wholesale | none |
| `progress.xp` | apps | `amount`, `total`, `reason` |
| `progress.rank` | apps | `index`, `title` |
| `item.gained` | apps | `item` |
| `health.changed` | apps | `delta`, `hp` |
| `node.revealed` | apps | `name`, `path` |
| `quest.completed` | apps | `id`, `title`, `xp` |
| `achievement.unlocked` | apps | `id`, `title`, `icon` |
| `encounter.run` | apps | `key`, `script`, `path` |
| `course.enrolled` | `core/curriculum.js` | `course`, `title` |
| `lesson.started` | `core/curriculum.js` | `course`, `lesson`, `title` |
| `objective.completed` | `core/curriculum.js` | `course`, `lesson`, `objective`, `text` |
| `lesson.completed` | `core/curriculum.js` | `course`, `lesson`, `title`, `xp` |
| `course.completed` | `core/curriculum.js` | `course`, `title` |
| `skill.levelled` | `core/mastery.js` | `skill`, `level`, `label` |
| `hub.joined` / `hub.left` | `termforge/node/hub.js` | `name` |
| `hub.message` | `termforge/node/hub.js` | `from`, `scope`, `text` |

An app may add its own types. Prefix them with the app's name (for example `bashcrawl.*`) to keep the shared namespace readable.

## Relationship to the HUD event diff

The bashcrawl HUD presenter (`web/assets/js/hud.js`) still derives its toast events by diffing state snapshots (`diffEvents`). Diffing catches state changes no producer announced, such as `export I=...`. Typed events are the integration seam for subscribers that need the *reason*: mastery tracking, the multiplayer hub, and recorders. Both coexist by design.
