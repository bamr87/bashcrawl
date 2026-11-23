// Vite + Vitest configuration for the web trainer (web/).
//
// The app root is web/: index.html there is the entry. It loads the game
// ENGINE — the vendored TermForge core, runtime.js, the plugins, the
// presenters — as classic <script src="./assets/js/…"> tags in a fixed order
// (a contract shared with scripts/validate_static_web.py and the node test
// harness), then the React app as a module script. Vite leaves non-module
// scripts untouched and never copies them, so copyEngine() ships them and the
// generated data bundles into dist verbatim. base is relative so the same
// build serves from a domain root (production) and from a GitHub Pages
// project path (the fallback).
//
// Build variables (.env.example, read from the repo root): VITE_SITE_URL is
// the canonical origin siteMeta() writes into the page head, robots.txt and
// sitemap.xml; VITE_APP_ENV names the environment (anything but production
// is kept out of search indexes); VITE_POSTHOG_* switch analytics on
// (web/src/analytics/config.ts). __BC_VERSION__ and __BC_COMMIT__ carry the
// build's identity into the app.
//
// This file is .mts on purpose: the root package.json must never declare
// "type": "module", or every engine .js file would be parsed as ESM.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
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

/** Where the site lives when no VITE_SITE_URL is given: the GitHub Pages copy. */
const FALLBACK_SITE_URL = "https://bamr87.github.io/bashcrawl";

function siteUrl(env: Record<string, string>): string {
    const raw = (env.VITE_SITE_URL ?? "").trim().replace(/\/+$/, "");
    return /^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(raw) ? raw : FALLBACK_SITE_URL;
}

// The canonical address in the page head (index.html carries the
// placeholder), plus robots.txt and sitemap.xml. Only the production
// environment is indexable: a staging or preview copy must not compete
// with the real site in search results.
function siteMeta(env: Record<string, string>): Plugin {
    const site = siteUrl(env);
    const appEnv = (env.VITE_APP_ENV ?? "").trim();
    const indexable = appEnv === "" || appEnv === "production";
    return {
        name: "bashcrawl:site-meta",
        transformIndexHtml(html) {
            const robots = indexable ? "" : '<meta name="robots" content="noindex, nofollow">';
            return html.replaceAll("%BC_SITE_URL%", site).replace("<!-- bc:robots -->", robots);
        },
        generateBundle() {
            const robots = indexable ? `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n";
            this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
            if (!indexable) return;
            const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}/</loc></url>\n</urlset>\n`;
            this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
        },
    };
}

function commit(): string {
    const fromEnv = (process.env.GIT_SHA ?? process.env.GITHUB_SHA ?? "").trim();
    if (fromEnv) return fromEnv.slice(0, 12);
    try {
        return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "unknown";
    } catch {
        return "unknown";
    }
}

const pkg = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8")) as { version?: string };

export default defineConfig(({ mode }) => ({
    root: web,
    base: "./",
    // .env files live at the repo root, beside .env.example.
    envDir: here,
    define: {
        __BC_VERSION__: JSON.stringify(pkg.version ?? "0.0.0"),
        __BC_COMMIT__: JSON.stringify(commit()),
    },
    // The repo-root public/, not web/public/: besides the favicon and
    // .nojekyll it holds the fleet feedback widget (fleet-feedback.js and
    // fleet-feedback-capture.js), which the hub's feedback fan-out vendors
    // and upgrades in place at public/ (bamr87/bamr87 tools/fanout.sh).
    // Serving the kit-owned path keeps --upgrade reaching the copy we ship.
    publicDir: resolve(here, "public"),
    plugins: [react(), tailwindcss(), copyEngine(), siteMeta(loadEnv(mode, here, "VITE_"))],
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
}));
