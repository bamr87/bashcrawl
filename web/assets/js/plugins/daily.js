(function initDailyPlugin(global) {
    "use strict";
    // ── Daily Challenge ──────────────────────────────────────────────────────
    // Each local day offers an XP goal; completing it on consecutive days
    // builds a streak. Rolls over automatically on the first command of a new
    // day (preExecute), judged after every line (postExecute). The shell
    // clock is injectable, so goldens pin the date.
    //
    // A TermForge plugin (docs/schemas/plugin.v1.md). Functions run with
    // `this` = the game Runtime.

    // Local-day helpers, fed from the shell clock.
    function isoDay(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }
    function todayStr(nowMs) { return isoDay(new Date(nowMs)); }
    function yesterdayStr(nowMs) { return isoDay(new Date(nowMs - 86400000)); }
    function dailyGoalFor(dateStr) {
        let h = 0;
        for (const c of dateStr) h += c.charCodeAt(0);
        return 30 + (h % 4) * 10; // 30 / 40 / 50 / 60
    }

    function refresh() {
        if (!this.state.daily) {
            this.state.daily = { date: null, baselineXp: 0, goal: 0, completed: false, streak: 0, lastDate: null };
        }
        const d = this.state.daily;
        const today = todayStr(this.clock.now());
        if (d.date === today) return;
        // New day: reset the day's progress (streak is judged on completion).
        d.date = today;
        d.baselineXp = this.state.xp;
        d.goal = dailyGoalFor(today);
        d.completed = false;
    }

    function check() {
        const d = this.state.daily;
        if (!d || d.completed || !d.date) return [];
        const earned = this.state.xp - d.baselineXp;
        if (earned < d.goal) return [];
        d.completed = true;
        d.streak = (d.lastDate === yesterdayStr(this.clock.now())) ? d.streak + 1 : 1;
        d.lastDate = d.date;
        this.awardXp(25, "daily");
        return [
            { kind: "success", text: `🔥 Daily challenge complete!  +25 XP  ·  Streak: ${d.streak} day${d.streak === 1 ? "" : "s"}` },
            { kind: "dim", text: "Come back tomorrow to keep the streak alive." },
        ];
    }

    function daily() {
        refresh.call(this);
        const d = this.state.daily;
        const earned = Math.max(0, this.state.xp - d.baselineXp);
        return [
            { kind: "magic", text: `✨ Daily Challenge — ${d.date}` },
            { kind: "output", text: `   Goal:     earn ${d.goal} XP today` },
            { kind: "output", text: `   Progress: ${d.completed ? "✅ complete" : `${Math.min(earned, d.goal)}/${d.goal} XP`}` },
            { kind: "output", text: `   Streak:   ${d.streak} day${d.streak === 1 ? "" : "s"}` },
            { kind: "dim", text: d.completed ? "   Done! Return tomorrow to extend your streak." : "   Earn XP via train / speedrun / pathfind / encounters / badges." },
        ];
    }

    const plugin = {
        id: "daily",
        name: "Daily Challenge",
        version: "1.0.0",
        description: "A daily XP goal with a streak for consecutive days.",
        commands: { daily },
        meta: { daily: { summary: "today's XP challenge and your streak", usage: "daily", group: "progress" } },
        hooks: {
            preExecute() { refresh.call(this); },
            postExecute() { return check.call(this); },
        },
    };

    global.BashcrawlPlugins = global.BashcrawlPlugins || {};
    global.BashcrawlPlugins.daily = { plugin, daily, refresh, check, dailyGoalFor };
})(typeof globalThis !== "undefined" ? globalThis : window);
