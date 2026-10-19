// @vitest-environment node
// Design-system contract (UPS-FE-01/02/04 and UX-gate R4/R13): every design
// value lives in styles/tokens.css. No other file under web/src may carry a
// colour literal or a numeric z-index, and the token file must declare the
// fleet roles, scales, colour modes and the reduced-motion collapse.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const TOKENS = "styles/tokens.css";

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(css|ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
    }
    return out;
}

const files = walk(SRC).map((full) => ({ rel: relative(SRC, full), text: readFileSync(full, "utf8") }));
const tokens = files.find((f) => f.rel === TOKENS);

describe("design tokens", () => {
    it("exist", () => {
        expect(tokens).toBeDefined();
    });

    it("declare every fleet colour role, the layer scale and the motion scale", () => {
        const text = tokens?.text ?? "";
        for (const role of ["primary", "secondary", "accent", "success", "info", "warning", "danger", "bg", "bg-elevated", "bg-muted", "ink", "ink-muted", "border", "link", "link-hover", "code-bg", "code-ink"]) {
            expect(text, `--fleet-color-${role}`).toMatch(new RegExp(`--fleet-color-${role}:`));
        }
        for (const layer of ["sticky", "header", "backdrop", "offcanvas", "modal", "popover", "tooltip", "toast", "skip-link", "fx"]) {
            expect(text, `--fleet-layer-${layer}`).toMatch(new RegExp(`--fleet-layer-${layer}:`));
        }
        for (const speed of ["fast", "base", "slow"]) expect(text).toMatch(new RegExp(`--fleet-motion-${speed}:`));
        for (const n of [0, 1, 2, 3, 4, 5]) expect(text).toMatch(new RegExp(`--fleet-space-${n}:`));
    });

    it("define a light block and collapse motion under prefers-reduced-motion", () => {
        const text = tokens?.text ?? "";
        expect(text).toMatch(/\[data-theme="light"\]/);
        expect(text).toMatch(/\[data-theme="auto"\]\[data-resolved="light"\]/);
        expect(text).toMatch(/prefers-reduced-motion: reduce/);
        expect(text).toMatch(/--fleet-motion-base: 0\.01ms/);
    });

    it("hold every colour literal in web/src", () => {
        const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\boklab\(/;
        const offenders = files
            .filter((f) => f.rel !== TOKENS)
            .flatMap((f) => f.text.split("\n").map((line, i) => ({ f: f.rel, i: i + 1, line })))
            .filter(({ line }) => literal.test(line) && !/^\s*\/[/*]|^\s*\*/.test(line));
        expect(offenders.map((o) => `${o.f}:${o.i}: ${o.line.trim()}`)).toEqual([]);
    });

    it("hold every z-index", () => {
        const zIndex = /z-index:\s*-?\d|zIndex:\s*-?\d|\bz-\d{1,4}\b/;
        const offenders = files
            .filter((f) => f.rel !== TOKENS)
            .flatMap((f) => f.text.split("\n").map((line, i) => ({ f: f.rel, i: i + 1, line })))
            .filter(({ line }) => zIndex.test(line));
        expect(offenders.map((o) => `${o.f}:${o.i}: ${o.line.trim()}`)).toEqual([]);
    });
});
