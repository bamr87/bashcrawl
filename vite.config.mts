// Vite + Vitest configuration for the web trainer (web/).
//
// The app root is web/: index.html there is the entry. It loads the game
// ENGINE — the vendored TermForge core, runtime.js, the plugins, the
// presenters — as classic <script src="./assets/js/…"> tags in a fixed order
// (a contract shared with scripts/validate_static_web.py and the node test
// harness), then the React app as a module script. Vite leaves non-module
// scripts untouched and never copies them, so copyEngine() ships them and the
// generated data bundles into dist verbatim. base is relative because the
// site lives under a GitHub Pages project path.
//
// This file is .mts on purpose: the root package.json must never declare
// "type": "module", or every engine .js file would be parsed as ESM.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const web = resolve(here, "web");

// Engine scripts and data bundles referenced by relative path from index.html.
const ENGINE_DIRS = ["assets/js", "data"];

function copyEngine(): Plugin {
    return {
        name: "bashcrawl:copy-engine",
        apply: "build",
        closeBundle() {
            const out = resolve(web, "dist");
            for (const rel of ENGINE_DIRS) {
                const from = resolve(web, rel);
                if (!existsSync(from)) continue;
                const to = resolve(out, rel);
                mkdirSync(to, { recursive: true });
                cpSync(from, to, { recursive: true });
            }
        },
    };
}

export default defineConfig({
    root: web,
    base: "./",
    publicDir: "public",
    plugins: [react(), tailwindcss(), copyEngine()],
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        host: "127.0.0.1",
    },
    preview: {
        port: 4173,
        host: "127.0.0.1",
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
        css: false,
        passWithNoTests: true,
    },
});
