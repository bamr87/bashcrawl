// The DOM pass over the log after each paint. The DomSink draws one span
// per line; this marks the command echoes, runs the lines a file viewer
// printed through the prose classifier, lights up `code` in the runtime's
// own messages, cascades a fresh block in and decides where it scrolls to.
// Idempotent — a processed span carries .sc — so a full repaint (scrollback
// cap, clear) is simply processed again. The stores call it; React never
// touches these children.
import { FILE_VIEWERS, ProseDecorator, commandOf, inlineLight, type ProseContext } from "./prose";

// The session echoes each command as a dim "/path $ cmd" line; marking those
// lets CSS draw a rule above every command block.
const CMD_ECHO = /^(\/\S*\s\$)\s(.*)$/s;
const LIGHT_KINDS = new Set(["info", "dim", "magic", "success"]);
/** Lines past this index share one delay: the reader is looking at the top of the block. */
export const REVEAL_CAP = 48;
const STAGGER_MS = 16;

export function markCommandBlocks(log: HTMLElement, escapeHtml: (value: unknown) => string): void {
    log.querySelectorAll("span.kind-dim:not(.is-cmd)").forEach((span) => {
        const match = CMD_ECHO.exec(span.textContent || "");
        if (!match) return;
        span.classList.add("is-cmd");
        span.innerHTML = `<span class="cmd-prompt">${escapeHtml(match[1])}</span> <span class="cmd-text">${escapeHtml(match[2])}</span>`;
    });
}

function kindOf(span: Element): string {
    const match = /\bkind-([\w-]+)/.exec(span.className);
    return match?.[1] ?? "output";
}

/** Decorate every line not yet processed, in reading order. */
export function decorateLog(log: HTMLElement, ctx: ProseContext): void {
    markCommandBlocks(log, ctx.escapeHtml);
    let prose: ProseDecorator | null = null;
    for (const node of Array.from(log.children)) {
        const span = node as HTMLElement;
        if (span.classList.contains("is-cmd")) {
            const line = span.querySelector(".cmd-text")?.textContent ?? "";
            prose = FILE_VIEWERS.has(commandOf(line)) ? new ProseDecorator(ctx) : null;
            span.classList.add("sc");
            continue;
        }
        const done = span.classList.contains("sc");
        if (kindOf(span) === "output") {
            if (!prose) {
                span.classList.add("sc");
                continue;
            }
            // Lines painted earlier still feed the classifier, so its state
            // (an open box, a fence) is right for the new ones after them.
            const line = prose.line(span.textContent ?? "");
            if (done) continue;
            span.classList.add("sc", `sc-${line.cls}`);
            span.innerHTML = line.html;
            continue;
        }
        if (done) continue;
        span.classList.add("sc");
        if (LIGHT_KINDS.has(kindOf(span))) {
            const html = inlineLight(span.textContent ?? "", ctx);
            if (html !== null) span.innerHTML = html;
        }
    }
}

/** Cascade a block of fresh lines in; whatever was still revealing snaps complete. */
export function revealLines(log: HTMLElement, spans: HTMLElement[]): void {
    for (const old of Array.from(log.querySelectorAll<HTMLElement>(".rv"))) {
        old.classList.remove("rv");
        old.style.removeProperty("--i");
    }
    spans.forEach((span, index) => {
        span.classList.add("rv");
        span.style.setProperty("--i", String(Math.min(index, REVEAL_CAP)));
    });
}

/** How long the cascade of `count` lines takes to finish, for anything that waits on it. */
export function revealDuration(count: number): number {
    return count ? Math.min(count - 1, REVEAL_CAP) * STAGGER_MS + 240 : 0;
}

export type Placement = "top" | "bottom";

/** A block taller than the viewport opens at its top (a scroll reads from its title); shorter output pins to the bottom. */
export function placementFor(blockHeight: number, viewHeight: number): Placement {
    // No layout yet (or a hidden log): behave like a terminal.
    if (viewHeight <= 0) return "bottom";
    return blockHeight > viewHeight - 4 ? "top" : "bottom";
}

export function placeBlock(log: HTMLElement, first: HTMLElement | null): Placement {
    if (!first) {
        log.scrollTop = log.scrollHeight;
        return "bottom";
    }
    const top = first.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop;
    const where = placementFor(log.scrollHeight - top, log.clientHeight);
    log.scrollTop = where === "top" ? Math.max(0, top - 4) : log.scrollHeight;
    return where;
}
