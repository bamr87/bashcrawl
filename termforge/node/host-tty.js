#!/usr/bin/env node
"use strict";
// TermForge TTY host — run a TermForge app in the local terminal.
//
//   node termforge/node/host-tty.js [--app bashcrawl|procwatch|<module.js>]
//                                   [--no-color] [--no-hud] [--data-dir DIR]
//
// Interactive TTY: raw mode with the framework LineEditor (echo, history via
// arrows, Tab completion, ^C cancels the line, ^D exits). When the app
// implements the hud() contract (see termforge/apps/bashcrawl.js) the session
// runs full-screen: a TuiScreen frame with sidebar panels, a toast row for
// game events, and a live input row — the terminal twin of the web sidebar.
// --no-hud (or a non-TTY stdio) falls back to the classic line stream; piped
// stdin runs in line mode and echoes each command after the prompt, so
// scripted transcripts read like a session.

const TermForge = require("./index.js");
const { parseArgs, resolveApp } = require("./cli.js");
const { TuiScreen } = require("./tui.js");

const TOAST_KINDS = { quest: "magic", damage: "error", xp: "success", item: "art", levelup: "magic" };
const TOAST_MS = 2200;

function main() {
    const opts = parseArgs(process.argv.slice(2), {
        app: "bashcrawl",
        color: true,
        hud: true,
        dataDir: "",
    });
    const app = resolveApp(opts.app, opts.dataDir ? { dataDir: opts.dataDir } : {});
    const session = app.createSession({ width: process.stdout.columns || 80 });
    const interactive = process.stdin.isTTY && process.stdout.isTTY;
    const hudActive = Boolean(opts.hud && interactive && typeof session.hud === "function");

    if (hudActive) {
        runHudMode(session, opts);
    } else {
        runStreamMode(session, opts, interactive);
    }
}

// ── Classic line-stream mode (piped stdin, --no-hud, HUD-less apps) ─────────

function runStreamMode(session, opts, interactive) {
    const sink = new TermForge.sinks.AnsiSink({
        write: (chunk) => process.stdout.write(chunk),
        color: opts.color && Boolean(process.stdout.isTTY),
    });
    const view = new TermForge.view.TerminalView({
        sink,
        cap: 2000,
        onControl(action) {
            session.onControl(action);
            if (action === "reset" && editor) editor.state = session.runtime.state;
            return action === "reset"; // match the web app: reset records land in the log
        },
    });

    const runLine = (line) => {
        pushHistory(session.runtime.state, line);
        view.appendOutputs(executeLine(session, line));
    };

    view.appendOutputs(session.banner || []);

    let editor = null;
    if (interactive) {
        editor = new TermForge.input.LineEditor({
            promptLabel: () => session.runtime.promptLabel(),
            completions: (text) => session.runtime.completions(text),
            state: session.runtime.state,
            write: (chunk) => process.stdout.write(chunk),
            onSubmit(line) {
                runLine(line);
                editor.state = session.runtime.state;
                editor.showPrompt();
            },
            onEof() {
                process.stdout.write("\r\nFarewell, adventurer.\r\n");
                process.stdin.setRawMode(false);
                process.exit(0);
            },
        });
        const feed = TermForge.input.createByteDecoder((ev) => editor.feed(ev));
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on("data", (buf) => feed(buf.toString("utf8")));
        editor.showPrompt();
    } else {
        const readline = require("node:readline");
        const rl = readline.createInterface({ input: process.stdin, terminal: false });
        rl.on("line", (line) => {
            process.stdout.write(`${session.runtime.promptLabel()} ${line}\n`);
            runLine(line);
        });
        rl.on("close", () => process.exit(0));
    }
}

// ── Full-screen HUD mode ────────────────────────────────────────────────────

function runHudMode(session, opts) {
    const screen = new TuiScreen({
        write: (chunk) => process.stdout.write(chunk),
        color: opts.color,
    });

    // The log pane is still a TerminalView — same buffer semantics and control
    // routing as every other surface; only the sink changes.
    const view = new TermForge.view.TerminalView({
        sink: {
            write: (lines) => screen.appendLog(lines),
            clear: () => screen.clearLog(),
        },
        cap: 2000,
        onControl(action) {
            session.onControl(action);
            if (action === "reset") {
                editor.state = session.runtime.state;
                refreshHud();
            }
            return action === "reset";
        },
    });

    // Toasts show one at a time; hud() events queue up behind each other.
    const toasts = [];
    let toastTimer = null;
    const nextToast = () => {
        const line = toasts.shift() || null;
        screen.setToast(line);
        screen.render();
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = line ? setTimeout(nextToast, TOAST_MS) : null;
        if (toastTimer && toastTimer.unref) toastTimer.unref();
    };
    const pushToasts = (events) => {
        for (const ev of events || []) {
            toasts.push({ kind: TOAST_KINDS[ev.type] || "info", text: ev.text });
        }
        if (!toastTimer && toasts.length) nextToast();
    };

    const refreshHud = () => {
        const frame = session.hud();
        screen.setPanels(frame.panels);
        screen.setStrip(frame.strip);
        screen.setPrompt(frame.prompt);
        pushToasts(frame.events);
    };

    const runLine = (line) => {
        pushHistory(session.runtime.state, line);
        view.appendLine("dim", `${session.runtime.promptLabel()} ${line}`);
        view.appendOutputs(executeLine(session, line));
        refreshHud();
        screen.setInput("");
        screen.render();
    };

    const editor = new TermForge.input.LineEditor({
        promptLabel: () => session.runtime.promptLabel(),
        completions: (text) => session.runtime.completions(text),
        state: session.runtime.state,
        echo: false,
        // The frame owns all painting. LineEditor writes are decoded instead of
        // streamed: the Tab-completion candidate list (the one thing the editor
        // says that isn't already in our state) lands in the log; every other
        // chunk (prompt echoes, redraws) is superseded by the frame repaint.
        write: (chunk) => {
            const text = String(chunk);
            if (text.startsWith("\r\n") && text.trim()) {
                for (const row of text.trim().split("\r\n")) view.appendLine("info", row);
                screen.render();
            }
        },
        onSubmit(line) {
            runLine(line);
            editor.state = session.runtime.state;
        },
        onEof() {
            teardown();
            process.stdout.write("Farewell, adventurer.\n");
            process.exit(0);
        },
    });

    const teardown = () => {
        if (toastTimer) clearTimeout(toastTimer);
        screen.stop();
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
    };
    process.on("exit", () => { if (screen.started) screen.stop(); });

    const feed = TermForge.input.createByteDecoder((ev) => {
        if (ev.type === "interrupt") view.appendLine("dim", "^C");
        editor.feed(ev);
        if (ev.type === "submit") return; // onSubmit repainted the full frame
        if (ev.type === "interrupt" || ev.type === "clearScreen") {
            screen.setInput(editor.buffer);
            screen.render();
            return;
        }
        screen.setInput(editor.buffer);
        screen.renderInput();
    });

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (buf) => feed(buf.toString("utf8")));
    process.stdout.on("resize", () => {
        screen.resize(process.stdout.columns || 80, process.stdout.rows || 24);
        screen.render();
    });

    view.appendOutputs(session.banner || []);
    refreshHud();
    screen.start({ cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 });
}

// ── shared helpers ──────────────────────────────────────────────────────────

function pushHistory(state, line) {
    if (!line.trim()) return;
    if (!state.history.length || state.history[state.history.length - 1] !== line) {
        state.history.push(line);
    }
    state.historyIndex = state.history.length;
}

function executeLine(session, line) {
    try {
        return session.runtime.execute(line);
    } catch (err) {
        return [{ kind: "error", text: `termforge: internal error: ${err.message}` }];
    }
}

main();
