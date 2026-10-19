(function initAchievementsPlugin(global) {
    "use strict";
    // ── Achievements ─────────────────────────────────────────────────────────
    // The badge catalog is data: src/help/data/progression.yaml
    // (`achievements`), each with a TermForge rule in `when` (core/rules.js)
    // checked against the session state after every line. Earned once, each
    // worth its `xp` (default 5). Icons use only emoji verified to render in
    // COLOR in the monospace log.
    //
    // A TermForge plugin (docs/schemas/plugin.v1.md). Functions run with
    // `this` = the game Runtime.

    // Evaluate the catalog against current state; award any newly-earned
    // badge (once each) and return announcement lines.
    function check() {
        if (!Array.isArray(this.state.achievements)) this.state.achievements = [];
        const have = this.state.achievements;
        const rules = global.TermForge.rules;
        const out = [];
        for (const a of this.catalog.achievements) {
            if (have.includes(a.id)) continue;
            let earned = false;
            try { earned = rules.evaluate(a.when, { state: this.state, shell: this }); } catch (e) { earned = false; }
            if (!earned) continue;
            have.push(a.id);
            const xp = a.xp == null ? 5 : Number(a.xp);
            this.awardXp(xp, "achievement");
            this.emit("achievement.unlocked", { id: a.id, title: a.title, icon: a.icon });
            out.push({ kind: "success", text: `${a.icon} Achievement unlocked: ${a.title} — ${a.desc}  (+${xp} XP)` });
        }
        return out;
    }

    function achievements() {
        const have = this.state.achievements || [];
        const catalog = this.catalog.achievements;
        const lines = [{ kind: "magic", text: `🏅 Achievements — ${have.length}/${catalog.length} unlocked` }];
        for (const a of catalog) {
            const got = have.includes(a.id);
            lines.push({
                kind: got ? "success" : "dim",
                text: got ? `${a.icon} ${a.title} — ${a.desc}` : `🔒 ${a.title} — ${a.desc}`,
            });
        }
        return lines;
    }

    const plugin = {
        id: "achievements",
        name: "Achievements",
        version: "1.0.0",
        description: "Badges earned by play, declared as rules in progression.yaml.",
        commands: { achievements },
        meta: { achievements: { summary: "the badge catalogue and what you have unlocked", usage: "achievements", group: "progress" } },
        hooks: {
            // Achievements run first among the postExecute subscribers: they
            // award XP that the daily goal and rank-up then read.
            postExecute() { return check.call(this); },
        },
    };

    global.BashcrawlPlugins = global.BashcrawlPlugins || {};
    global.BashcrawlPlugins.achievements = { plugin, achievements, check };
})(typeof globalThis !== "undefined" ? globalThis : window);
