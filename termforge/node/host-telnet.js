#!/usr/bin/env node
"use strict";
// TermForge telnet host — serve a TermForge app over lightweight telnet/TCP.
//
//   node termforge/node/host-telnet.js [--app bashcrawl|procwatch|<module.js>]
//       [--port 2323] [--host 127.0.0.1] [--raw] [--max-sessions 16]
//       [--idle-timeout 600] [--width 80] [--data-dir DIR]
//
// Default (negotiated) mode speaks a minimal telnet subset: WILL ECHO + SGA
// (character-at-a-time with server echo, so history arrows and Tab completion
// work in telnet(1)), DO NAWS for window size. `--raw` skips all protocol and
// echo — a dumb line loop that plain `nc` clients can use.
//
// SECURITY POSTURE — see docs/termforge/telnet-host.md. Telnet is plaintext:
// the bind address defaults to loopback and non-loopback binds print a
// warning (use ssh -L port-forwarding for remote access). No real shell and
// no real filesystem are reachable: sessions run the TermForge emulator over
// an in-memory world; providers are read-only; nothing derived from client
// bytes is evaluated or spawned. Sessions are capped, idle-kicked,
// line-length-limited and fully isolated from each other.

const net = require("node:net");
const TermForge = require("./index.js");
const { parseArgs, resolveApp } = require("./cli.js");
const { createTelnetCodec } = require("./telnet-codec.js");

const MAX_LINE = 4096;

function attachSession(socket, app, opts) {
    const session = app.createSession({ width: opts.width });
    const sink = new TermForge.sinks.AnsiSink({ write: (chunk) => socket.write(chunk) });
    let editor = null;
    const view = new TermForge.view.TerminalView({
        sink,
        cap: 2000,
        onControl(action) {
            session.onControl(action);
            if (action === "reset" && editor) editor.state = session.runtime.state;
            return action === "reset";
        },
    });

    const runLine = (line) => {
        if (line.length > MAX_LINE) {
            view.appendLine("error", `line too long (max ${MAX_LINE} chars)`);
            return;
        }
        const state = session.runtime.state;
        if (line.trim()) {
            if (!state.history.length || state.history[state.history.length - 1] !== line) {
                state.history.push(line);
            }
            state.historyIndex = state.history.length;
        }
        let outputs;
        try {
            outputs = session.runtime.execute(line);
        } catch (err) {
            outputs = [{ kind: "error", text: `termforge: internal error: ${err.message}` }];
        }
        view.appendOutputs(outputs);
    };

    if (opts.raw) {
        // Dumb line mode for nc: the client edits and echoes locally.
        view.appendOutputs(session.banner || []);
        const prompt = () => socket.write(`${session.runtime.promptLabel()} `);
        let pending = "";
        socket.on("data", (chunk) => {
            pending += chunk.toString("utf8");
            if (pending.length > MAX_LINE * 2) {
                socket.write(`\r\nline too long (max ${MAX_LINE} chars) — goodbye\r\n`);
                socket.end();
                return;
            }
            let idx;
            while ((idx = pending.indexOf("\n")) >= 0) {
                const line = pending.slice(0, idx).replace(/\r$/, "");
                pending = pending.slice(idx + 1);
                runLine(line);
                prompt();
            }
        });
        prompt();
        return;
    }

    // Negotiated mode: telnet protocol + the framework line editor.
    editor = new TermForge.input.LineEditor({
        promptLabel: () => session.runtime.promptLabel(),
        completions: (text) => session.runtime.completions(text),
        state: session.runtime.state,
        write: (chunk) => socket.write(chunk),
        onSubmit(line) {
            runLine(line);
            editor.state = session.runtime.state;
            editor.showPrompt();
        },
        onEof() {
            socket.write("\r\nFarewell.\r\n");
            socket.end();
        },
    });
    const feedEditor = TermForge.input.createByteDecoder((ev) => editor.feed(ev));
    const codec = createTelnetCodec({
        onData: (text) => feedEditor(text),
        onNaws: (w) => { session.width = w || opts.width; },
        onInterrupt: () => editor.feed({ type: "interrupt" }),
    });
    socket.write(codec.opening());
    view.appendOutputs(session.banner || []);
    editor.showPrompt();
    socket.on("data", (chunk) => {
        const replies = codec.feed(chunk);
        if (replies) socket.write(replies);
    });
}

const DEFAULTS = {
    app: "bashcrawl",
    port: 2323,
    host: "127.0.0.1",
    raw: false,
    maxSessions: 16,
    idleTimeout: 600,
    width: 80,
    dataDir: "",
};

/** Build the (not yet listening) server for an already-resolved app. */
function createTelnetServer(app, opts) {
    const sessions = new Set();
    const server = net.createServer((socket) => {
        if (sessions.size >= opts.maxSessions) {
            socket.write("termforge: server full, try again later\r\n");
            socket.destroy();
            return;
        }
        sessions.add(socket);
        socket.on("close", () => sessions.delete(socket));
        socket.on("error", () => socket.destroy());
        if (opts.idleTimeout > 0) {
            socket.setTimeout(opts.idleTimeout * 1000, () => {
                socket.write("\r\n(idle timeout — goodbye)\r\n");
                socket.end();
            });
        }
        try {
            attachSession(socket, app, opts);
        } catch (err) {
            socket.write(`termforge: failed to start session: ${err.message}\r\n`);
            socket.destroy();
        }
    });
    server.termforgeSessions = sessions;
    return server;
}

function main() {
    const opts = parseArgs(process.argv.slice(2), DEFAULTS);
    const app = resolveApp(opts.app, opts.dataDir ? { dataDir: opts.dataDir } : {});
    const server = createTelnetServer(app, opts);
    const sessions = server.termforgeSessions;

    server.listen(opts.port, opts.host, () => {
        const { address, port } = server.address();
        const mode = opts.raw ? "raw TCP (nc-friendly)" : "telnet (negotiated)";
        console.log(`termforge: serving ${app.name} on ${address}:${port} — ${mode}`);
        console.log(opts.raw
            ? `  connect with:  nc ${address} ${port}`
            : `  connect with:  telnet ${address} ${port}`);
        if (address !== "127.0.0.1" && address !== "::1") {
            console.warn("  WARNING: non-loopback bind — telnet is plaintext; prefer ssh -L tunnels.");
        }
    });

    process.on("SIGINT", () => {
        console.log("\ntermforge: shutting down");
        server.close(() => process.exit(0));
        for (const socket of sessions) socket.destroy();
        setTimeout(() => process.exit(0), 500).unref();
    });

    return server;
}

if (require.main === module) main();

module.exports = { attachSession, createTelnetServer, DEFAULTS, main };
