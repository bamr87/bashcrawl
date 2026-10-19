(function initArenaPlugin(global) {
    "use strict";
    // ── The Training Arena (+ Speed Run) ─────────────────────────────────────
    // Riddle -> the real command(s) that answer it. Players practice by
    // casting actual spells (active recall), the most durable way to memorise.
    // The riddles live in src/help/data/progression.yaml (`trials`), read
    // through the runtime's catalog; while a run is active every input line is
    // an answer, not a command (the interceptLine hook).
    //
    // A TermForge plugin (docs/schemas/plugin.v1.md). Functions run with
    // `this` = the game Runtime.

    const QUIT_WORDS = ["quit", "exit", ":q", "q"];

    function train() {
        return startArena.call(this, false);
    }

    function speedrun() {
        return startArena.call(this, true);
    }

    function startArena(speed) {
        const review = this.state.mastery && this.state.mastery.review;
        if (review) return [{ kind: "error", text: "Finish or quit your review first (type 'quit')." }];
        const trials = this.catalog.trials;
        if (!trials.length) return [{ kind: "dim", text: "The arena stands empty: no trials are loaded." }];
        const count = Math.min(8, trials.length);
        const pool = trials.map((_, i) => i);
        for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = Math.floor(this.rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        this.state.trainer = {
            queue: pool.slice(0, count), pos: 0, score: 0, streak: 0, best: 0, tries: 0,
            active: true, speed: !!speed, startedAt: speed ? this.clock.now() : 0,
        };
        if (speed) {
            const best = this.state.speedrunBest;
            return [
                { kind: "art", text: this.art("arena-open") },
                { kind: "magic", text: `SPEED RUN — clear ${count} trials against the clock!` },
                { kind: "dim", text: best != null ? `Your best: ${best.toFixed(1)}s. Beat it!` : "No record yet — set the first time!" },
                { kind: "dim", text: "Answer fast.  skip = pass · quit = leave" },
                ...challenge.call(this),
            ];
        }
        return [
            { kind: "art", text: this.art("arena-open") },
            { kind: "info", text: `${count} trials await. Answer each by casting the real spell.` },
            { kind: "dim", text: "Commands:  hint = clue · skip = pass · quit = leave the arena" },
            ...challenge.call(this),
        ];
    }

    function challenge() {
        const t = this.state.trainer;
        const q = this.catalog.trials[t.queue[t.pos]];
        const flame = t.streak >= 3 ? "  🔥" : "";
        return [
            { kind: "magic", text: `✨  Trial ${t.pos + 1}/${t.queue.length}   ·   Score ${t.score} XP   ·   Streak ${t.streak}${flame}` },
            { kind: "output", text: `    ${q.riddle}` },
        ];
    }

    function answer(raw) {
        const t = this.state.trainer;
        const cmd = raw.trim().replace(/\s+/g, " ").toLowerCase();
        if (QUIT_WORDS.includes(cmd)) return finish.call(this, true);
        const q = this.catalog.trials[t.queue[t.pos]];
        if (cmd === "hint") return [{ kind: "dim", text: `💡 ${q.hint}` }];
        if (cmd === "skip") {
            t.streak = 0; t.tries = 0; t.pos += 1;
            return [{ kind: "dim", text: `↷ Skipped. The spell was:  ${q.answers[0]}  — ${q.teaches}` }, ...advance.call(this)];
        }
        if (q.answers.includes(cmd)) {
            const gained = 10 + Math.min(t.streak, 5) * 2;
            t.score += gained; t.streak += 1; t.best = Math.max(t.best, t.streak);
            this.awardXp(gained, "arena");
            t.tries = 0; t.pos += 1;
            const cheer = t.streak >= 3 ? `  🔥 ${t.streak} in a row!` : "";
            return [{ kind: "success", text: `✅ Correct!  +${gained} XP${cheer}   ${q.teaches}` }, ...advance.call(this)];
        }
        t.tries += 1; t.streak = 0;
        if (t.tries >= 2) {
            t.tries = 0; t.pos += 1;
            return [{ kind: "error", text: `❌ The spell was:  ${q.answers[0]}  — ${q.teaches}` }, ...advance.call(this)];
        }
        return [{ kind: "error", text: `❌ "${raw.trim()}" fizzles. Try once more, or type 'hint'.` }];
    }

    function advance() {
        const t = this.state.trainer;
        if (t.pos >= t.queue.length) return finish.call(this, false);
        return challenge.call(this);
    }

    function finish(quit) {
        const t = this.state.trainer;
        const answered = t.pos;
        const rank = this.rankFor(t.score);
        const completed = answered >= t.queue.length;
        if (completed) this.state.flags.arena_cleared = true;
        this.state.trainer = null;
        const lines = [];
        if (quit) lines.push({ kind: "dim", text: "You lower your blade and step out of the arena." });
        lines.push({ kind: "art", text: this.art("arena-done") });
        lines.push({ kind: "info", text: `Trials answered: ${answered}/${t.queue.length}   ·   Earned: ${t.score} XP   ·   Best streak: ${t.best}` });
        // Speed Run: record elapsed time and best, only on a full clear.
        if (t.speed && completed && t.startedAt) {
            const elapsed = Math.round((this.clock.now() - t.startedAt) / 100) / 10;
            const prevBest = this.state.speedrunBest;
            const isRecord = prevBest == null || elapsed < prevBest;
            if (isRecord) this.state.speedrunBest = elapsed;
            lines.push({ kind: "magic", text: `⏱  Time: ${elapsed.toFixed(1)}s` });
            lines.push(isRecord
                ? { kind: "success", text: `🏆 NEW RECORD!  (previous: ${prevBest != null ? prevBest.toFixed(1) + "s" : "none"})` }
                : { kind: "dim", text: `Best: ${prevBest.toFixed(1)}s — try again to beat it.` });
        }
        lines.push({ kind: "success", text: `🏅 Rank attained:  ${rank.title}` });
        lines.push({ kind: "dim", text: t.speed ? "Type 'speedrun' to race again, or 'train' for untimed practice." : "Type 'train' to drill again, or return to exploring the dungeon." });
        return lines;
    }

    const plugin = {
        id: "arena",
        name: "Training Arena",
        version: "1.0.0",
        description: "Drill commands from memory (train), or race the clock (speedrun).",
        commands: { train, speedrun },
        meta: {
            train: { summary: "drill spells from memory in the Training Arena", usage: "train", group: "games" },
            speedrun: { summary: "clear the arena's trials against the clock", usage: "speedrun", group: "games" },
        },
        hooks: {
            // While a run is active, every line is an answer, not a command.
            interceptLine(line) {
                return (this.state.trainer && this.state.trainer.active) ? answer.call(this, line) : null;
            },
        },
    };

    global.BashcrawlPlugins = global.BashcrawlPlugins || {};
    global.BashcrawlPlugins.arena = { plugin, train, speedrun, challenge, answer };
})(typeof globalThis !== "undefined" ? globalThis : window);
