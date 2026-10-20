/* Bashcrawl Practice Arcade — mini-game framework over the shared bash kernel.
 *
 * Every filesystem game is (seed world + goal predicate + scoring) running on a
 * SCOPED BashcrawlRuntime instance, so players practice against the exact same
 * emulator the story mode uses — nothing is faked. Content comes from
 * data/arcade.json, generated from the YAML registries by export_static_web.py.
 *
 * Games:
 *   pathnav — Path Navigator: reach a target room with cd/ls/tree (real dungeon).
 *   hunt    — grep/find Hunt: locate the file carrying the sigil.
 *   pipes   — Pipe Puzzle: transform INPUT into TARGET with a pipeline.
 *   flash   — Command Flash: rapid-fire "which command?" drills.
 *   vim     — Vim Catacombs: VIM Adventures-style levels on a vim buffer
 *             (web/assets/js/vim.js); keys unlock level by level.
 *
 * The React app's arcade store (web/src/arcade/arcade-store.ts) runs these
 * games on a scoped runtime, keeps the scores, and hands XP back to the story.
 */
(function initArcade(global) {
    const SCORES_KEY = "bashcrawl-web-arcade-v1";

    const escapeHtml = global.TermForge.sinks.escapeHtml;

    // Whitespace-forgiving canonical form for pipe-puzzle output comparison:
    // leading/trailing space and internal runs collapse, blank edges drop.
    function canonical(text) {
        return String(text ?? "")
            .split("\n")
            .map((line) => line.trim().replace(/\s+/g, " "))
            .join("\n")
            .replace(/^\n+|\n+$/g, "");
    }

    function normalizeAnswer(line) {
        return String(line || "").trim().replace(/\s+/g, " ");
    }

    function scopedRuntime(world) {
        const RT = global.BashcrawlRuntime;
        // Sandbox trial: bare mode skips the game's hook spine (achievements/
        // daily/rank side-band output), so story flavor never leaks into a trial.
        return new RT.Runtime(
            { world, quests: { quests: [] }, commands: { categories: {}, quick_ref: {}, runtime: [] } },
            RT.defaultState(world.root),
            { bare: true }
        );
    }

    // Build a Runtime world object from a hunt scenario's tree/files spec.
    function worldFromScenario(scenario) {
        const directories = {};
        for (const [dir, names] of Object.entries(scenario.tree || {})) {
            directories[dir] = (names || []).map((raw) => {
                const isDir = raw.endsWith("/");
                const name = isDir ? raw.slice(0, -1) : raw;
                return { name, type: isDir ? "dir" : "file", hidden: name.startsWith(".") };
            });
        }
        return {
            root: "/hunt",
            directories,
            files: { ...(scenario.files || {}) },
            rooms: {},
            encounters: {},
        };
    }

    // Commands that would start story-mode features inside a scoped sandbox.
    const BLOCKED_IN_GAME = new Set([
        "train", "drill", "practice", "arena", "speedrun", "speed",
        "pathfind", "seek", "journey", "daily", "challenge", "save", "reset",
    ]);

    // ── Game definitions ────────────────────────────────────────────────

    const PathNavigator = {
        id: "pathnav",
        title: "Path Navigator",
        icon: "🧭",
        tagline: "Race through the real dungeon to a target room.",
        concepts: ["cd", "ls", "tree", "pwd", "paths"],
        needsWorld: true,
        makeScenario(data) {
            // Candidate rooms: visible (no dot-segment) real dungeon dirs below /entrance.
            const dirs = Object.keys(data.world.directories).filter((path) => {
                if (path === data.world.root) return false;
                if (path.split("/").some((part) => part.startsWith("."))) return false;
                return path.split("/").length >= 4; // at least two hops deep — a real journey
            });
            const target = dirs[Math.floor(Math.random() * dirs.length)] || "/entrance/cellar/armoury";
            const meta = data.world.rooms[target] || {};
            const depth = target.split("/").filter(Boolean).length - 1;
            return {
                world: data.world,
                target,
                targetName: target.split("/").pop(),
                targetTitle: meta.title || target.split("/").pop(),
                par: depth * 2, // one look + one move per level is an honest run
            };
        },
        intro(ctx) {
            return [
                { kind: "magic", text: `Seek the room called “${ctx.targetTitle}” (${ctx.targetName}).` },
                { kind: "info", text: "Move with cd, look with ls / tree, check where you are with pwd." },
                { kind: "dim", text: "Fewer commands = higher score. Type hint if lost, quit to abandon." },
            ];
        },
        objective(ctx) {
            return `Reach ${ctx.targetName} — “${ctx.targetTitle}”`;
        },
        hintFor(ctx) {
            // Reveal one more path segment each time hint is asked.
            const parts = ctx.target.split("/").filter(Boolean);
            const shown = Math.min(1 + (ctx.hints || 0), parts.length);
            return `The way runs: /${parts.slice(0, shown).join("/")}${shown < parts.length ? "/…" : ""}`;
        },
        input(line, ctx) {
            const outputs = ctx.rt.execute(line);
            const done = ctx.rt.state.cwd === ctx.target;
            return { outputs, done, success: done };
        },
        scoreFor(ctx) {
            const over = Math.max(0, ctx.moves - ctx.par);
            let score = Math.max(25, 100 - over * 5 - (ctx.hints || 0) * 10);
            const seconds = (Date.now() - ctx.startedAt) / 1000;
            if (seconds <= 60) score += 15;
            return { score: Math.round(score), detail: `${ctx.moves} commands (par ${ctx.par}) in ${Math.round(seconds)}s` };
        },
    };

    const Hunt = {
        id: "hunt",
        title: "grep/find Hunt",
        icon: "🔍",
        tagline: "One file carries the sigil. Track it down.",
        concepts: ["grep", "find", "flags", "hidden files"],
        needsWorld: true,
        makeScenario(data, persist) {
            const pool = data.arcade.hunt_scenarios || [];
            if (!pool.length) return null; // arcade.json missing/empty — start() toasts
            const played = (persist.games.hunt && persist.games.hunt.seen) || [];
            const fresh = pool.filter((s) => !played.includes(s.id));
            const scenario = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
            if (!scenario) return null;
            return {
                world: worldFromScenario(scenario),
                scenario,
                par: scenario.par || 3,
            };
        },
        intro(ctx) {
            return [
                { kind: "magic", text: ctx.scenario.title },
                { kind: "info", text: ctx.scenario.brief },
                { kind: "dim", text: "You win the moment the sigil text appears on screen. hint for a nudge, quit to abandon." },
            ];
        },
        objective(ctx) {
            return ctx.scenario.brief;
        },
        hintFor(ctx) {
            return ctx.scenario.hint;
        },
        input(line, ctx) {
            const outputs = ctx.rt.execute(line);
            const text = outputs.map((o) => o.text || "").join("\n");
            const done = text.includes(ctx.scenario.sigil);
            return { outputs, done, success: done };
        },
        scoreFor(ctx) {
            const over = Math.max(0, ctx.moves - ctx.par);
            const score = Math.max(25, 100 - over * 8 - (ctx.hints || 0) * 10);
            const seconds = (Date.now() - ctx.startedAt) / 1000;
            return { score: Math.round(score), detail: `${ctx.moves} commands (par ${ctx.par}) in ${Math.round(seconds)}s` };
        },
    };

    const PipePuzzle = {
        id: "pipes",
        title: "Pipe Puzzle",
        icon: "🔗",
        tagline: "Forge a pipeline that turns INPUT into TARGET.",
        concepts: ["pipes", "sort", "uniq", "grep", "cut", "tr", "sed"],
        needsWorld: true,
        makeScenario(data, persist) {
            const pool = data.arcade.pipe_puzzles || [];
            if (!pool.length) return null; // arcade.json missing/empty — start() toasts
            const played = (persist.games.pipes && persist.games.pipes.seen) || [];
            const fresh = pool.filter((s) => !played.includes(s.id));
            const scenario = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
            if (!scenario) return null;
            const file = `/puzzle/${scenario.file}`;
            return {
                world: {
                    root: "/puzzle",
                    directories: { "/puzzle": [{ name: scenario.file, type: "file", hidden: false }] },
                    files: { [file]: scenario.input },
                    rooms: {},
                    encounters: {},
                },
                scenario,
                attempts: 0,
                par: scenario.par || 2,
            };
        },
        intro(ctx) {
            const targetBlock = ctx.scenario.target.split("\n").map((l) => `   ${l}`).join("\n");
            return [
                { kind: "magic", text: ctx.scenario.title },
                { kind: "info", text: ctx.scenario.brief },
                { kind: "output", text: `Your material: ${ctx.scenario.file}  (cat it to inspect)` },
                { kind: "success", text: "TARGET OUTPUT ↓" },
                { kind: "art", text: targetBlock },
                { kind: "dim", text: `Par: ${ctx.par} command${ctx.par === 1 ? "" : "s"} in the pipeline. Whitespace is forgiven. hint / quit available.` },
            ];
        },
        objective(ctx) {
            return `${ctx.scenario.brief} (par ${ctx.par})`;
        },
        hintFor(ctx) {
            return ctx.scenario.hint;
        },
        input(line, ctx) {
            const outputs = ctx.rt.execute(line);
            if (outputs.some((o) => o.kind === "error")) {
                return { outputs, done: false, success: false };
            }
            const text = outputs.filter((o) => !o.action).map((o) => o.text || "").join("\n");
            const done = canonical(text) === canonical(ctx.scenario.target) && canonical(text) !== "";
            // Reproducing the raw material verbatim (a plain `cat`) is
            // inspection, not a transformation attempt — no score cost.
            const inspecting = !done && canonical(text) === canonical(ctx.scenario.input);
            if (!inspecting) ctx.attempts += 1;
            if (done) ctx.winningLine = line;
            if (!done && !inspecting && canonical(text) !== "") {
                outputs.push({ kind: "dim", text: "…not the target yet. Compare closely, then re-forge the pipeline." });
            }
            return { outputs, done, success: done };
        },
        scoreFor(ctx) {
            let score = Math.max(20, 100 - Math.max(0, ctx.attempts - 1) * 10 - (ctx.hints || 0) * 10);
            const segments = (ctx.winningLine || "").split("|").length;
            if (segments <= ctx.par) score += 10;
            return { score: Math.round(score), detail: `${ctx.attempts} attempt${ctx.attempts === 1 ? "" : "s"}, ${segments}-link pipeline (par ${ctx.par})` };
        },
    };

    const CommandFlash = {
        id: "flash",
        title: "Command Flash",
        icon: "⚡",
        tagline: "Rapid-fire drills: type the command for the task.",
        concepts: ["recall", "all categories"],
        needsWorld: false,
        makeScenario(data, persist, deckId) {
            const decks = data.arcade.flash_decks || [];
            const deck = decks.find((d) => d.id === deckId) || decks[0];
            if (!deck || !Array.isArray(deck.cards) || !deck.cards.length) return null;
            const cards = deck.cards.slice();
            for (let i = cards.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [cards[i], cards[j]] = [cards[j], cards[i]];
            }
            return {
                deck,
                cards: cards.slice(0, 10),
                pos: 0,
                correct: 0,
                streak: 0,
                bestStreak: 0,
                flashScore: 0,
            };
        },
        intro(ctx) {
            return [
                { kind: "magic", text: `Deck: ${ctx.deck.title} — ${ctx.cards.length} cards.` },
                { kind: "dim", text: "Type the command that does the task. skip to pass, hint for help, quit to abandon." },
                ...CommandFlash.card(ctx),
            ];
        },
        card(ctx) {
            const card = ctx.cards[ctx.pos];
            return [{ kind: "info", text: `[${ctx.pos + 1}/${ctx.cards.length}] ${card.q}` }];
        },
        objective(ctx) {
            return `Deck “${ctx.deck.title}” — card ${Math.min(ctx.pos + 1, ctx.cards.length)}/${ctx.cards.length}`;
        },
        hintFor(ctx) {
            const card = ctx.cards[ctx.pos];
            const answer = card.a[0];
            return card.why || `It starts with “${answer.split(" ")[0]}”…`;
        },
        input(line, ctx) {
            const outputs = [];
            const card = ctx.cards[ctx.pos];
            const guess = normalizeAnswer(line);
            if (guess === "skip") {
                outputs.push({ kind: "dim", text: `Skipped. Answer: ${card.a[0]}${card.why ? ` — ${card.why}` : ""}` });
                ctx.streak = 0;
                ctx.pos += 1;
            } else if (card.a.some((ans) => normalizeAnswer(ans) === guess)) {
                ctx.correct += 1;
                ctx.streak += 1;
                ctx.bestStreak = Math.max(ctx.bestStreak, ctx.streak);
                const bonus = Math.min(ctx.streak, 5) * 2;
                ctx.flashScore += 10 + bonus;
                outputs.push({ kind: "success", text: `✓ correct (+${10 + bonus})${ctx.streak > 1 ? `  streak ×${ctx.streak}` : ""}` });
                if (card.why) outputs.push({ kind: "dim", text: card.why });
                ctx.pos += 1;
            } else {
                ctx.streak = 0;
                outputs.push({ kind: "error", text: `✗ not quite — expected: ${card.a[0]}` });
                if (card.why) outputs.push({ kind: "dim", text: card.why });
                ctx.pos += 1;
            }
            const done = ctx.pos >= ctx.cards.length;
            if (!done) outputs.push(...CommandFlash.card(ctx));
            return { outputs, done, success: done && ctx.correct > 0 };
        },
        scoreFor(ctx) {
            let score = ctx.flashScore;
            if (ctx.correct === ctx.cards.length) score += 20;
            return {
                score,
                detail: `${ctx.correct}/${ctx.cards.length} correct, best streak ×${ctx.bestStreak}${ctx.correct === ctx.cards.length ? " — PERFECT +20" : ""}`,
            };
        },
    };

    // ── Vim Catacombs ───────────────────────────────────────────────────
    // The buffer IS the map: `*` gems are taken when the cursor rests on them,
    // `!` spikes cost a heart (three hearts), a `target` is an exact buffer to
    // produce. Each level unlocks keys (its spellbook is every level's keys up
    // to its own) and the engine refuses the rest. Fed one key at a time by
    // the store's keystroke hook, or a whole run through the prompt (`3w`,
    // `A now<esc>`); a `/text` line is a search.
    const GEM = "*";
    const SPIKE = "!";
    const FLOOR = ".";
    const HEARTS = 3;

    const VIM_CHEATS = [
        { keys: ["h", "j", "k", "l"], line: ["h · j · k · l", "left · down · up · right"] },
        { keys: ["w", "b", "e"], line: ["w · b · e", "next word · back a word · word's end"] },
        { keys: ["0", "^", "$"], line: ["0 · ^ · $", "line start · first mark · line end"] },
        { keys: ["count"], line: ["3j · 12l · 2w", "a number repeats the motion"] },
        { keys: ["gg", "G"], line: ["gg · G · 8G", "first line · last line · line 8"] },
        { keys: ["f", "t", "F", "T"], line: ["f* · t! · F* · T!", "onto the next * · just before ! · backward"] },
        { keys: [";", ","], line: ["; · ,", "repeat the find · reverse it"] },
        { keys: ["x", "X"], line: ["x · X · 3x", "delete under · before · three"] },
        { keys: ["dd"], line: ["dd · 2dd", "delete the line · two lines"] },
        { keys: ["d", "D"], line: ["dw · d2w · d$ · D", "delete a word · two · to the line's end"] },
        { keys: ["p", "P", "yy"], line: ["p · P · yy", "paste after/below · before/above · copy the line"] },
        { keys: ["i", "a", "I", "A", "o", "O"], line: ["i · a · I · A · o · O", "insert here · after · line start · line end · below · above"] },
        { keys: ["/", "n", "N"], line: ["/text · n · N", "search · next · previous"] },
    ];
    const VIM_ALWAYS = [["Esc · u", "cancel, leave insert · undo"], [":q · :help", "quit · a hint"]];

    function countGems(lines) {
        return lines.reduce((n, line) => n + (line.split(GEM).length - 1), 0);
    }

    function hearts(ctx) {
        return "♥".repeat(Math.max(0, ctx.hp)) + "♡".repeat(Math.max(0, HEARTS - ctx.hp));
    }

    function sameLines(a, b) {
        return a.length === b.length && a.every((line, i) => line === b[i]);
    }

    // What the cursor landed on, and whether the level is won or lost.
    function settleVim(ctx, outputs, events) {
        const st = ctx.vim;
        if (st.mode === "normal") {
            const line = st.lines[st.row] || "";
            const ch = line[st.col];
            if (ch === GEM) {
                st.lines[st.row] = line.slice(0, st.col) + FLOOR + line.slice(st.col + 1);
                st.undo.length = 0; // a taken gem is a checkpoint: u never gives one back
                ctx.taken += 1;
                events.push({ type: "item", text: "gem", items: ["gem"] });
                outputs.push({ kind: "success", text: `✦ gem ${ctx.taken}/${ctx.total}` });
            } else if (ch === SPIKE) {
                ctx.hp -= 1;
                ctx.traps += 1;
                events.push({ type: "damage", text: "spike", amount: 1 });
                outputs.push({ kind: "error", text: `✗ spikes!  ${hearts(ctx)}` });
                if (ctx.hp <= 0) {
                    outputs.push({ kind: "info", text: "The catacombs claim you." });
                    return { done: true, success: false };
                }
            }
        }
        const destroyed = ctx.total - ctx.taken - countGems(st.lines);
        if (destroyed > 0 && !ctx.warned) outputs.push({ kind: "dim", text: "a gem was destroyed — u brings it back" });
        ctx.warned = destroyed > 0;
        // A target counts only from normal mode: the scribe must leave insert mode, as in vim.
        const done = ctx.taken >= ctx.total && st.mode === "normal" && (!ctx.level.target || sameLines(st.lines, ctx.level.target));
        if (done && ctx.level.target) outputs.push({ kind: "success", text: "The inscription matches the target." });
        return { done, success: done };
    }

    function vimErrorLine(ctx, error) {
        if (error.code === "locked") {
            const keys = ctx.level.keys.length ? ctx.level.keys.join(" ") : "all you have learned";
            return { kind: "error", text: `✗ ${error.message} — this level: ${keys}` };
        }
        if (error.code === "unknown") return { kind: "error", text: `✗ ${error.message}` };
        return { kind: "dim", text: error.message };
    }

    const VimCatacombs = {
        id: "vim",
        title: "Vim Catacombs",
        icon: "⌨",
        tagline: "Walk the catacombs with h j k l — every vim key you learn is a spell.",
        concepts: ["vim", "motions", "operators", "insert mode"],
        needsWorld: false,
        makeScenario(data, persist, levelId) {
            const Vim = global.BashcrawlVim;
            const levels = (data.arcade && data.arcade.vim_levels) || [];
            if (!levels.length || !Vim) return null; // arcade.json missing/empty — start() toasts
            const cleared = (persist.games.vim && persist.games.vim.cleared) || [];
            let index = levels.findIndex((l) => l.id === levelId);
            if (index < 0) index = levels.findIndex((l) => !cleared.includes(l.id));
            if (index < 0) index = levels.length - 1; // everything cleared: the gauntlet again
            const level = levels[index];
            const allowed = [];
            for (const earlier of levels.slice(0, index + 1)) {
                for (const key of earlier.keys || []) if (!allowed.includes(key)) allowed.push(key);
            }
            const [row, col] = level.cursor || [0, 0];
            return {
                scenario: level,
                level,
                index,
                levelCount: levels.length,
                allowed,
                vim: Vim.createState(level.lines, { row, col }),
                total: countGems(level.lines),
                taken: 0,
                hp: HEARTS,
                traps: 0,
                keys: 0,
                par: level.par || 1,
                warned: false,
            };
        },
        intro(ctx) {
            const keys = ctx.level.keys.length ? ctx.level.keys.join("  ") : "everything you have learned";
            return [
                { kind: "magic", text: `Level ${ctx.index + 1}/${ctx.levelCount} — ${ctx.level.title}` },
                { kind: "info", text: ctx.level.brief },
                { kind: "output", text: `New this level:  ${keys}` },
                { kind: "dim", text: "Press the keys — no Enter needed. Esc cancels, :q quits, :help hints (score cost). A run typed at the prompt (3w, A now<esc>) works too." },
            ];
        },
        objective(ctx) {
            const goal = ctx.level.target ? "Make the buffer match the target" : `Take all ${ctx.total} gems`;
            return `${goal} · par ${ctx.par} keystrokes`;
        },
        hintFor(ctx) {
            return ctx.level.hint;
        },
        cheatsFor(ctx) {
            const own = new Set(ctx.level.keys);
            const lines = [];
            for (const group of VIM_CHEATS) {
                if (!group.keys.some((k) => ctx.allowed.includes(k))) continue;
                const isNew = group.keys.some((k) => own.has(k));
                lines.push(isNew ? [group.line[0], `★ ${group.line[1]}`] : group.line);
            }
            return [...lines, ...VIM_ALWAYS];
        },
        keystroke(key, ctx) {
            const Vim = global.BashcrawlVim;
            const outputs = [];
            const events = [];
            // `:` and `/` open the command line at the prompt — unless we are inserting text.
            if (ctx.vim.mode === "normal" && (key === ":" || key === "/")) return { consumed: false, outputs, events, done: false };
            const result = Vim.feed(ctx.vim, key, { allowed: ctx.allowed });
            if (!result.consumed) return { consumed: false, outputs, events, done: false };
            ctx.keys += 1;
            if (result.error) outputs.push(vimErrorLine(ctx, result.error));
            let done = false;
            let success = false;
            if (result.applied) ({ done, success } = settleVim(ctx, outputs, events));
            return { consumed: true, outputs, events, done, success };
        },
        input(line, ctx) {
            const Vim = global.BashcrawlVim;
            const raw = String(line ?? "");
            const outputs = [];
            const events = [];
            if (raw.startsWith("/") && ctx.vim.mode === "normal") {
                const pattern = raw.slice(1);
                ctx.keys += pattern.length + 2; // the slash, the text, Enter
                const found = Vim.search(ctx.vim, pattern);
                if (!found.found) {
                    outputs.push({ kind: "error", text: `E486: Pattern not found: ${pattern}` });
                    return { outputs, events, done: false, success: false };
                }
                if (found.wrapped) outputs.push({ kind: "dim", text: "search hit BOTTOM, continuing at TOP" });
                const { done, success } = settleVim(ctx, outputs, events);
                return { outputs, events, done, success };
            }
            let done = false;
            let success = false;
            for (const key of Vim.toKeys(raw)) {
                const turn = VimCatacombs.keystroke(key, ctx);
                if (!turn.consumed) {
                    outputs.push({ kind: "dim", text: `${Vim.keyLabel(key)} is not a key here — use the prompt for : and / lines` });
                    break;
                }
                outputs.push(...turn.outputs);
                events.push(...turn.events);
                if (turn.done) {
                    done = true;
                    success = Boolean(turn.success);
                    break;
                }
                if (turn.outputs.some((o) => o.kind === "error")) break; // the run stops at a refused key
            }
            return { outputs, events, done, success };
        },
        scoreFor(ctx) {
            const over = Math.max(0, ctx.keys - ctx.par);
            let score = Math.max(20, 100 - over * 3 - (ctx.hints || 0) * 10 - ctx.traps * 15);
            if (ctx.keys <= ctx.par && ctx.taken >= ctx.total) score += 10;
            const seconds = (Date.now() - ctx.startedAt) / 1000;
            return {
                score: Math.round(score),
                detail: `${ctx.keys} keystrokes (par ${ctx.par}), ${ctx.traps} spike${ctx.traps === 1 ? "" : "s"}, ${Math.round(seconds)}s`,
            };
        },
    };

    const GAMES = [PathNavigator, Hunt, PipePuzzle, CommandFlash, VimCatacombs];

    // One-line cheats surfaced next to the active game (concept → [syntax, note]).
    const CHEAT_LINES = {
        cd: ["cd dir  ·  cd ..  ·  cd -", "descend · go up · jump back"],
        ls: ["ls -F", "marks dirs / and executables *"],
        tree: ["tree", "draw the whole layout below you"],
        pwd: ["pwd", "print where you stand"],
        paths: ["a/b/c vs /entrance/a", "relative vs absolute"],
        grep: ["grep -ri PATTERN .", "search all files, any case"],
        find: ["find . -name \"*.key\"", "hunt by NAME (quote the glob!)"],
        flags: ["grep -i · -c · -l · -n", "ignore case · count · names · numbers"],
        "hidden files": ["ls -a", "dotfiles hide from plain ls"],
        pipes: ["cmd1 | cmd2", "output of one feeds the next"],
        sort: ["sort · sort -rn · sort -u", "a→z · high→low numeric · unique"],
        uniq: ["uniq -c", "count adjacent duplicates (sort first!)"],
        cut: ["cut -d, -f2", "take field 2 of ,-separated lines"],
        tr: ["tr a-z A-Z", "translate characters"],
        sed: ["sed 's/old/new/g'", "replace text on every line"],
        recall: ["skip · hint", "pass a card · get a nudge"],
        vim: [":q · :help · Esc", "quit · a hint · cancel"],
        motions: ["h j k l · w b e · 0 ^ $ · gg G · f t", "move the cursor"],
        operators: ["x · dd · dw · D · p", "cut and paste"],
        "insert mode": ["i a I A o O … Esc", "type text, then leave"],
    };

    global.BashcrawlArcade = { GAMES, CHEAT_LINES, BLOCKED_IN_GAME, normalizeAnswer, scopedRuntime };
})(window);
