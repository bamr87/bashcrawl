// Loads the real game engine into jsdom for component and store tests: the
// same classic files, in the same order, that index.html loads and that the
// node suites evaluate through termforge/test/helpers/game-harness.js. The
// CJS detectors are shadowed so the dual-mode TermForge files take their
// browser branch, and every global lands on jsdom's window.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { GameData } from "../engine/types";

const require = createRequire(import.meta.url);
const harness = require("../../../termforge/test/helpers/game-harness.js") as {
    RUNTIME_FILES: string[];
    STORAGE_FILE: string;
    WEB_JS: string;
    DATA_DIR: string;
};

const EXTRA = ["hud.js", "learn.js", "fx-clips.js", "fx.js", "ambient.js", "arcade.js"].map((name) => join(harness.WEB_JS, name));
const GLOBALS = [
    "TermForge", "BashcrawlRuntime", "BashcrawlHud", "BashcrawlStorage", "BashcrawlLearn", "BashcrawlCommandFx",
    "BashcrawlAmbient", "BashcrawlArcade", "BashcrawlArtClips", "BashcrawlFxClips", "BashcrawlFxClipManifest", "BashcrawlPlugins",
];

export function loadEngine(): void {
    if (window.BashcrawlRuntime) return;
    const target = window as unknown as Record<string, unknown>;
    const node = globalThis as unknown as Record<string, unknown>;
    for (const file of [harness.STORAGE_FILE, ...harness.RUNTIME_FILES, ...EXTRA]) {
        const source = readFileSync(file, "utf8");
        const run = new Function("window", "self", "globalThis", "module", "exports", "require", "define", source);
        run.call(window, window, window, window, undefined, undefined, undefined, undefined);
        // Mirror onto Node's global too, for any bare reference between files.
        for (const key of GLOBALS) {
            if (key in target && !(key in node)) node[key] = target[key];
        }
    }
}

export function readGameData(): GameData {
    const read = (name: string) => JSON.parse(readFileSync(join(harness.DATA_DIR, `${name}.json`), "utf8")) as unknown;
    return {
        world: read("world"),
        quests: read("quests"),
        progression: read("progression"),
        courses: read("courses"),
        commands: read("commands"),
        docs: read("docs"),
        arcade: read("arcade"),
    } as GameData;
}

export const dataLoader = () => Promise.resolve(readGameData());
