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
// runs full-screen: a btop-style TuiScreen with boxed log/hud panes, mouse
// wheel + PgUp/PgDn scrollback, click-to-focus, a toast row, and a live
// input row — the terminal twin of the web sidebar.
// --no-hud (or a non-TTY stdio) falls back to the classic line stream; piped
// stdin runs in line mode and echoes each command after the prompt, so
// scripted transcripts read like a session.
//
// Hidden gem (HUD only): the Konami sequence or `xyzzy`/`plugh` overlays
// DAEMON STORM, a pixel shooter drawn with half-block cells (see gem.js and
// pixels.js). q / ^C returns to the dungeon. Damage events pulse the HUD header.

const TermForge = require("./index.js");
const { parseArgs, resolveApp } = require("./cli.js");
const { TuiScreen } = require("./tui.js");
const { presentStage } = require("./motion.js");
const { fileStore } = require("./file-store.js");
const { SessionController, Pager } = TermForge.session;
const { StringDecoder } = require("node:string_decoder");

const TOAST_KINDS = {
    quest: "magic",
    damage: "error",
    heal: "success",
    xp: "success",
    item: "art",
    levelup: "magic",
    unlock: "magic",
};
const SILENT_EVENTS = new Set(["move"]);
const TOAST_MS = 2200;
const ATTENTION_SEQUENCE = Object.freeze([4, 0, 3, 1, 2, 0, 1, 0]);
const ATTENTION_MS = 42;

// BASHCRAWL_GEM_SEED pins the storm's RNG (captures, PTY tests); unset = random.
function gemSeed() {
    const raw = process.env.BASHCRAWL_GEM_SEED;
    if (raw == null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

function main() {
    const opts = parseArgs(process.argv.slice(2), {
        app: "bashcrawl",
        color: true,
        hud: true,
        dataDir: "",
        motion: true,
        saveFile: "",
    });
    const app = resolveApp(opts.app, opts.dataDir ? { dataDir: opts.dataDir } : {});
    const interactive = process.stdin.isTTY && process.stdout.isTTY;
    const saveFile = opts.saveFile || process.env.BASHCRAWL_SAVE_FILE;
    const persistence = app.id === "bashcrawl" && (saveFile || interactive)
        ? fileStore(saveFile || require("node:path").join(require("node:os").homedir(), ".bashcrawl", "story.json")) : null;
    const session = app.createSession({
        width: process.stdout.columns || 80, surface: "tty",
        hud: opts.hud && interactive, pager: opts.hud && interactive, persistence,
    });
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
    });
    const controller = new SessionController(session, { view });
    const runLine = (line, echo = false) => controller.execute(line, { echo });

    view.appendOutputs(session.banner || []);

    let editor = null;
    if (interactive) {
        const cleanup = () => { controller.close(); process.stdin.setRawMode(false); };
        process.once("exit", cleanup);
        process.once("SIGTERM", () => process.exit(143));
        process.once("SIGINT", () => process.exit(130));
        editor = new TermForge.input.LineEditor({
            promptLabel: () => session.runtime.promptLabel(),
            completions: (text) => session.runtime.completions(text),
            state: session.runtime.state,
            maxLine: session.maxLine,
            columns: () => process.stdout.columns || 80,
            write: (chunk) => process.stdout.write(chunk),
            onSubmit(line) {
                runLine(line, !editor.echo);
                editor.state = session.runtime.state;
                editor.showPrompt();
            },
            onEof() {
                process.stdout.write("\r\nFarewell, adventurer.\r\n");
                cleanup();
                process.exit(0);
            },
        });
        const feed = TermForge.input.createByteDecoder((ev) => editor.feed(ev));
        process.stdin.setRawMode(true);
        process.stdin.resume();
        const decoder = new StringDecoder("utf8");
        process.stdin.on("data", (buf) => {
            const text = decoder.write(buf);
            const echo = editor.echo;
            if (text.length > 1) editor.echo = false;
            feed(text);
            editor.echo = echo;
            if (text.length > 1 && editor.buffer) editor.redraw();
        });
        editor.showPrompt();
    } else {
        const readline = require("node:readline");
        const rl = readline.createInterface({ input: process.stdin, terminal: false });
        rl.on("line", (line) => {
            const label = session.commandLabel ? session.commandLabel(line) : line;
            process.stdout.write(`${session.runtime.promptLabel()} ${label}\n`);
            runLine(line);
        });
        rl.on("close", () => { controller.close(); process.exit(0); });
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
    });
    let pager = null;
    const controller = new SessionController(session, {
        view,
        onPage(text) {
            stopMotion();
            pager = new Pager(text);
            screen.setPager(pager);
        },
    });
    const overlay = session.overlay;


    // Toasts show one at a time; hud() events queue up behind each other.
    const toasts = [];
    let toastTimer = null;
    let gem = null;
    let gemBest = 0;

    const nextToast = () => {
        if (gem) {
            toastTimer = null;
            return;
        }
        const line = toasts.shift() || null;
        screen.setToast(line);
        screen.render();
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = line ? setTimeout(nextToast, TOAST_MS) : null;
        if (toastTimer && toastTimer.unref) toastTimer.unref();
    };
    const pushToasts = (events) => {
        let hit = false;
        for (const ev of events || []) {
            if (SILENT_EVENTS.has(ev.type)) continue;
            if (ev.type === "damage") hit = true;
            toasts.push({ kind: TOAST_KINDS[ev.type] || "info", text: ev.text });
        }
        if (!toastTimer && toasts.length) nextToast();
        if (hit && opts.motion) pulseAttention();
    };

    // Pulse the header for damage without moving output or the input cursor.
    let attentionTimer = null;
    const pulseAttention = () => {
        if (gem) return;
        const seq = ATTENTION_SEQUENCE.slice();
        if (attentionTimer) clearTimeout(attentionTimer);
        const step = () => {
            if (gem) {
                screen.setAttention(false);
                attentionTimer = null;
                return;
            }
            const offset = seq.shift();
            screen.setAttention(Boolean(offset));
            screen.render();
            attentionTimer = seq.length ? setTimeout(step, ATTENTION_MS) : null;
            if (attentionTimer && attentionTimer.unref) attentionTimer.unref();
        };
        step();
    };

    const refreshHud = () => {
        const frame = session.hud();
        screen.setPanels(frame.panels);
        screen.setStrip(frame.strip);
        screen.setPrompt(frame.prompt);
        applyHudChrome();
        pushToasts(frame.events);
    };

    const Hud = session.hudLayout;
    if (Hud && typeof Hud.attachStore === "function") {
        Hud.attachStore(hudFileStore(), { dock: "right" });
    }

    const applyHudChrome = () => {
        if (!Hud || typeof Hud.getLayout !== "function") return;
        const lay = Hud.getLayout();
        screen.setDock(lay.dock);
        screen.setSideWidth(lay.width);
        if (!lay.sidebar) screen.setPanels(null);
    };

    let motionTimer = null;
    const stopMotion = () => {
        if (motionTimer) clearTimeout(motionTimer);
        motionTimer = null;
        screen.setStage(null);
    };
    const playHudMotion = (line, outputs, events) => {
        stopMotion();
        if (pager || typeof session.motion !== "function") return;
        const error = outputs.some((out) => out && out.kind === "error");
        const plan = session.motion(line, { error, events, reducedMotion: !opts.motion });
        if (!plan || !plan.stage) return;
        let index = 0;
        const tick = () => {
            presentStage(screen, plan, index);
            screen.render();
            if (index >= plan.frames.length - 1) { motionTimer = null; return; }
            index += 1;
            motionTimer = setTimeout(tick, plan.hold || 70);
            if (motionTimer.unref) motionTimer.unref();
        };
        tick();
    };
    const runLine = (line) => {
        stopMotion();
        if (overlay && overlay.isSecretLine(line)) {
            view.appendLine("magic", "The walls dissolve into starlight...");
            startGem();
            return;
        }
        const outputs = controller.execute(line, { echo: true });
        const frame = session.hud();
        screen.setPanels(frame.panels);
        screen.setStrip(frame.strip);
        screen.setPrompt(frame.prompt);
        applyHudChrome();
        pushToasts(frame.events);
        screen.setInput("");
        playHudMotion(line, outputs, frame.events);
        screen.render();
    };

    function startGem() {
        if (gem || !overlay) return;
        editor.reset();
        screen.setInput("");
        // Whatever was queued belongs to the dungeon we are leaving; the log
        // already has it. The return trip toasts the storm's own events.
        toasts.length = 0;
        screen.setToast(null);
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
        }
        if (attentionTimer) {
            clearTimeout(attentionTimer);
            attentionTimer = null;
        }
        screen.setAttention(false);
        stopMotion();
        gem = overlay.createGemSession({
            write: (chunk) => process.stdout.write(chunk),
            cols: screen.cols,
            rows: screen.rows,
            color: opts.color,
            animate: opts.motion,
            intervalMs: overlay.TICK_MS,
            seed: gemSeed(),
            best: gemBest,
            onQuit: stopGem,
        });
        gem.start();
    }

    function stopGem(result) {
        if (!gem) return;
        gem.stop();
        gem = null;
        const r = result || {};
        gemBest = Math.max(gemBest, r.best || 0, r.score || 0);
        if (r.reason === "win" || r.reason === "lost") {
            const reward = overlay.grantGemReward(session.runtime, r);
            const tally = `${r.score} pids reaped, ${r.kills} kills, ${r.shots} signals`;
            if (r.won) {
                view.appendLine("magic", `SYSTEM RESTORED. The storm breaks over the shell. (${tally})`);
            } else {
                view.appendLine("error", `KERNEL PANIC. The storm took the shell on wave ${Math.min(r.waves + 1, 3)}. (${tally})`);
            }
            if (reward.granted) {
                if (reward.item) view.appendLine("art", "A kill_switch drops into your pack: the daemons answer to you now.");
                view.appendLine("success", `+${reward.xp} XP`);
            } else if (r.won) {
                view.appendLine("dim", "The storm remembers you. The kill_switch is already yours.");
            } else {
                view.appendLine("dim", "No new waves cleared. The storm pays for progress, not persistence.");
            }
        } else {
            view.appendLine("dim", `The storm fades. The dungeon waits.${r.score ? ` (${r.score} pids reaped, no prize)` : ""}`);
        }
        controller.persist();
        screen.setAttention(false);
        screen.resize(screen.cols, screen.rows); // erase the pixel field before the frame returns
        refreshHud();
        screen.render();
        if (toasts.length) nextToast();
    }

    const editor = new TermForge.input.LineEditor({
        promptLabel: () => session.runtime.promptLabel(),
        completions: (text) => session.runtime.completions(text),
        state: session.runtime.state,
        maxLine: session.maxLine,
        echo: false,
        onOverflow() {
            view.appendLine("error", "Command too long; discarded. Ctrl+C clears the input.");
            screen.render();
        },
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

    const konami = overlay ? overlay.createKonamiWatcher(startGem) : null;

    const teardown = () => {
        if (gem) {
            gem.stop();
            gem = null;
        }
        controller.close();
        stopMotion();
        if (toastTimer) clearTimeout(toastTimer);
        if (attentionTimer) clearTimeout(attentionTimer);
        screen.stop();
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
    };
    process.on("exit", teardown);
    process.on("SIGTERM", () => { teardown(); process.exit(0); });

    const routeHud = (ev) => {
        if (ev.type === "mouse") {
            const hit = screen.hitTest(ev.x, ev.y) || {};
            if (ev.wheel) {
                if (hit.zone === "side") screen.scrollSide(ev.wheel > 0 ? 1 : -1);
                else screen.scrollLog(ev.wheel > 0 ? 3 : -3);
                screen.render();
            } else if (ev.down) {
                if (hit.zone === "side" && hit.kind === "title" && hit.id && Hud) {
                    Hud.applyAction({ op: "toggle", id: hit.id, field: "collapsed" });
                    screen.setFocus("side");
                    refreshHud();
                    screen.render();
                } else if (hit.zone === "log" || hit.zone === "side" || hit.zone === "input") {
                    screen.setFocus(hit.zone);
                    screen.render();
                }
            }
            return true;
        }
        if (ev.type === "page") {
            const step = screen.pageSize();
            if (screen.focus === "side") screen.scrollSide(ev.dir === "up" ? step : -step);
            else screen.scrollLog(ev.dir === "up" ? step : -step);
            screen.render();
            return true;
        }
        if (ev.type === "home" && screen.focus !== "input") {
            if (screen.focus === "side") screen.scrollSide(1e9);
            else screen.scrollLog(1e9);
            screen.render();
            return true;
        }
        if (ev.type === "end" && screen.focus !== "input") {
            if (screen.focus === "side") screen.sideOffset = 0;
            else screen.logOffset = 0;
            screen.render();
            return true;
        }
        if (screen.focus === "log" && (ev.type === "histPrev" || ev.type === "histNext")) {
            screen.scrollLog(ev.type === "histPrev" ? 1 : -1);
            screen.render();
            return true;
        }
        if (ev.type === "char" && screen.focus !== "input") screen.setFocus("input");
        return false;
    };

    let batchingInput = false;
    const feed = TermForge.input.createByteDecoder((ev) => {
        if (gem) {
            if (ev.type === "eof") {
                editor.feed(ev);
                return;
            }
            gem.feed(ev);
            return;
        }
        if (pager) {
            if (ev.type === "eof") { teardown(); process.exit(0); }
            if (!pager.feed(ev)) { pager = null; screen.setPager(null); }
            screen.render();
            return;
        }
        const tok = overlay && overlay.tokenFromEvent(ev);
        if (tok && konami) konami.feed(tok);
        if (gem) return;
        if (routeHud(ev)) return;
        if (ev.type === "interrupt") view.appendLine("dim", "^C");
        editor.feed(ev);
        if (ev.type === "submit") return;
        if (ev.type === "interrupt" || ev.type === "clearScreen") {
            screen.setInput(editor.buffer, editor.cursor);
            screen.render();
            return;
        }
        screen.setInput(editor.buffer, editor.cursor);
        if (!batchingInput) screen.renderInput();
    });

    process.stdin.setRawMode(true);
    process.stdin.resume();
    const decoder = new StringDecoder("utf8");
    process.stdin.on("data", (buf) => {
        const text = decoder.write(buf);
        batchingInput = text.length > 1;
        feed(text);
        batchingInput = false;
        if (!gem && !pager) { screen.setInput(editor.buffer, editor.cursor); screen.renderInput(); }
    });
    process.stdout.on("resize", () => {
        screen.resize(process.stdout.columns || 80, process.stdout.rows || 24);
        if (gem) gem.resize(screen.cols, screen.rows);
        else screen.render();
    });

    view.appendOutputs(session.banner || []);
    refreshHud();
    screen.start({ cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 });
}

// ── shared helpers ──────────────────────────────────────────────────────────

function hudFileStore() {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const file = process.env.BASHCRAWL_HUD_FILE
        || path.join(os.homedir(), ".bashcrawl", "hud.json");
    return {
        load() {
            try { return JSON.parse(fs.readFileSync(file, "utf8")); }
            catch { return null; }
        },
        save(value) {
            try {
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, JSON.stringify(value));
            } catch (_) { /* ignore unwritable home */ }
        },
    };
}

try { main(); }
catch (err) { process.stderr.write(`TermForge: ${err.message}\n`); process.exitCode = 1; }
