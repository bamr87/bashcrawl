(function initProgressPlugin(global) {
    "use strict";
    // ── Ranks, XP and the character sheet ────────────────────────────────────
    // Rank thresholds are data (src/help/data/progression.yaml, `ranks`).
    // Rank-up is judged LAST after every line (postExecute), so it reads the
    // XP that achievements and the daily goal just awarded.
    //
    // A TermForge plugin (docs/schemas/plugin.v1.md). Functions run with
    // `this` = the game Runtime.

    // Celebrate when accumulated XP crosses a rank threshold.
    function checkRankUp() {
        const ranks = this.catalog.ranks;
        const idx = ranks.reduce((acc, r, i) => ((this.state.xp || 0) >= r.min ? i : acc), 0);
        if (typeof this.state.rankIndex !== "number") {
            this.state.rankIndex = idx; // baseline for older saves; no retroactive party
            return [];
        }
        if (idx <= this.state.rankIndex) return [];
        this.state.rankIndex = idx;
        this.emit("progress.rank", { index: idx, title: ranks[idx].title });
        return [
            { kind: "control", action: "levelup" },
            ...(this.capabilities.compactEvents ? [] : [{ kind: "art", text: this.art("levelup") }]),
            { kind: "success", text: `★  You are now ${ranks[idx].title}!` },
        ];
    }

    // Character sheet: a one-glance summary of all progress.
    function profile() {
        const s = this.state;
        const rank = this.rankFor(s.xp).title;
        const cmds = s.stats.commands || {};
        const distinct = Object.keys(cmds).length;
        const total = Object.values(cmds).reduce((a, b) => a + b, 0);
        const inv = s.inventory || [];
        const best = s.speedrunBest != null ? `${s.speedrunBest.toFixed(1)}s` : "—";
        const label = (text) => `  ${(text + ":").padEnd(18)}`;
        return [
            { kind: "art", text: this.art("profile") },
            { kind: "magic", text: `  Rank:  ${rank}` },
            { kind: "output", text: `${label("XP")}${s.xp}        HP: ${s.hp}/100` },
            { kind: "output", text: `${label("Quests")}${s.completedQuestIds.length}/${this.quests.length} complete` },
            { kind: "output", text: `${label("Badges")}${(s.achievements || []).length}/${this.catalog.achievements.length} earned` },
            { kind: "output", text: `${label("Scrolls read")}${s.stats.catScrollCount || 0}` },
            { kind: "output", text: `${label("Commands")}${distinct} distinct (${total} cast)` },
            { kind: "output", text: `${label("Hidden rooms")}${Object.keys(s.reveals || {}).length} unlocked` },
            { kind: "output", text: `${label("Best speed run")}${best}` },
            { kind: "output", text: `${label("Inventory")}${inv.length ? inv.join(", ") : "(empty)"}` },
            { kind: "dim", text: "  'achievements' for badges  ·  'train' / 'speedrun' / 'pathfind' to grow" },
        ];
    }

    function xp() {
        const total = this.state.xp;
        const level = Math.max(1, 1 + Math.floor(total / 200));
        const into = total % 200;
        const filled = Math.round(into / 20);
        const bar = "█".repeat(filled) + "░".repeat(10 - filled);
        return [{ kind: "info", text: `Level ${level}  ${bar}  ${into}/200 to next level  (total ${total} XP)` }];
    }

    const plugin = {
        id: "progress",
        name: "Progress",
        version: "1.0.0",
        description: "XP levels, rank titles and the character sheet.",
        commands: { profile, xp },
        meta: {
            profile: { summary: "your character sheet: rank, XP, quests, badges, stats", usage: "profile", group: "progress" },
            xp: { summary: "your level and XP toward the next one", usage: "xp", group: "progress" },
        },
        hooks: {
            postExecute() { return checkRankUp.call(this); },
        },
    };

    global.BashcrawlPlugins = global.BashcrawlPlugins || {};
    global.BashcrawlPlugins.progress = { plugin, profile, xp, checkRankUp };
})(typeof globalThis !== "undefined" ? globalThis : window);
