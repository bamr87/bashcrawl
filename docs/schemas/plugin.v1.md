# Plugins v1

Normative contract for TermForge **plugins**: the unit of extension above a command pack. A pack is only commands. A plugin is a *feature*: commands plus the hooks, event sinks, read-only mounts, copy defaults, and state slice that make them work.

Implementation: `termforge/core/plugin.js` (`validatePlugin`, `installPlugin`, `pluginState`, `listPlugins`), exposed on the Shell as `shell.use(plugin)` and `shell.pluginState(id)`.

Installing a plugin is the whole registration. A bashOS desktop app is one `AppSpec` entry and a bashOS command is one markdown file. In the same way, `shell.use(plugin)` lights a feature up on every TermForge surface (browser, TTY, telnet) at once.

## The descriptor

```js
{
  id: "lesson-tools",                       // required: kebab-case, unique per shell
  name: "Lesson Tools", version: "1.0.0", description: "…",
  requires: ["curriculum"],                 // must already be installed
  commands: { name(args, stdin) { return [/* Line records */]; } },
  meta: { name: { summary: "…", usage: "name ARG", group: "learn" } },
  hooks: { postCommand(cmd, args, stdin, outputs) {} },
  events: { "location.changed"(event, shell) {} },
  providers: [provider] /* or */ (shell) => [provider],
  uiText: { lessonDone: (title) => `${title} complete` },
  state: { key: "tools", defaults: () => ({ seen: [] }) },
  setup(shell, options) { return () => { /* teardown */ }; },
}
```

| Field | Semantics |
|---|---|
| `commands` | Unbound functions, always called as `fn.call(shell, args, stdin)`, returning Line records. Registered into `shell.handlers`, so tab completion and `man` see them. A name the app's manifest already maps to the *same* function is left alone. |
| `meta` | `man NAME` prints `summary` and `usage` for plugin commands. The first plugin to describe a name keeps it. |
| `hooks` | HookBus subscribers (the table in [architecture.md](../termforge/architecture.md)), called with `this` = the shell. |
| `events` | Bus sinks (see [events.v1.md](events.v1.md)), called as `fn.call(shell, event, shell)`. |
| `providers` | Read-only VFS mounts (`{ prefix, isDir, list, read }`), unmounted again by `uninstall()`. |
| `uiText` | Copy-deck **defaults**. A key the app (or an earlier plugin) already set is never overwritten, so the app's voice always wins. |
| `state` | `shell.pluginState(id)` returns `shell.state[key]` and creates or tops it up from `defaults()` on every call. That keeps working across a wholesale state swap (reset or save import). For persistence, the app includes `key` in its saved state. |
| `setup` | Runs last. May return a teardown function. |

## Lifecycle

- `shell.use(plugin, options)` validates, checks `requires`, installs, and returns `{ id, uninstall() }`. `uninstall()` removes exactly what this install added: the commands and `man` entries it registered, its hook and event subscriptions, its VFS mounts, and it runs the `setup` teardown.
- If `setup` throws, the partial install is rolled back first and the error propagates, so the shell is left as it was and the plugin can be installed again once fixed.
- Install order matters only through `requires`. A `Shell` constructed with `plugins: [...]` installs them in order. Subclasses that replace `handlers` after `super()` (the bashcrawl `Runtime`) call `use()` themselves afterwards.
- Plugins never touch a host. Their only outputs are Line records and typed events, which every surface already renders.

## Rules for plugins in `termforge/core/`

Core plugins are brand-neutral, the same as the rest of core: all player-facing copy goes through `uiText` with neutral defaults. `termforge/test/content-separation.test.js` enforces this.

## Validation

`validatePlugin(plugin)` returns error strings for a bad id, unknown keys, non-function commands, hooks or sinks, a malformed `state`, or a non-function `setup`. Installing an invalid plugin throws with every error joined.
