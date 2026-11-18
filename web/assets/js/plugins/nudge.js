(function initNudgePlugin(global) {
    "use strict";
    // ── The "Stuck?" nudge ──────────────────────────────────────────────────
    // Counts command lines that failed in a row (any kind:"error" output, the
    // same test the line.executed event uses) in state.stats.errorStreak. The
    // third failure appends one dim line pointing at the recovery commands
    // and starts the count again; a line without an error resets it (#105).
    // Lines typed while a mode captures input (an arena run, a review
    // session) are answers, not commands: they neither count nor reset.
    //
    // A TermForge plugin (docs/schemas/plugin.v1.md). Functions run with
    // `this` = the game Runtime. Installed last in GAME_PLUGINS, so the nudge
    // follows any rank-up the line earned.

    const THRESHOLD = 3;
    const capturedAtStart = new WeakMap();

    // Whether a mode owns the input line (checked before the line runs, so
    // the answer that ends an arena run is still treated as an answer).
    function capturing() {
        const t = this.state.trainer;
        return Boolean(t && t.active) || this.hooks.first("promptLabel") != null;
    }

    const NUDGE = "Stuck? Try `hint`, `ls -a` or `cat scroll`.";

    function track(line, outputs) {
        if (capturedAtStart.get(this) || !String(line || "").trim()) return [];
        const stats = this.state.stats;
        if (!(outputs || []).some((o) => o && o.kind === "error")) {
            stats.errorStreak = 0;
            return [];
        }
        const streak = (Number.isInteger(stats.errorStreak) && stats.errorStreak > 0 ? stats.errorStreak : 0) + 1;
        if (streak < THRESHOLD) {
            stats.errorStreak = streak;
            return [];
        }
        stats.errorStreak = 0;
        return [{ kind: "dim", text: NUDGE }];
    }

    const plugin = {
        id: "nudge",
        name: "Stuck nudge",
        version: "1.0.0",
        description: "After three failed commands in a row, point at hint, ls -a and cat scroll.",
        hooks: {
            preExecute() { capturedAtStart.set(this, capturing.call(this)); },
            postExecute(line, outputs) { return track.call(this, line, outputs); },
        },
    };

    global.BashcrawlPlugins = global.BashcrawlPlugins || {};
    global.BashcrawlPlugins.nudge = { plugin, track, THRESHOLD, NUDGE };
})(typeof globalThis !== "undefined" ? globalThis : window);
