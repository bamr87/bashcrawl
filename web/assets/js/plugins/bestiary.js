(function initBestiaryPlugin(global) {
    "use strict";
    // ── Bestiary ─────────────────────────────────────────────────────────────
    // A codex of the encounters you've run. The catalog is data
    // (src/help/data/progression.yaml, `bestiary`); each key has an
    // encounter-<key> ASCII Motion portrait. The encounter engine
    // (Runtime#runScript) records a creature the first time its portrait is
    // shown; `bestiary <key>` replays the portrait for a discovered creature.
    //
    // A TermForge plugin (docs/schemas/plugin.v1.md). Functions run with
    // `this` = the game Runtime.

    function bestiary(args) {
        const seen = this.state.bestiary || [];
        const catalog = this.catalog.bestiary;
        const want = (args[0] || "").toLowerCase();
        if (want) {
            const entry = catalog.find((e) => e.key === want);
            if (!entry) return [{ kind: "error", text: `No such creature: ${want}` }];
            if (!seen.includes(want)) return [{ kind: "dim", text: `You haven't encountered the ${entry.name} yet.` }];
            return [
                { kind: "art", text: this.art(`encounter-${want}`) },
                { kind: "magic", text: `  ${entry.name}` },
                { kind: "output", text: `  ${entry.blurb}` },
            ];
        }
        const lines = [{ kind: "magic", text: `✨ Bestiary — ${seen.length}/${catalog.length} catalogued` }];
        for (const e of catalog) {
            lines.push(seen.includes(e.key)
                ? { kind: "success", text: `  ✅ ${e.name} — ${e.blurb}` }
                : { kind: "dim", text: "  🔒 ??? — undiscovered" });
        }
        lines.push({ kind: "dim", text: "  Run an encounter (e.g. ./treasure) to catalogue it.  'bestiary <name>' to view one." });
        return lines;
    }

    const plugin = {
        id: "bestiary",
        name: "Bestiary",
        version: "1.0.0",
        description: "A codex of every encounter you have met.",
        commands: { bestiary },
        meta: { bestiary: { summary: "the creature codex; bestiary NAME shows one", usage: "bestiary [NAME]", group: "progress" } },
    };

    global.BashcrawlPlugins = global.BashcrawlPlugins || {};
    global.BashcrawlPlugins.bestiary = { plugin, bestiary };
})(typeof globalThis !== "undefined" ? globalThis : window);
