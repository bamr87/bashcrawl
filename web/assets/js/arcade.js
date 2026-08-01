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
 *
 * The shell router (shell.js) forwards input lines here while the Arcade mode
 * is active; XP earned flows back into the story save via the bridge.
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

    const GAMES = [PathNavigator, Hunt, PipePuzzle, CommandFlash];

    // ── Manager ─────────────────────────────────────────────────────────

    class ArcadeManager {
        constructor() {
            this.data = null;
            this.dom = {};
            this.bridge = { awardXp() {}, toast() {}, setPrompt() {} };
            this.active = null;
            this.ctx = null;
            // The arcade log is its own TerminalView; non-clear control records
            // append like ordinary lines (historic arcade behavior — scoped
            // runtimes never emit fanfare actions anyway).
            this.view = new global.TermForge.view.TerminalView({
                cap: 500,
                onControl: () => true,
            });
            this.persist = global.BashcrawlStorage.loadKey(SCORES_KEY, { games: {} });
            if (!this.persist.games) this.persist.games = {};
        }

        init(data, dom, bridge) {
            this.data = data;
            this.dom = dom;
            this.bridge = { ...this.bridge, ...bridge };
            if (dom.log) this.view.sink = new global.TermForge.sinks.DomSink(dom.log);
            this.renderHome();
        }

        gameRecord(id) {
            if (!this.persist.games[id]) this.persist.games[id] = { best: 0, plays: 0, seen: [] };
            return this.persist.games[id];
        }

        // ── home / picker ────────────────────────────────────────────────
        renderHome() {
            this.active = null;
            this.ctx = null;
            this.bridge.setPrompt("arcade ▸");
            if (this.dom.log) this.dom.log.hidden = true;
            if (!this.dom.home) return;
            this.dom.home.hidden = false;
            const decks = (this.data.arcade.flash_decks || []).slice(0, 12);
            const cards = GAMES.map((game) => {
                const rec = this.persist.games[game.id] || { best: 0, plays: 0 };
                return `<article class="arcade-card" data-game="${game.id}" tabindex="0" role="button" aria-label="Play ${escapeHtml(game.title)}">
                    <div class="arcade-card-icon">${game.icon}</div>
                    <h3>${escapeHtml(game.title)}</h3>
                    <p>${escapeHtml(game.tagline)}</p>
                    <p class="arcade-card-concepts">${game.concepts.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join("")}</p>
                    <p class="kind-dim arcade-card-stats">${rec.plays ? `best ${rec.best} · ${rec.plays} run${rec.plays === 1 ? "" : "s"}` : "not yet attempted"}</p>
                </article>`;
            }).join("");
            const deckChips = decks.map((d) => `<button type="button" class="chip chip-action" data-deck="${escapeHtml(d.id)}">${escapeHtml(d.title)} (${d.cards.length})</button>`).join(" ");
            this.dom.home.innerHTML = `
                <div class="arcade-intro">
                    <h2>Practice Arcade</h2>
                    <p class="kind-dim">Four trials, one real bash kernel. Scores feed your story XP.</p>
                </div>
                <div class="arcade-grid">${cards}</div>
                <div class="arcade-decks">
                    <p class="kind-dim">Command Flash decks:</p>
                    ${deckChips}
                </div>`;
            this.dom.home.querySelectorAll(".arcade-card").forEach((el) => {
                const start = () => this.start(el.dataset.game);
                el.addEventListener("click", start);
                el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } });
            });
            this.dom.home.querySelectorAll("[data-deck]").forEach((el) => {
                el.addEventListener("click", () => this.start("flash", el.dataset.deck));
            });
            this.renderSide();
        }

        start(gameId, deckId) {
            const game = GAMES.find((g) => g.id === gameId);
            if (!game) return;
            const scenario = game.makeScenario(this.data, this.persist, deckId);
            // Content bundle missing or malformed (e.g. arcade.json failed to
            // fetch): stay on the home screen instead of crashing mid-boot.
            if (!scenario || (game.needsWorld && !scenario.world)) {
                this.bridge.toast("That trial's content failed to load — try another.");
                return;
            }
            this.active = game;
            this.ctx = {
                ...scenario,
                rt: game.needsWorld ? scopedRuntime(scenario.world) : null,
                moves: 0,
                hints: 0,
                startedAt: Date.now(),
            };
            this.view.clear();
            if (this.dom.home) this.dom.home.hidden = true;
            if (this.dom.log) this.dom.log.hidden = false;
            this.appendMany(game.intro(this.ctx));
            this.bridge.setPrompt(this.promptLabel());
            this.renderSide();
            this.renderLog();
        }

        promptLabel() {
            if (!this.active) return "arcade ▸";
            if (this.active.needsWorld && this.ctx.rt) return `${this.ctx.rt.state.cwd} ⚔`;
            return `${this.active.id} ⚔`;
        }

        // Tab completion against the active trial's scoped runtime (shell hook).
        completions(text) {
            return this.active && this.ctx && this.ctx.rt ? this.ctx.rt.completions(text) : [];
        }

        // Append an informational line to the arcade log and repaint it
        // (used by shell.js to echo multi-candidate completion lists).
        echoInfo(text) {
            this.append("info", text);
            this.renderLog();
        }

        // Ctrl+L while the arcade owns the input clears the arcade log.
        clearLog() {
            this.view.clear();
            this.renderLog();
        }

        // ── input routing (called from shell.js) ─────────────────────────
        input(line) {
            // A finished trial waits for one Enter, then returns to the floor.
            if (this.awaitReturn) {
                this.awaitReturn = false;
                this.renderHome();
                return true;
            }
            if (!this.active) {
                // Home screen: allow starting by name for keyboard players.
                const id = normalizeAnswer(line).toLowerCase();
                const game = GAMES.find((g) => g.id === id || g.title.toLowerCase() === id);
                if (game) { this.start(game.id); return true; }
                this.bridge.toast("Pick a trial: click a card, or type its name (pathnav, hunt, pipes, flash).");
                return true;
            }
            const trimmed = normalizeAnswer(line).toLowerCase();
            if (!trimmed) return true; // stray Enter mid-trial: not a move
            if (trimmed === "quit" || trimmed === "exit") {
                this.append("dim", "You withdraw from the trial. The arcade remembers nothing.");
                this.renderLog();
                this.bridge.toast("Trial abandoned.");
                this.renderHome();
                return true;
            }
            if (trimmed === "hint") {
                this.ctx.hints = (this.ctx.hints || 0) + 1;
                this.append("magic", `☆ ${this.active.hintFor(this.ctx)}`);
                this.renderLog();
                this.renderSide();
                return true;
            }
            if (this.active.needsWorld && BLOCKED_IN_GAME.has(trimmed.split(" ")[0])) {
                this.append("dim", "That belongs to the story dungeon — finish this trial first (or quit).");
                this.renderLog();
                return true;
            }
            this.append("dim", `${this.promptLabel()} ${line}`);
            this.ctx.moves += 1;
            const result = this.active.input(line, this.ctx);
            this.appendMany(result.outputs || []);
            if (result.done) {
                this.finish(result.success);
            } else {
                this.bridge.setPrompt(this.promptLabel());
                this.renderSide();
            }
            this.renderLog();
            return true;
        }

        finish(success) {
            const { score, detail } = this.active.scoreFor(this.ctx);
            const rec = this.gameRecord(this.active.id);
            rec.plays += 1;
            rec.last = score;
            const isBest = score > (rec.best || 0);
            if (isBest) rec.best = score;
            if (this.ctx.scenario && this.ctx.scenario.id && Array.isArray(rec.seen) && !rec.seen.includes(this.ctx.scenario.id)) {
                rec.seen.push(this.ctx.scenario.id);
                if (rec.seen.length > 64) rec.seen.splice(0, rec.seen.length - 64);
            }
            global.BashcrawlStorage.saveKey(SCORES_KEY, this.persist);
            const xp = Math.max(5, Math.round(score / 5));
            if (success) {
                this.appendMany([
                    { kind: "art", text: "  ✦ ✧ ✦  T R I A L   C L E A R  ✦ ✧ ✦" },
                    { kind: "success", text: `Score ${score}${isBest ? "  — NEW BEST!" : ""}  (${detail})` },
                    { kind: "magic", text: `+${xp} XP flows back to your story hero.` },
                    { kind: "dim", text: "Enter returns to the arcade floor." },
                ]);
                this.bridge.awardXp(xp, this.active.title);
            } else {
                this.appendMany([
                    { kind: "info", text: `Trial ended. Score ${score} (${detail}).` },
                    { kind: "dim", text: "Enter returns to the arcade floor." },
                ]);
            }
            this.active = { ...this.active, finished: true, input: () => ({ outputs: [], done: false }) };
            this.awaitReturn = true;
            this.renderSide();
        }

        // ── rendering (delegated to the shared TerminalView) ─────────────
        append(kind, text) {
            this.view.appendLine(kind, text);
        }

        appendMany(outputs) {
            this.view.appendOutputs(outputs);
        }

        renderLog() {
            if (!this.dom.log) return;
            this.view.flush();
        }

        renderSide() {
            if (this.dom.objective) {
                this.dom.objective.innerHTML = this.active && !this.active.finished
                    ? `<p><strong>${escapeHtml(this.active.title)}</strong></p><p>${escapeHtml(this.active.objective(this.ctx))}</p>`
                    : `<p><strong>Choose a trial</strong></p><p class="kind-dim">Click a card — or type its name and press Enter.</p>`;
            }
            if (this.dom.stats) {
                if (this.active && this.ctx) {
                    const seconds = Math.round((Date.now() - this.ctx.startedAt) / 1000);
                    this.dom.stats.innerHTML = `<p>Commands: ${this.ctx.moves}</p><p>Hints: ${this.ctx.hints || 0}</p><p>Elapsed: ${seconds}s</p>`;
                } else {
                    this.dom.stats.innerHTML = `<p class="kind-dim">Stats appear during a trial.</p>`;
                }
            }
            if (this.dom.best) {
                const rows = GAMES.map((g) => {
                    const rec = this.persist.games[g.id];
                    return `<li>${g.icon} ${escapeHtml(g.title)} — ${rec && rec.plays ? `best <strong>${rec.best}</strong> (${rec.plays})` : "—"}</li>`;
                }).join("");
                this.dom.best.innerHTML = `<ul class="arcade-best-list">${rows}</ul>`;
            }
            if (this.dom.cheats) {
                const concepts = this.active && !this.active.finished ? this.active.concepts : ["pipes", "grep", "find", "paths"];
                const tips = concepts.map((c) => CHEAT_LINES[c]).filter(Boolean);
                this.dom.cheats.innerHTML = tips.length
                    ? tips.map((t) => `<p class="cheat-line"><code>${escapeHtml(t[0])}</code><span class="kind-dim"> ${escapeHtml(t[1])}</span></p>`).join("")
                    : `<p class="kind-dim">Concept cheats appear during a trial.</p>`;
            }
        }
    }

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
    };

    global.BashcrawlArcade = { ArcadeManager, GAMES };
})(window);
