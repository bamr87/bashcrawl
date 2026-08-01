"use strict";
// Bashcrawl as a TermForge app: the same game runtime the browser runs
// (web/assets/js/runtime.js — the validator-checked command manifest and all
// game hooks), served to node hosts (TTY, telnet) via the App descriptor:
//
//   createApp({ dataDir? }) -> {
//       id, name,
//       createSession({ width? }) -> { runtime, banner, onControl }
//   }

const path = require("node:path");
const { loadWebData } = require("../node/data-loader.js");

// runtime.js is a classic script: it reads global.TermForge at load time and
// attaches global.BashcrawlRuntime. Publish the framework namespace, then
// let require() execute it once.
function loadGameRuntime() {
    if (!globalThis.BashcrawlRuntime) {
        globalThis.TermForge = globalThis.TermForge || require("../node/index.js");
        require(path.resolve(__dirname, "..", "..", "web", "assets", "js", "runtime.js"));
    }
    return globalThis.BashcrawlRuntime;
}

function createApp(options = {}) {
    const data = loadWebData(options.dataDir);
    const BashcrawlRuntime = loadGameRuntime();

    return {
        id: "bashcrawl",
        name: "Bashcrawl",

        createSession() {
            const session = {
                runtime: new BashcrawlRuntime.Runtime(data),
                banner: [
                    { kind: "banner", text: "BASHCRAWL" },
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
                    }
                },
            };
            return session;
        },
    };
}

module.exports = { createApp };
