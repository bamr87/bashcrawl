"use strict";
// TermForge app registry — every app the node hosts can run, in one list.
//
// The shape of bashOS's desktop app registry (an AppSpec dict the launcher,
// palette and taskbar all read): adding an entry here is the whole
// registration. `--app ID` on host-tty.js / host-telnet.js resolves through
// it, `--app list` prints it, and anything else is required as a path to a
// module exporting createApp(options).

const APPS = Object.freeze([
    {
        id: "bashcrawl",
        title: "Bashcrawl",
        description: "the dungeon + learning platform: courses, skills, review, explain",
        load: () => require("./bashcrawl.js"),
    },
    {
        id: "procwatch",
        title: "procwatch",
        description: "live machine metrics as read-only files (the custom-tool reference)",
        load: () => require("./procwatch/index.js"),
    },
    {
        id: "agentwatch",
        title: "agentwatch",
        description: "AI-agent task dashboard over a TaskSource (JSONL logs or a simulation)",
        load: () => require("./agentwatch/index.js"),
    },
]);

/** The registered app spec for an id, or null. */
function get(id) {
    return APPS.find((app) => app.id === id) || null;
}

/** Every registered app, registration order. */
function list() {
    return APPS.slice();
}

/** Build a registered app; throws for an unknown id. */
function createApp(id, options) {
    const spec = get(id);
    if (!spec) throw new Error(`unknown app: ${id} (registered: ${APPS.map((a) => a.id).join(", ")})`);
    return spec.load().createApp(options || {});
}

/** `--app list` output: one aligned row per app. */
function describe() {
    const width = Math.max(...APPS.map((a) => a.id.length));
    return APPS.map((a) => `  ${a.id.padEnd(width)}  ${a.description}`).join("\n");
}

module.exports = { APPS, get, list, createApp, describe };
