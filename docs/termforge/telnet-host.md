# TermForge Telnet Host

Serve any TermForge app over lightweight telnet/TCP: `make telnet-demo` (the game), or directly:

```bash
node termforge/node/host-telnet.js --app bashcrawl              # telnet clients
node termforge/node/host-telnet.js --app procwatch --raw        # plain nc clients
```

## Flags

| Flag | Default | Meaning |
|--------------------|-------------|--------------------------------------------------|
| `--app` | `bashcrawl` | `bashcrawl`, `procwatch`, or a path to a module exporting `createApp` |
| `--port` | `2323` | listen port |
| `--host` | `127.0.0.1` | bind address (see security posture) |
| `--raw` | off | dumb line mode: no telnet protocol, no server echo — for `nc` |
| `--max-sessions` | `16` | concurrent connections; excess get "server full" and are dropped |
| `--idle-timeout` | `600` | seconds of silence before a session is kicked (0 disables) |
| `--width` | `80` | assumed terminal width until NAWS reports one |
| `--data-dir` | repo `web/data` | game data directory for the bashcrawl app |
| `--hub` | off | shared hub (MUD mode): presence, chat and a leaderboard across sessions; see below |

## Negotiated mode (default)

On connect the server sends exactly four options and nothing else:

| Bytes | Meaning |
|--------------------|--------------------------------------------|
| `IAC WILL ECHO` | the server echoes — character-at-a-time UX |
| `IAC WILL SGA` | suppress go-ahead (server side) |
| `IAC DO SGA` | suppress go-ahead (client side) |
| `IAC DO NAWS` | please report your window size |

Replies: the matching `DO ECHO` / `DO SGA` / `WILL SGA` / `WILL NAWS` are accepted silently; any other `DO x` gets `WONT x`, any other `WILL x` gets `DONT x`; incoming `DONT`/`WONT` are acknowledged silently and never re-negotiated. `IAC SB NAWS w h IAC SE` updates the session width; all other subnegotiations are skipped wholesale. `IAC IAC` is a literal 0xFF; `IAC IP` acts like `^C` (cancels the current line); other two-byte commands are ignored. Both `CR LF` and `CR NUL` submit a line.

With echo and SGA in place the framework `LineEditor` gives telnet clients the full experience: left/right insertion, Home/End, Delete, arrow-key history, Tab completion, `^C` line-cancel, `^L` clear, `^D` to disconnect. Output is SGR-colored per the [terminal protocol](../schemas/terminal-protocol.v2.md) kind table with CRLF line endings.

## Raw mode (`--raw`)

No IAC bytes in either direction, no server echo, no per-character editing: a prompt, a `\n`-terminated line, the output. Your client's own line editing applies — which is exactly what `nc` wants:

```bash
make telnet-demo ARGS="--raw --port 2324" &
printf 'pwd\nls -F\ncat scroll\n' | nc 127.0.0.1 2324
```

History arrows and Tab completion don't exist here by design; disconnect with `^C`/`^D` (client side).

## Session model

One connection = one fully isolated session: its own runtime, state, view, and editor; nothing is shared between sockets. Limits: session cap (`--max-sessions`), idle kick (`--idle-timeout`), 4096-character line cap, 2000-line scrollback cap. A crash inside a command surfaces as an `error` line; the session survives. Oversized unfinished input disconnects immediately, while batches of short commands are accepted. UTF-8 survives split socket chunks. NAWS controls the horizontal editor window. Subnegotiation payloads are bounded.

Bashcrawl telnet sessions are temporary. `save` explains this; `save export` prints a transferable UTF-8 token and `save import TOKEN` validates and restores it. `less` prints the file in stream mode. The banner advertises only these available capabilities.

## Hub mode (`--hub`)

By default every connection is a sealed world. `--hub` (or `make telnet-hub`) turns the server into a small MUD. Every session joins one shared `Hub` (`termforge/node/hub.js`) and gets six commands:

| Command | Effect |
|---|---|
| `who` | everyone online, their current directory and XP |
| `say MESSAGE` | speak to players in the same directory |
| `emote ACTION` | act something out for the room (`emote waves`) |
| `shout MESSAGE` | speak to everyone online |
| `name [NEW]` | show or change your display name (players start as `guestN`) |
| `top` | the live leaderboard, by XP |

The hub also announces moments from each player's [typed event bus](../schemas/events.v1.md): badges, finished lessons and courses, rank-ups, unlocked rooms, and players arriving in or leaving your directory. Incoming lines print above your prompt, and whatever you were typing is redrawn intact.

What changes in the posture: players see each other's **names, current directories and XP**, and **chat text crosses sessions**. That text is sanitized before it is stored or delivered:

- C0 and C1 control characters, ESC (so no injected escape sequences), bidi overrides and zero-width characters are removed — from chat, and from anything else of one player that another player sees, such as the directory names `who` prints (a player can `mkdir` anything).
- Whitespace collapses and messages are capped at 240 characters.
- Names must match `[A-Za-z][A-Za-z0-9_-]{1,15}` and be unique, ignoring case.
- Each player has a token-bucket rate limit for what it broadcasts: `say`, `emote`, `shout` and `name` share one lane (a burst of 5, then one every 2 seconds, refused with a notice past that); room arrivals and departures have their own (a burst of 8), past which a move simply goes unannounced — `who` still tells the truth.
- A player whose connection keeps failing deliveries is dropped from the hub rather than kept silently.

Everything else in the posture below still holds. Game state, files and saves stay per-session.

## Security posture

Telnet is **plaintext** — treat it accordingly:

- The bind address defaults to loopback. Binding elsewhere requires an explicit `--host` and prints a startup warning; for remote access prefer an SSH tunnel: `ssh -L 2323:127.0.0.1:2323 host`, then `telnet 127.0.0.1 2323` locally.
- No real shell and no real filesystem are reachable. Sessions run the TermForge emulator over an in-memory world; VFS providers are read-only; nothing derived from client bytes is ever evaluated, spawned, or written to disk. The host process reads only `web/data/*.json`.
- Resource bounds: session cap, idle timeout, line-length cap, scrollback cap, per-session isolation.

This is a lab/trusted-network tool in the spirit of classic MUDs and BBSes — not an internet-facing service.

Bashcrawl save-import tokens have a separate 1 MiB line budget. Their contents are masked in command history and log echoes; ordinary commands retain the 4096-character cap.
