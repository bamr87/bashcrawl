(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.mastery = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge mastery — a skill model of the learner, plus spaced review.
    //
    // Every successful `command.run` event (core/events.js) is practice: a
    // skill's mastery grows with real use, with every distinct flag the
    // learner discovers, and with each review answered correctly. Failures
    // are remembered too — they are what review should revisit first.
    //
    // `review` is a Leitner-box drill: a card answered correctly moves its
    // skill up a box and schedules it further out (1, 2, 4, 8, 16 days); a
    // miss drops it back to box 0, due now. Cards come from the app (question
    // -> accepted command lines -> why). The scheduler favours skills the
    // learner has actually touched, that are due, in the lowest box, with the
    // most failures — practice where it is weakest.
    //
    // The model is silent in the log: level-ups are `skill.levelled` events
    // for surfaces to toast. plugin(options) -> `skills` + `review`.

    const DAY_MS = 86400000;
    const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
    const MAX_BOX = INTERVAL_DAYS.length - 1;
    const LEVEL_SCORES = [1, 4, 10, 20, 35]; // score needed for levels 1..5
    const MAX_FLAGS = 12;

    function blankSkill() {
        return { uses: 0, fails: 0, flags: [], box: 0, due: 0 };
    }

    function cleanSkill(raw) {
        const rec = blankSkill();
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return rec;
        for (const key of ["uses", "fails", "due"]) {
            if (Number.isFinite(raw[key]) && raw[key] >= 0) rec[key] = Math.floor(raw[key]);
        }
        if (Number.isInteger(raw.box)) rec.box = Math.max(0, Math.min(MAX_BOX, raw.box));
        if (Array.isArray(raw.flags)) {
            rec.flags = raw.flags.filter((f) => typeof f === "string" && /^[A-Za-z0-9]$/.test(f)).slice(0, MAX_FLAGS);
        }
        return rec;
    }

    /** Mastery score and level (0 = never tried, 5 = master). */
    function scoreOf(rec) {
        if (!rec) return 0;
        return rec.uses + 2 * rec.flags.length + 3 * rec.box;
    }
    function levelOf(rec) {
        if (!rec || (!rec.uses && !rec.box)) return 0;
        const score = scoreOf(rec);
        let level = 0;
        LEVEL_SCORES.forEach((need, i) => { if (score >= need) level = i + 1; });
        return Math.max(1, level);
    }

    function normalize(line) {
        return String(line || "").trim().replace(/\s+/g, " ");
    }

    function accepts(card, raw) {
        const got = normalize(raw);
        return card.a.some((ans) => {
            const want = normalize(ans);
            return got === want || (want === want.toLowerCase() && got.toLowerCase() === want);
        });
    }

    function meter(level, width) {
        return "█".repeat(level) + "░".repeat(width - level);
    }

    const DEFAULT_TEXT = {
        masteryLevels: ["not yet tried", "Novice", "Apprentice", "Adept", "Expert", "Master"],
        skillsTitle: (practised, total, due) => `🧠 Skills — ${practised}/${total} practised${due ? ` · ${due} due for review` : ""}`,
        skillsFooter: "`review` drills your weakest, most-due skills · `skills NAME` for one skill",
        skillsUnknown: (name) => `No such skill: ${name}. Type skills to see them all.`,
        skillDetail: (name, label) => `🧠 ${name} — ${label}`,
        reviewEmpty: "Nothing to review yet: the deck is empty.",
        reviewStart: (n) => `🃏 Review — ${n} card${n === 1 ? "" : "s"}, weakest and most-due skills first. hint · skip · quit`,
        reviewCard: (pos, total, skill, q) => `🃏 ${pos}/${total}  [${skill}]  ${q}`,
        reviewRight: (box, days) => `✅ Correct — moved up to box ${box}; next review in ${days} day${days === 1 ? "" : "s"}.`,
        reviewRetry: (raw) => `❌ "${raw}" is not it. One more try, or type hint.`,
        reviewWrong: (answer, why) => `❌ The answer: ${answer}${why ? `  — ${why}` : ""}  (back to box 0)`,
        reviewSkip: (answer) => `↷ Skipped. The answer: ${answer}`,
        reviewHint: (hint) => `💡 ${hint}`,
        reviewDone: (right, total) => `🏁 Review complete — ${right}/${total} correct.`,
        reviewQuit: "Review ended early; progress so far is kept.",
        reviewQuitEmpty: "Review ended early — no cards answered, nothing counted.",
        reviewPartial: (right, answered, total) => `Review ended early — ${right}/${answered} correct (${answered} of ${total} cards). Card progress is kept; finish a whole review to count it.`,
        reviewNext: (when) => (when ? `Next card due ${when}.` : "Every skill you know is scheduled — come back tomorrow."),
        reviewBusy: (reason) => reason,
        reviewPrompt: (pos, total) => `review ${pos}/${total} ❯`,
    };

    /**
     * options:
     *   skills: [{ group, commands: [names] }]   the tracked skills, grouped
     *   cards:  [{ skill, q, a: [lines], why? }] the review deck
     *   size:   cards per review session (default 5)
     *   xpPerCard: XP for each correct answer (default 5)
     *   award(shell, amount, reason)  XP sink (default: shell.awardXp if present)
     *   busy(shell) -> string|null    a reason review cannot start right now
     */
    function plugin(options) {
        const opts = options || {};
        const groups = (opts.skills || []).map((g) => ({ group: String(g.group), commands: (g.commands || []).map(String) }));
        const skillGroup = new Map();
        for (const g of groups) for (const cmd of g.commands) if (!skillGroup.has(cmd)) skillGroup.set(cmd, g.group);
        // The real short flags of each command (`flags: {ls: "aFl"}` on a
        // skill group). Only these count toward the skill map, so `ls -z`
        // is not a discovered flag; a command with no entry counts none.
        const validFlags = new Map();
        for (const g of opts.skills || []) {
            const table = g && g.flags && typeof g.flags === "object" && !Array.isArray(g.flags) ? g.flags : {};
            for (const [cmd, letters] of Object.entries(table)) {
                if (skillGroup.has(cmd) && typeof letters === "string") validFlags.set(cmd, new Set(letters.split("")));
            }
        }
        function isValidFlag(cmd, letter) {
            const set = validFlags.get(cmd);
            return Boolean(set && set.has(letter));
        }
        const cards = (opts.cards || []).filter((c) => c && skillGroup.has(c.skill) && Array.isArray(c.a) && c.a.length && c.q);
        const size = Math.max(1, Number(opts.size) || 5);
        const xpPerCard = opts.xpPerCard == null ? 5 : Number(opts.xpPerCard);
        const award = typeof opts.award === "function"
            ? opts.award
            : (shell, amount, reason) => { if (typeof shell.awardXp === "function") shell.awardXp(amount, reason); };

        function slice(shell) { return shell.pluginState("mastery"); }
        function record(shell, name) {
            const s = slice(shell);
            if (!s.skills[name]) s.skills[name] = blankSkill();
            return s.skills[name];
        }
        function label(shell, level) { return shell.text("masteryLevels")[level] || String(level); }

        function observe(event) {
            if (!skillGroup.has(event.cmd)) return;
            const rec = record(this, event.cmd);
            const before = levelOf(rec);
            if (event.ok) {
                rec.uses += 1;
                for (const arg of event.args || []) {
                    if (!/^-[A-Za-z0-9]+$/.test(arg)) continue;
                    for (const letter of arg.slice(1)) {
                        if (!isValidFlag(event.cmd, letter)) continue;
                        if (!rec.flags.includes(letter) && rec.flags.length < MAX_FLAGS) rec.flags.push(letter);
                    }
                }
            } else {
                rec.fails += 1;
            }
            const after = levelOf(rec);
            if (after > before) this.emit("skill.levelled", { skill: event.cmd, level: after, label: label(this, after) });
        }

        function dueCount(shell) {
            const now = shell.clock.now();
            return Object.entries(slice(shell).skills)
                .filter(([name, rec]) => skillGroup.has(name) && (rec.uses || rec.box) && rec.due <= now).length;
        }

        function skills(args) {
            const s = slice(this);
            const name = args[0];
            if (name) {
                if (!skillGroup.has(name)) return [{ kind: "error", text: this.text("skillsUnknown", name) }];
                const rec = cleanSkill(s.skills[name]);
                const level = levelOf(rec);
                const dueIn = Math.max(0, Math.ceil((rec.due - this.clock.now()) / DAY_MS));
                return [
                    { kind: "magic", text: this.text("skillDetail", name, label(this, level)) },
                    { kind: "output", text: `   mastery   ${meter(level, 5)}  level ${level}/5 (${scoreOf(rec)} pts)` },
                    { kind: "output", text: `   practice  ${rec.uses} successful · ${rec.fails} failed` },
                    { kind: "output", text: `   flags     ${rec.flags.length ? rec.flags.map((f) => `-${f}`).join(" ") : "(none yet)"}` },
                    { kind: "output", text: `   review    box ${rec.box}/${MAX_BOX} · ${rec.uses || rec.box ? (dueIn ? `due in ${dueIn} day${dueIn === 1 ? "" : "s"}` : "due now") : "not scheduled"}` },
                    { kind: "dim", text: `   group     ${skillGroup.get(name)}` },
                ];
            }
            const practised = Object.keys(s.skills).filter((n) => skillGroup.has(n) && levelOf(s.skills[n]) > 0).length;
            const out = [{ kind: "magic", text: this.text("skillsTitle", practised, skillGroup.size, dueCount(this)) }];
            const width = Math.max(...Array.from(skillGroup.keys(), (n) => n.length));
            for (const g of groups) {
                out.push({ kind: "info", text: g.group });
                for (const cmd of g.commands) {
                    if (skillGroup.get(cmd) !== g.group) continue;
                    const rec = s.skills[cmd];
                    const level = levelOf(rec);
                    const flags = rec && rec.flags.length ? `  ${rec.flags.map((f) => `-${f}`).join(" ")}` : "";
                    out.push({
                        kind: level ? "output" : "dim",
                        text: `  ${cmd.padEnd(width)}  ${meter(level, 5)}  ${label(this, level)}${flags}`,
                    });
                }
            }
            out.push({ kind: "dim", text: this.text("skillsFooter") });
            return out;
        }

        // Session picking: one card per skill where possible, ordered by
        // (touched & due) -> touched -> untouched, then lowest box, then most
        // failures; the shell rng breaks ties so sessions vary.
        function pickCards(shell) {
            const s = slice(shell);
            const now = shell.clock.now();
            const ranked = cards.map((card, index) => {
                const rec = s.skills[card.skill];
                const touched = Boolean(rec && (rec.uses || rec.fails || rec.box));
                const due = !rec || rec.due <= now;
                const tier = touched && due ? 0 : touched ? 1 : 2;
                return { index, skill: card.skill, key: [tier, rec ? rec.box : 0, -(rec ? rec.fails : 0), shell.rng()] };
            }).sort((x, y) => {
                for (let i = 0; i < x.key.length; i += 1) if (x.key[i] !== y.key[i]) return x.key[i] - y.key[i];
                return x.index - y.index;
            });
            const picked = [];
            const skillsUsed = new Set();
            for (const pass of [true, false]) {
                for (const item of ranked) {
                    if (picked.length >= size) break;
                    if (picked.includes(item.index) || (pass && skillsUsed.has(item.skill))) continue;
                    picked.push(item.index);
                    skillsUsed.add(item.skill);
                }
            }
            return picked;
        }

        function cardLine(shell) {
            const r = slice(shell).review;
            const card = cards[r.queue[r.pos]];
            return [{ kind: "magic", text: shell.text("reviewCard", r.pos + 1, r.queue.length, card.skill, card.q) }];
        }

        function review() {
            const reason = typeof opts.busy === "function" ? opts.busy(this) : null;
            if (reason) return [{ kind: "error", text: this.text("reviewBusy", reason) }];
            if (!cards.length) return [{ kind: "dim", text: this.text("reviewEmpty") }];
            const queue = pickCards(this);
            slice(this).review = { queue, pos: 0, right: 0, tries: 0 };
            return [{ kind: "info", text: this.text("reviewStart", queue.length) }, ...cardLine(this)];
        }

        // A review counts (mastery.reviews, which the "finished a review"
        // badge and anything keyed on it read) only when every card was
        // answered. Quitting early keeps the per-card progress already made
        // but is not a finished review; quitting before answering anything
        // earns and reports nothing.
        function finish(shell, quit) {
            const s = slice(shell);
            const r = s.review;
            s.review = null;
            if (quit && r.pos === 0) return [{ kind: "dim", text: shell.text("reviewQuitEmpty") }];
            if (!quit) s.reviews += 1;
            const now = shell.clock.now();
            const next = Object.entries(s.skills)
                .filter(([name, rec]) => skillGroup.has(name) && (rec.uses || rec.box) && rec.due > now)
                .map(([, rec]) => rec.due).sort((a, b) => a - b)[0];
            const days = next ? Math.ceil((next - now) / DAY_MS) : 0;
            const out = [];
            if (quit) out.push({ kind: "dim", text: shell.text("reviewPartial", r.right, r.pos, r.queue.length) });
            else out.push({ kind: "success", text: shell.text("reviewDone", r.right, r.queue.length) });
            out.push({ kind: "dim", text: shell.text("reviewNext", dueCount(shell) ? "now" : next ? `in ${days} day${days === 1 ? "" : "s"}` : "") });
            return out;
        }

        function advance(shell) {
            const r = slice(shell).review;
            r.pos += 1;
            r.tries = 0;
            return r.pos >= r.queue.length ? finish(shell, false) : cardLine(shell);
        }

        function answer(raw) {
            const s = slice(this);
            const r = s.review;
            const card = cards[r.queue[r.pos]];
            if (!card) { s.review = null; return [{ kind: "dim", text: this.text("reviewQuit") }]; }
            const line = normalize(raw);
            if (["quit", "exit", "q", ":q"].includes(line.toLowerCase())) return finish(this, true);
            const rec = record(this, card.skill);
            if (line.toLowerCase() === "hint") {
                const first = card.a[0];
                return [{ kind: "dim", text: this.text("reviewHint", card.why || `${first.split(" ")[0]} …`) }];
            }
            if (line.toLowerCase() === "skip") {
                rec.box = 0;
                rec.due = this.clock.now();
                return [{ kind: "dim", text: this.text("reviewSkip", card.a[0]) }, ...advance(this)];
            }
            if (accepts(card, raw)) {
                const before = levelOf(rec);
                rec.box = Math.min(MAX_BOX, rec.box + 1);
                rec.due = this.clock.now() + INTERVAL_DAYS[rec.box] * DAY_MS;
                r.right += 1;
                if (xpPerCard) award(this, xpPerCard, "review");
                const after = levelOf(rec);
                if (after > before) this.emit("skill.levelled", { skill: card.skill, level: after, label: label(this, after) });
                return [{ kind: "success", text: this.text("reviewRight", rec.box, INTERVAL_DAYS[rec.box]) }, ...advance(this)];
            }
            r.tries += 1;
            if (r.tries < 2) return [{ kind: "error", text: this.text("reviewRetry", raw.trim()) }];
            rec.box = 0;
            rec.due = this.clock.now();
            rec.fails += 1;
            return [{ kind: "error", text: this.text("reviewWrong", card.a[0], card.why) }, ...advance(this)];
        }

        return {
            id: "mastery",
            name: "Mastery",
            version: "1.0.0",
            description: "A skill map built from real use, and a spaced-repetition review deck.",
            commands: { skills, review },
            meta: {
                skills: { summary: "your skill map: mastery per command, grown by real use", usage: "skills [NAME]", group: "learn" },
                review: { summary: "a spaced-repetition drill of your weakest, most-due skills", usage: "review", group: "learn" },
            },
            events: { "command.run": observe },
            hooks: {
                interceptLine(line) {
                    const r = slice(this).review;
                    return r ? answer.call(this, line) : null;
                },
                promptLabel() {
                    const r = slice(this).review;
                    return r ? this.text("reviewPrompt", Math.min(r.pos + 1, r.queue.length), r.queue.length) : null;
                },
            },
            uiText: DEFAULT_TEXT,
            state: {
                key: "mastery",
                defaults: () => ({ skills: {}, review: null, reviews: 0 }),
                sanitize(s) {
                    const skills = {};
                    if (s.skills && typeof s.skills === "object" && !Array.isArray(s.skills)) {
                        for (const [name, raw] of Object.entries(s.skills)) {
                            if (skillGroup.has(name)) skills[name] = cleanSkill(raw);
                        }
                    }
                    for (const [name, rec] of Object.entries(skills)) {
                        rec.flags = rec.flags.filter((f) => isValidFlag(name, f));
                    }
                    s.skills = skills;
                    const r = s.review;
                    s.review = r && typeof r === "object" && Array.isArray(r.queue) && r.queue.length
                        && r.queue.every((i) => Number.isInteger(i) && i >= 0 && i < cards.length)
                        && Number.isInteger(r.pos) && r.pos >= 0 && r.pos < r.queue.length
                        ? {
                            queue: r.queue.slice(0, 50),
                            pos: r.pos,
                            right: Number.isInteger(r.right) && r.right >= 0 ? r.right : 0,
                            tries: r.tries === 1 ? 1 : 0,
                        }
                        : null;
                    if (!Number.isInteger(s.reviews) || s.reviews < 0) s.reviews = 0;
                },
            },
        };
    }

    return { plugin, levelOf, scoreOf, cleanSkill, accepts, INTERVAL_DAYS, DEFAULT_TEXT };
});
