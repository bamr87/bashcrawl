"use strict";
// Loads the exported game data bundle (web/data/*.json) from disk for node
// hosts — the same JSON the browser fetches.

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DATA_DIR = path.resolve(__dirname, "..", "..", "web", "data");

function loadWebData(dataDir = DEFAULT_DATA_DIR) {
    const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
    return {
        world: read("world.json"),
        quests: read("quests.json"),
        commands: read("commands.json"),
    };
}

module.exports = { loadWebData, DEFAULT_DATA_DIR };
