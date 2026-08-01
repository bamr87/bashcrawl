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

## Negotiated mode (default)

On connect the server sends exactly four options and nothing else:

| Bytes | Meaning |
|--------------------|--------------------------------------------|
| `IAC WILL ECHO` | the server echoes — character-at-a-time UX |
| `IAC WILL SGA` | suppress go-ahead (server side) |
| `IAC DO SGA` | suppress go-ahead (client side) |
| `IAC DO NAWS` | please report your window size |

Replies: the matching `DO ECHO` / `DO SGA` / `WILL SGA` / `WILL NAWS` are accepted silently; any other `DO x` gets `WONT x`, any other `WILL x` gets `DONT x`; incoming `DONT`/`WONT` are acknowledged silently and never re-negotiated. `IAC SB NAWS w h IAC SE` updates the session width; all other subnegotiations are skipped wholesale. `IAC IAC` is a literal 0xFF; `IAC IP` acts like `^C` (cancels the current line); other two-byte commands are ignored. Both `CR LF` and `CR NUL` submit a line.

With echo and SGA in place the framework `LineEditor` gives telnet clients the full experience: arrow-key history, Tab completion, `^C` line-cancel, `^L` clear, `^D` to disconnect. Output is SGR-colored per the [terminal protocol](../schemas/terminal-protocol.v1.md) kind table with CRLF line endings.

## Raw mode (`--raw`)

No IAC bytes in either direction, no server echo, no per-character editing: a prompt, a `\n`-terminated line, the output. Your client's own line editing applies — which is exactly what `nc` wants:

```bash
make telnet-demo ARGS="--raw --port 2324" &
printf 'pwd\nls -F\ncat scroll\n' | nc 127.0.0.1 2324
```

History arrows and Tab completion don't exist here by design; disconnect with `^C`/`^D` (client side).

## Session model

One connection = one fully isolated session: its own runtime, state, view, and editor; nothing is shared between sockets. Limits: session cap (`--max-sessions`), idle kick (`--idle-timeout`), 4096-character line cap, 2000-line scrollback cap. A crash inside a command surfaces as an `error` line; the session survives.

## Security posture

Telnet is **plaintext** — treat it accordingly:

- The bind address defaults to loopback. Binding elsewhere requires an explicit `--host` and prints a startup warning; for remote access prefer an SSH tunnel: `ssh -L 2323:127.0.0.1:2323 host`, then `telnet 127.0.0.1 2323` locally.
- No real shell and no real filesystem are reachable. Sessions run the TermForge emulator over an in-memory world; VFS providers are read-only; nothing derived from client bytes is ever evaluated, spawned, or written to disk. The host process reads only `web/data/*.json`.
- Resource bounds: session cap, idle timeout, line-length cap, scrollback cap, per-session isolation.

This is a lab/trusted-network tool in the spirit of classic MUDs and BBSes — not an internet-facing service.
