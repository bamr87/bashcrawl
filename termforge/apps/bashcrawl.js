"use strict";
// Bashcrawl as a TermForge app: the same game runtime the browser runs
// (web/assets/js/runtime.js — the validator-checked command manifest and all
// game hooks), served to node hosts (TTY, telnet) via the App descriptor:
//
//   createApp({ dataDir? }) -> {
//       id, name,
//       createSession({ width? }) -> { runtime, banner, onControl, hud }
//   }
//
// hud() is the optional graphical contract: hosts that can draw panels (the
// TTY host's TuiScreen) call it after every command and get the same models
// the web sidebar renders — panels, a narrow-terminal strip, and the semantic
// events (quest/damage/xp/item/levelup) that drive effects on both surfaces.

const path = require("node:path");
const { loadWebData } = require("../node/data-loader.js");

// runtime.js and hud.js are classic scripts: they read global.TermForge /
// global.BashcrawlRuntime at load or call time and attach their own globals.
// Publish the framework namespace, then let require() execute each once.
function loadGameRuntime() {
    if (!globalThis.BashcrawlRuntime) {
        globalThis.TermForge = globalThis.TermForge || require("../node/index.js");
        require(path.resolve(__dirname, "..", "..", "web", "assets", "js", "runtime.js"));
    }
    if (!globalThis.BashcrawlHud) {
        require(path.resolve(__dirname, "..", "..", "web", "assets", "js", "hud.js"));
    }
    return globalThis.BashcrawlRuntime;
}

function createApp(options = {}) {
    const data = loadWebData(options.dataDir);
    const BashcrawlRuntime = loadGameRuntime();
    const Hud = globalThis.BashcrawlHud;

    return {
        id: "bashcrawl",
        name: "Bashcrawl",

        createSession() {
            let prevSnap = null;
            const runtime = new BashcrawlRuntime.Runtime(data);
            const session = {
                runtime,
                banner: [
                    { kind: "banner", text: runtime.uiText.bannerArt },
                    { kind: "info", text: "Welcome to Bashcrawl on the TermForge terminal." },
                    { kind: "dim", text: "Try: pwd, ls -F, cat scroll, cd cellar  •  cat scroll | wc -l  •  hint, map, tree, cowsay hi." },
                    { kind: "dim", text: "Mini-games: train · speedrun · pathfind. Ctrl+D (or 'exit' in raw mode) leaves the dungeon." },
                ],
                // Host control routing: "reset" replaces the session runtime
                // (the control record itself still lands in the log, matching
                // the web app); "clear"/"levelup" need no session work.
                onControl(action) {
                    if (action === "reset") {
                        session.runtime = new BashcrawlRuntime.Runtime(data);
                        prevSnap = null;
                    }
                },
                // Graphical HUD frame for panel-capable hosts. Stateful: each
                // call diffs against the previous snapshot so the host gets
                // ready-to-toast events without tracking game state itself.
                hud() {
                    const runtime = session.runtime;
                    Hud.ensureVisited(runtime);
                    const snap = Hud.snapshot(runtime);
                    const events = prevSnap ? Hud.diffEvents(prevSnap, snap) : [];
                    prevSnap = snap;
                    return {
                        panels: Hud.panels(runtime),
                        strip: Hud.strip(runtime),
                        events,
                        prompt: runtime.promptLabel(),
                    };
                },
            };
            return session;
        },
    };
}

module.exports = { createApp };
