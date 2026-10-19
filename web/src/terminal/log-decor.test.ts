import { describe, expect, it } from "vitest";

import { decorateLog, markCommandBlocks, placeBlock, placementFor, REVEAL_CAP, revealDuration, revealLines } from "./log-decor";
import { SHELL_WORDS, type ProseContext } from "./prose";

const escapeHtml = (value: unknown) =>
    String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const ctx: ProseContext = { commands: new Set(["ls", "cat", "cd", "pwd", "map", ...SHELL_WORDS]), escapeHtml };

function paint(lines: Array<[kind: string, text: string]>): HTMLPreElement {
    const pre = document.createElement("pre");
    pre.innerHTML = lines.map(([kind, text]) => `<span class="kind-${kind}">${escapeHtml(text)}</span>`).join("\n");
    return pre;
}

describe("log decoration", () => {
    it("formats a file view, leaves other output alone and lights runtime hints", () => {
        const log = paint([
            ["dim", "/entrance $ cat scroll"],
            ["output", "=".repeat(80)],
            ["output", "                           ANCIENT SCROLL OF SIGHT"],
            ["output", "    $ ls -F              # see the types"],
            ["dim", "/entrance $ ls"],
            ["output", "cellar/  scroll  README.md"],
            ["info", "Try `map` next."],
        ]);
        decorateLog(log, ctx);
        const spans = Array.from(log.children) as HTMLElement[];
        expect(spans[0]?.classList.contains("is-cmd")).toBe(true);
        expect(spans[1]?.classList.contains("sc-rule")).toBe(true);
        expect(spans[2]?.classList.contains("sc-h1")).toBe(true);
        expect(spans[3]?.querySelector('[data-fill="ls -F"]')).not.toBeNull();
        expect(spans[5]?.className).toBe("kind-output sc");
        expect(spans[5]?.innerHTML).toBe("cellar/  scroll  README.md");
        expect(spans[6]?.querySelector(".sc-code")?.textContent).toBe("map");
        expect(log.textContent).toContain("    $ ls -F              # see the types");
        // Idempotent: a second pass changes nothing.
        const once = log.innerHTML;
        decorateLog(log, ctx);
        expect(log.innerHTML).toBe(once);
    });

    it("marks command echoes", () => {
        const log = paint([["dim", "/entrance/cellar $ ./treasure"]]);
        markCommandBlocks(log, escapeHtml);
        expect(log.querySelector(".cmd-prompt")?.textContent).toBe("/entrance/cellar $");
        expect(log.querySelector(".cmd-text")?.textContent).toBe("./treasure");
    });

    it("cascades a block with a capped stagger and snaps the previous one", () => {
        const log = paint(Array.from({ length: 60 }, (_, i) => ["output", `line ${i}`] as [string, string]));
        const spans = Array.from(log.children) as HTMLElement[];
        revealLines(log, spans);
        expect(spans[0]?.style.getPropertyValue("--i")).toBe("0");
        expect(spans[10]?.style.getPropertyValue("--i")).toBe("10");
        expect(spans[59]?.style.getPropertyValue("--i")).toBe(String(REVEAL_CAP));
        expect(revealDuration(60)).toBe(REVEAL_CAP * 16 + 240);
        expect(revealDuration(0)).toBe(0);
        const next = document.createElement("span");
        log.append(next);
        revealLines(log, [next]);
        expect(spans[0]?.classList.contains("rv")).toBe(false);
        expect(spans[0]?.style.getPropertyValue("--i")).toBe("");
        expect(next.classList.contains("rv")).toBe(true);
    });

    it("opens a long block at its top and pins a short one to the bottom", () => {
        expect(placementFor(900, 400)).toBe("top");
        expect(placementFor(398, 400)).toBe("top");
        expect(placementFor(120, 400)).toBe("bottom");
        expect(placementFor(500, 0)).toBe("bottom");
        const log = paint([["output", "x"]]);
        expect(placeBlock(log, null)).toBe("bottom");
        // jsdom has no layout: a zero-height block always pins.
        expect(placeBlock(log, log.firstElementChild as HTMLElement)).toBe("bottom");
    });
});
