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
const { SessionController } = TermForge.session;
const { StringDecoder } = require("node:string_decoder");

function attachSession(socket, app, opts) {
    const session = app.createSession({ width: opts.width, surface: "telnet", hud: false, pager: false });
    const sink = new TermForge.sinks.AnsiSink({ write: (chunk) => socket.write(chunk) });
    let editor = null;
    const view = new TermForge.view.TerminalView({
        sink,
        cap: 2000,
    });
    const linePolicy = session.maxLine || MAX_LINE;
    const inputLimit = (line) => typeof linePolicy === "function" ? linePolicy(line) : linePolicy;
    const controller = new SessionController(session, { view, maxLine: inputLimit });
    const runLine = (line) => controller.execute(line, { echo: Boolean(editor && !editor.echo) });
    socket.on("close", () => controller.close());

    if (opts.raw) {
        // Dumb line mode for nc: the client edits and echoes locally.
        view.appendOutputs(session.banner || []);
        const prompt = () => socket.write(`${session.runtime.promptLabel()} `);
        let pending = "";
        const decoder = new StringDecoder("utf8");
        socket.on("data", (chunk) => {
            // Bound each unfinished line, rather than the size of a TCP batch.
            const text = decoder.write(chunk);
            for (const ch of text) {
                if (controller.closed) return;
                if (ch === "\n") {
                    runLine(pending.replace(/\r$/, ""));
                    pending = "";
                    prompt();
                } else {
                    pending += ch;
                    const limit = inputLimit(pending);
                    if (pending.length > limit) {
                        controller.close();
                        socket.end(`\r\nline too long (max ${limit} chars) — goodbye\r\n`);
                        return;
                    }
                }
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
        maxLine: inputLimit,
        columns: () => session.width || opts.width,
        onOverflow(limit) {
            controller.close();
            socket.end(`\r\nline too long (max ${limit} chars) — goodbye\r\n`);
        },
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
    const feedEditor = TermForge.input.createByteDecoder((ev) => { if (!controller.closed) editor.feed(ev); });
    const codec = createTelnetCodec({
        onData(text) {
            // Echo a pasted batch once instead of repainting every character.
            const echo = editor.echo;
            if (text.length > 1) editor.echo = false;
            feedEditor(text);
            editor.echo = echo;
            if (text.length > 1 && !controller.closed && editor.buffer) editor.redraw();
        },
        onNaws: (w, h) => {
            session.width = Math.max(20, Math.min(500, w || opts.width));
            session.height = Math.max(4, Math.min(200, h || 24));
            if (editor.buffer) editor.redraw();
        },
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
