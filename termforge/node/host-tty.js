#!/usr/bin/env node
"use strict";
// TermForge TTY host — run a TermForge app in the local terminal.
//
//   node termforge/node/host-tty.js [--app bashcrawl|procwatch|<module.js>]
//                                   [--no-color] [--data-dir DIR]
//
// Interactive TTY: raw mode with the framework LineEditor (echo, history via
// arrows, Tab completion, ^C cancels the line, ^D exits). Piped stdin runs in
// line mode and echoes each command after the prompt, so scripted transcripts
// read like a session.

const TermForge = require("./index.js");
const { parseArgs, resolveApp } = require("./cli.js");

function main() {
    const opts = parseArgs(process.argv.slice(2), {
        app: "bashcrawl",
        color: true,
        dataDir: "",
    });
    const app = resolveApp(opts.app, opts.dataDir ? { dataDir: opts.dataDir } : {});
    const session = app.createSession({ width: process.stdout.columns || 80 });

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

    view.appendOutputs(session.banner || []);

    let editor = null;
    if (process.stdin.isTTY && process.stdout.isTTY) {
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

main();
