// The catalogue is the contract: every event is documented for visitors,
// and docs/analytics.md embeds the same table.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { catalogMarkdown, EVENT_CATALOG, EVENT_NAMES } from "./events";

const DOC = join(import.meta.dirname, "../../../docs/analytics.md");
const START = "<!-- events:start (generated from web/src/analytics/events.ts; BC_WRITE_DOCS=1 npm run test:web -- catalog) -->";
const END = "<!-- events:end -->";

describe("event catalogue", () => {
    it("names events object_verb in snake_case and documents every property", () => {
        for (const name of EVENT_NAMES) {
            expect(name).toMatch(/^(\$pageview|[a-z]+(_[a-z]+)+)$/);
            const spec = EVENT_CATALOG[name];
            expect(spec.about.length).toBeGreaterThan(10);
            for (const [prop, about] of Object.entries(spec.props as Record<string, string>)) {
                expect(prop).toMatch(/^[a-z]+(_[a-z]+)*$/);
                expect(about.length).toBeGreaterThan(5);
            }
        }
    });

    it("never names a property after something a person typed", () => {
        const props = EVENT_NAMES.flatMap((name) => Object.keys(EVENT_CATALOG[name].props));
        for (const banned of ["line", "args", "text", "query", "name", "email", "input"]) expect(props).not.toContain(banned);
    });

    it("is what docs/analytics.md publishes", () => {
        const doc = readFileSync(DOC, "utf8");
        const start = doc.indexOf(START);
        const end = doc.indexOf(END);
        expect(start, "docs/analytics.md is missing the events:start marker").toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const next = `${doc.slice(0, start + START.length)}\n${catalogMarkdown()}\n${doc.slice(end)}`;
        if (process.env.BC_WRITE_DOCS) writeFileSync(DOC, next);
        else expect(doc, "docs/analytics.md is stale: run BC_WRITE_DOCS=1 npm run test:web -- catalog").toBe(next);
    });
});
