(function initRuntime(global) {
    // From the TermForge framework core (vendored under
    // web/assets/js/vendor/termforge/ and loaded before this file — edit
    // termforge/core/, never the vendor copies).
    const { tokenize } = global.TermForge.parser;

    // ── Game features as TermForge plugins ───────────────────────────────
    // Each mini-game / progression feature is one plugin file under
    // web/assets/js/plugins/ (docs/schemas/plugin.v1.md), loaded before this
    // file. Install order matters only for shared hooks: postExecute runs
    // achievements (award XP) -> daily (reads XP) -> progress (rank-up reads
    // the final XP).
    const GAME_PLUGINS = Object.freeze(["achievements", "daily", "progress", "arena", "pathfind", "bestiary"]);
    function gamePlugin(id) {
        const mod = (global.BashcrawlPlugins || {})[id];
        if (!mod || !mod.plugin) throw new Error(`game plugin ${id} is not loaded (web/assets/js/plugins/${id}.js)`);
        return mod;
    }

    // ── Progression catalogs (data, not code) ────────────────────────────
    // Ranks, achievements (as TermForge rules), the bestiary and the arena's
    // trials come from src/help/data/progression.yaml via
    // web/data/progression.json. A runtime built without them (the Practice
    // Arcade's scoped sandboxes) gets empty catalogs.
    function progressionFrom(raw) {
        const p = raw && typeof raw === "object" ? raw : {};
        const list = (value) => (Array.isArray(value) ? value : []);
        const ranks = list(p.ranks).length ? list(p.ranks) : [{ min: 0, title: "" }];
        return {
            ranks,
            achievements: list(p.achievements),
            bestiary: list(p.bestiary),
            trials: list(p.trials),
        };
    }

    function defaultState(root) {
        return {
            cwd: root || "/entrance",
            prevCwd: null,
            hp: 100,
            xp: 0,
            inventory: [],
            aliases: {},
            envVars: {},
            userNodes: {},
            completedQuestIds: [],
            currentQuestId: 0,
            visited: [],
            history: [],
            historyIndex: -1,
            flags: {},
            reveals: {},
            trainer: null,
            pathfind: null,
            speedrunBest: null,
            achievements: [],
            bestiary: [],
            daily: { date: null, baselineXp: 0, goal: 0, completed: false, streak: 0, lastDate: null },
            rankIndex: 0,
            stats: { commands: {}, catScrollCount: 0, lastPipedIn: false, initialized: false },
        };
    }

    // The game's voice, layered over the framework's neutral copy deck: the
    // exact historical Bashcrawl Web strings and fortune deck. Pictures are
    // ASCII Motion clips (motion/art/), passed as the Shell's `art` option.
    // Content lives here with the app; termforge/core stays brand-neutral
    // (enforced by termforge/test/content-separation.test.js).
    const GAME_UI_TEXT = {
        manBuiltinNote: (cmd) => `Built-in for Bashcrawl Web. Try '${cmd} --help' or open Docs (F1).`,
        chmodSessionOnly: "Web Bashcrawl chmod only changes session-created files.",
        chmodDecorative: (mode, target) => `chmod ${mode} ${target}: numeric modes are decorative in the web port.`,
        mvSessionOnly: "Web Bashcrawl only moves files you created in this session.",
        rmWorldFile: (name) => `rm: cannot remove '${name}': the dungeon's own files are indestructible`,
        rmSessionOnly: "Only session-created files can be removed in Web Bashcrawl.",
        execFileKind: "encounter",
        figletDefault: "BASHCRAWL",
        fortunes: [
            "In the catacombs, you have ZERO bytes of fear.",
            "chmod 777 your dreams. Permissions matter.",
            "/dev/null is full. Please try again.",
            "An unhandled exception walks into a bar. The bar pretends nothing happened.",
            "Cellar mages prefer ls -F over divination.",
            "Warning: pipes are not for plumbers in this realm.",
            "When in doubt, cd .. and try again.",
            "If you can name it, you can grep it.",
            "The shell is patient. The shell is kind. The shell still won't run that typo.",
            "May your prompts be short and your scripts be sourced.",
        ],
    };

    // Save tokens have their own bounded budget; normal commands stay small.
    function lineLimit(line) { return /^\s*save\s+import(?:\s|$)/.test(line) ? 1048576 : 4096; }
    function commandLabel(line) { return /^\s*save\s+import\s/.test(line) ? "save import [token]" : line; }

    function loadState(world, parsed, progression) {
        const trialCount = progression === undefined ? Infinity : progressionFrom(progression).trials.length;
        const base = defaultState(world.root);
        if (parsed == null) return base;
        global.TermForge.state.validateSavedState(base, parsed);
        const next = global.TermForge.state.mergeSavedState(base, parsed);
        for (const key of ["inventory", "history", "visited", "achievements", "bestiary"]) {
            if (next[key].some((item) => typeof item !== "string")) throw new Error(`invalid ${key}`);
        }
        if (next.completedQuestIds.some((id) => !Number.isInteger(id) || id < 0)) throw new Error("invalid completedQuestIds");
        for (const key of ["aliases", "envVars", "reveals"]) {
            if (Object.values(next[key]).some((item) => typeof item !== "string")) throw new Error(`invalid ${key}`);
        }
        for (const node of Object.values(next.userNodes)) {
            if (!node || !["dir", "file", "exec", "deleted"].includes(node.type) ||
                (node.content != null && typeof node.content !== "string")) throw new Error("invalid userNodes");
        }
        for (const key of ["trainer", "pathfind"]) {
            if (next[key] != null && (typeof next[key] !== "object" || Array.isArray(next[key]))) throw new Error(`invalid ${key}`);
        }
        if (next.speedrunBest != null && (!Number.isFinite(next.speedrunBest) || next.speedrunBest < 0)) throw new Error("invalid speedrunBest");
        if (Object.values(next.stats.commands).some((count) => !Number.isFinite(count) || count < 0)) throw new Error("invalid stats.commands");
        if (next.trainer != null) {
            const t = next.trainer;
            global.TermForge.state.validateSavedState({ queue: [], pos: 0, score: 0, streak: 0, best: 0, tries: 0, active: false, speed: false, startedAt: 0 }, t, "trainer");
            if (t.active && (!Array.isArray(t.queue) || !t.queue.length ||
                t.queue.some((id) => !Number.isInteger(id) || id < 0 || id >= trialCount) ||
                !Number.isInteger(t.pos) || t.pos < 0 || t.pos >= t.queue.length ||
                [t.score, t.streak, t.best, t.tries, t.startedAt].some((n) => !Number.isFinite(n) || n < 0))) throw new Error("invalid trainer");
        }
        if (next.pathfind != null) {
            const pf = next.pathfind;
            global.TermForge.state.validateSavedState({ active: false, target: "", targetTitle: "", moves: 0 }, pf, "pathfind");
            if (pf.active && (typeof pf.target !== "string" || typeof pf.targetTitle !== "string" ||
                !Number.isInteger(pf.moves) || pf.moves < 0)) throw new Error("invalid pathfind");
        }
        if (next.prevCwd != null && typeof next.prevCwd !== "string") throw new Error("invalid prevCwd");
        for (const key of ["date", "lastDate"]) {
            if (next.daily[key] != null && typeof next.daily[key] !== "string") throw new Error(`invalid daily.${key}`);
        }
        const vfs = global.TermForge.vfs.createVfs(world, { getState: () => next });
        if (!vfs.node(next.cwd) || vfs.node(next.cwd).type !== "dir") throw new Error("saved location is unavailable");
        if (next.hp < 0 || next.hp > 100 || next.xp < 0 || next.currentQuestId < 0 || next.rankIndex < 0) throw new Error("invalid progress");
        if (next.history.length > 1000) next.history = next.history.slice(-1000);
        next.historyIndex = next.history.length;
        return next;
    }

    class Runtime extends global.TermForge.Shell {
        constructor(data, state, options) {
            super({
                world: data.world,
                commands: data.commands,
                state: state || defaultState(data.world.root),
                uiText: GAME_UI_TEXT,
                art: global.BashcrawlArtClips || {},
                bare: Boolean(options && options.bare),
            });
            this.capabilities = (options && options.capabilities) || {};
            this.persistence = (options && options.persistence) || null;
            this.quests = data.quests.quests || [];
            this.catalog = progressionFrom(data.progression);
            // A save whose arena run points past the loaded trials cannot resume.
            const t = this.state.trainer;
            if (t && t.active && (t.queue || []).some((id) => id >= this.catalog.trials.length)) this.state.trainer = null;
            // The game's full command surface, enumerated in one static
            // literal: P.*/F.* are TermForge pack functions, this.cmd* are
            // story commands on this class, and Arena.*/Daily.*/… are the game
            // plugins' commands (web/assets/js/plugins/). The literal is the
            // command manifest: scripts/validate_runtime_commands.py regex-reads
            // it — keep one `key: ref,` per line, bare references only, and
            // exactly one `this.handlers = {` in the file.
            const P = global.TermForge.packs.posix.commands;
            const F = global.TermForge.packs.flavour.commands;
            const Arena = gamePlugin("arena");
            const Pathfind = gamePlugin("pathfind");
            const Daily = gamePlugin("daily");
            const Achievements = gamePlugin("achievements");
            const Progress = gamePlugin("progress");
            const Bestiary = gamePlugin("bestiary");
            this.handlers = {
                help: this.cmdHelp,
                pwd: P.pwd,
                ls: P.ls,
                cd: P.cd,
                cat: P.cat,
                less: this.cmdLess,
                head: P.head,
                tail: P.tail,
                wc: P.wc,
                grep: P.grep,
                echo: P.echo,
                export: P.export,
                let: P.let,
                alias: P.alias,
                source: this.cmdSource,
                mkdir: P.mkdir,
                touch: P.touch,
                cp: P.cp,
                mv: P.mv,
                rm: P.rm,
                history: P.history,
                clear: P.clear,
                quest: this.cmdQuest,
                inventory: this.cmdInventory,
                health: this.cmdHealth,
                status: this.cmdStatus,
                save: this.cmdSave,
                reset: this.cmdReset,
                sort: P.sort,
                uniq: P.uniq,
                cut: P.cut,
                tr: P.tr,
                sed: P.sed,
                nl: P.nl,
                rev: P.rev,
                find: P.find,
                tree: P.tree,
                file: P.file,
                chmod: this.cmdChmod,
                man: P.man,
                whoami: this.cmdWhoami,
                date: P.date,
                env: this.cmdEnv,
                map: this.cmdMap,
                look: this.cmdLook,
                hint: this.cmdHint,
                xp: Progress.xp,
                fortune: F.fortune,
                cowsay: F.cowsay,
                figlet: F.figlet,
                banner: F.banner,
                sl: F.sl,
                train: Arena.train,
                drill: Arena.train,
                practice: Arena.train,
                arena: Arena.train,
                speedrun: Arena.speedrun,
                speed: Arena.speedrun,
                pathfind: Pathfind.pathfind,
                seek: Pathfind.pathfind,
                journey: Pathfind.pathfind,
                achievements: Achievements.achievements,
                badges: Achievements.achievements,
                profile: Progress.profile,
                stats: Progress.profile,
                sheet: Progress.profile,
                bestiary: Bestiary.bestiary,
                codex: Bestiary.bestiary,
                daily: Daily.daily,
                challenge: Daily.daily,
                commands: this.cmdCommands,
                cmds: this.cmdCommands,
                menu: this.cmdCommands,
                features: this.cmdCommands,
            };
            this.installGameHooks();
            for (const id of GAME_PLUGINS) this.use(gamePlugin(id).plugin);
        }

        // Wire the story core onto the TermForge hook spine (the game
        // plugins bring their own subscribers). Every subscriber body is the
        // exact logic the pre-framework emulator ran inline in its
        // execute/runPipeline/executeSegment methods.
        installGameHooks() {
            this.hooks.on("beforeCommand", (cmd, args, stdin) => {
                this.bump(cmd);
                this.state.stats.lastPipedIn = stdin != null;
            });
            // `./script` resolves against the world's encounter table, which is
            // keyed by stored (dotted) paths — translate revealed rooms first.
            this.hooks.on("execDispatch", (name) => {
                const path = this.actual(`${this.state.cwd}/${name}`.replace(/\/+/g, "/"));
                return this.world.encounters[path] ? this.runScript(name) : null;
            });
            this.hooks.on("postCommand", (cmd, args, stdin, outputs) => {
                this.advanceQuests(cmd, args, stdin);
                // Scholar counter: reading a scroll with cat/less. (Lived inside
                // the generic cat handler pre-framework; alias-expanded lines
                // arrive here under their expanded command name, same as then.)
                if ((cmd === "cat" || cmd === "less") && args[0]
                    && !outputs.some((o) => o.kind === "error")
                    && this.basename(this.resolve(args[0])) === "scroll") {
                    this.state.stats.catScrollCount += 1;
                }
            });
        }

        // chmod with the quest flag the story tracks; mechanics live in the
        // posix pack.
        cmdChmod(args, stdin) {
            const out = global.TermForge.packs.posix.commands.chmod.call(this, args, stdin);
            if (args[0] === "+x" && out.some((o) => o.kind === "success")) {
                this.state.flags.chmod_x = true;
            }
            return out;
        }

        bump(cmd) {
            this.state.stats.commands[cmd] = (this.state.stats.commands[cmd] || 0) + 1;
        }

        // ── Progression helpers shared by the story core and the plugins ──

        /** Award XP and announce it on the event bus. */
        awardXp(amount, reason) {
            const n = Number(amount) || 0;
            if (!n) return;
            this.state.xp += n;
            this.emit("progress.xp", { amount: n, total: this.state.xp, reason });
        }

        /** The rank row (from progression.yaml) a given XP total has reached. */
        rankFor(xp) {
            const ranks = this.catalog.ranks;
            return ranks.filter((r) => (xp || 0) >= r.min).pop() || ranks[0];
        }

        /** Re-show the active arena trial (hosts call this when resuming a save). */
        trainerChallenge() {
            return gamePlugin("arena").challenge.call(this);
        }

        // ── Filesystem: thin delegates onto the TermForge VFS ────────────────
        // (semantics live in termforge/core/vfs.js; these keep the public
        // surface game.js/docs.js/reference.js already consume)

        // Reveal a hidden room by logical name (e.g. "chapel"), mapping the visible
        // path to its stored dotted path. Returns a message if newly unlocked.
        revealRoom(name) {
            const found = this.vfs.findHiddenDir(name);
            if (!found || this.state.reveals[found.visiblePath]) return null;
            this.state.reveals[found.visiblePath] = found.realPath;
            this.emit("node.revealed", { name, path: found.visiblePath });
            return { kind: "success", text: `🔓 A new passage opens: ${name}/` };
        }

        cmdHelp() {
            return [
                { kind: "info", text: "Open the Docs panel with F1 (or click Docs)." },
                { kind: "dim", text: "Try:  pwd | ls -F | cat scroll | cd cellar | tree | map | hint | cowsay hi | ./treasure" },
                { kind: "magic", text: "Mini-games:  'train' drills spells (or 'speedrun' against the clock);  'pathfind' quests to a target room. All grant XP." },
                { kind: "dim", text: "Type 'achievements' for badges, 'profile' for your sheet, 'bestiary' to catalogue encounters, or 'daily' for today's challenge." },
                { kind: "info", text: "New here? Type 'commands' for the full command deck of web-exclusive features." },
            ];
        }

        // ── Command reference ────────────────────────────────────────────────
        // Discoverability hub for the web-only features. These commands have no
        // bash equivalent and are otherwise invisible, so surface them grouped
        // by purpose with a one-line "what it does" and live progress counts.
        cmdCommands() {
            const s = this.state;
            const badges = (s.achievements || []).length;
            const seen = (s.bestiary || []).length;
            const rank = this.rankFor(s.xp).title;
            const groups = [
                {
                    title: "🎮 Mini-games (earn XP)",
                    items: [
                        ["train", "Drill spells from memory in the Training Arena"],
                        ["speedrun", "Same trials, against the clock — beat your best time"],
                        ["pathfind", "Navigate to a target room in the fewest cd moves"],
                    ],
                },
                {
                    title: "📊 Progress & collection",
                    items: [
                        ["profile", `Your character sheet — ${rank}, XP, stats`],
                        ["achievements", `Badge catalogue — ${badges}/${this.catalog.achievements.length} unlocked`],
                        ["bestiary", `Creature codex — ${seen}/${this.catalog.bestiary.length} catalogued`],
                        ["daily", "Today's challenge and your streak"],
                    ],
                },
                {
                    title: "🧭 Navigation & lore",
                    items: [
                        ["map", "ASCII map of the dungeon"],
                        ["look", "Describe the current room and its contents"],
                        ["hint", "A nudge toward the next objective"],
                        ["quest", "Your active quest objectives"],
                    ],
                },
                {
                    title: "✨ Flavour",
                    items: [
                        ["cowsay <text>", "An ASCII cow speaks"],
                        ["fortune", "A random adage"],
                        ["banner <text>", "Big block letters"],
                        ["sl", "Watch a train roll by"],
                    ],
                },
            ];
            const lines = [
                { kind: "banner", text: "BASHCRAWL — COMMAND DECK" },
                { kind: "dim", text: "Web-exclusive commands beyond the core POSIX toolkit. Type any name to run it." },
            ];
            for (const g of groups) {
                lines.push({ kind: "magic", text: g.title });
                for (const [name, desc] of g.items) {
                    const pad = name.padEnd(16, " ");
                    lines.push({ kind: "output", text: `  ${pad}${desc}` });
                }
            }
            lines.push({ kind: "dim", text: "Core commands (ls, cd, cat, grep, find, tree...) work too — see Docs (F1)." });
            return lines;
        }

        // Prompt shown in the input row; the Arena swaps in a battle prompt.
        promptLabel() {
            const t = this.state.trainer;
            if (t && t.active) {
                return `${t.speed ? "speed" : "arena"} ${Math.min(t.pos + 1, t.queue.length)}/${t.queue.length} ❯`;
            }
            const pf = this.state.pathfind;
            if (pf && pf.active) {
                return `seek ${pf.targetTitle} [${pf.moves}] ❯`;
            }
            return `${this.state.cwd} $`;
        }

        cmdWhoami() {
            return [{ kind: "info", text: "adventurer  (you have walked these halls before...)" }];
        }

        cmdEnv() {
            const lines = [
                `I=${this.state.inventory.join(",")}`,
                `HP=${this.state.hp}`,
                `XP=${this.state.xp}`,
                `CWD=${this.state.cwd}`,
                ...Object.entries(this.state.envVars).map(([k, v]) => `${k}=${v}`),
            ];
            return [{ kind: "output", text: lines.join("\n") }];
        }

        // Draw the dungeon map by walking the live runtime filesystem, so the map
        // never advertises a room you cannot actually `cd` into. Only directories
        // (rooms) are shown; revealed hidden rooms appear un-dotted via entries().
        cmdMap() {
            const here = this.state.cwd;
            const root = this.world.root || "/entrance";
            const marker = (path) => (path === here ? "  ← you are here" : "");
            const lines = [root + marker(root)];
            const walk = (path, prefix, depth) => {
                if (depth > 4) return;
                const rooms = this.entries(path, false).filter((entry) => entry.type === "dir");
                rooms.forEach((entry, idx) => {
                    const last = idx === rooms.length - 1;
                    const tee = last ? "└── " : "├── ";
                    const childPath = `${path === "/" ? "" : path}/${entry.name}`;
                    lines.push(prefix + tee + entry.name + "/" + marker(childPath));
                    walk(childPath, prefix + (last ? "    " : "│   "), depth + 1);
                });
            };
            walk(root, "  ", 0);
            const out = [{ kind: "art", text: lines.join("\n") }];
            // Teach that the dungeon hides more than it shows, until it doesn't.
            if (this.entries(root, true).some((entry) => entry.type === "dir" && entry.hidden)) {
                out.push({ kind: "dim", text: "Some passages stay hidden until unlocked — try `ls -la` and read the scrolls." });
            }
            return out;
        }

        cmdLook() {
            const meta = this.currentRoomMeta();
            const out = [];
            if (meta.title) out.push(`${meta.emoji || "•"} ${meta.title}`);
            if (meta.hint) out.push(meta.hint);
            const entries = this.entries(this.state.cwd, false).map((entry) => {
                const marker = entry.type === "dir" ? "/" : entry.type === "exec" ? "*" : "";
                return `  ${entry.name}${marker}`;
            });
            return [{ kind: "info", text: out.join("\n") }, { kind: "output", text: entries.join("\n") || "(empty)" }];
        }

        // Items a quest's completion.item_check still needs (in order), so the
        // player is told what is missing instead of silently stalling (#103).
        missingQuestItems(q) {
            const comp = (q && q.completion) || {};
            if (!comp.item_check) return [];
            return String(comp.item_check).split(",").map((v) => v.trim()).filter(Boolean)
                .filter((item) => !this.state.inventory.includes(item));
        }

        missingItemsLine(q) {
            const missing = this.missingQuestItems(q);
            return missing.length ? `You still need: ${missing.join(", ")}` : "";
        }

        cmdHint() {
            const q = this.quests[this.state.currentQuestId];
            if (!q) return [{ kind: "success", text: "No quests left. Try `map`, `tree`, `cowsay hi`, or the `train` / `speedrun` / `pathfind` mini-games." }];
            const missing = this.missingItemsLine(q);
            return [{ kind: "magic", text: `🔮 ${q.title}\n   ${q.hint || q.objective}${missing ? `\n   ${missing}` : ""}` }];
        }

        cmdSource(args) {
            if (!args[0]) return [{ kind: "error", text: "Usage: source <file>" }];
            const raw = args[0].replace(/^\.\//, "");
            const path = this.resolve(raw);
            const base = this.basename(path);
            const inStudy = this.state.cwd.includes("study");
            if (inStudy && base === "grimoire") {
                if (this.readFile(path) === null) return [{ kind: "error", text: `No such file: ${raw}` }];
                if (!this.state.inventory.includes("grimoire")) this.state.inventory.push("grimoire");
                this.state.aliases.bc = "echo 42";
                // Only promise the quest when its item check will pass; quest
                // advancement itself runs in postCommand (#103).
                const q = this.quests[this.state.currentQuestId];
                const pending = q && (q.completion || {}).command === "source";
                const missing = pending ? this.missingQuestItems(q) : [];
                const out = [
                    { kind: "magic", text: "📕 The grimoire's knowledge merges with your shell." },
                    { kind: "success", text: pending && !missing.length ? "Defined `bc` as a quick demo (output: 42). Scriptorium quest ready." : "Defined `bc` as a quick demo (output: 42)." },
                ];
                if (missing.length) {
                    out.push({ kind: "error", text: `The Scriptorium stays sealed. You still need: ${missing.join(", ")}. Type \`hint\` for where to look, then \`source grimoire\` again.` });
                }
                return out;
            }
            if (this.readFile(path) !== null) {
                return [{ kind: "info", text: `Sourced ${raw} (no extra definitions in the web port).` }];
            }
            return [{ kind: "error", text: `Cannot source: ${raw}` }];
        }

        cmdQuest() {
            const q = this.quests[this.state.currentQuestId];
            const missing = this.missingItemsLine(q);
            return [{ kind: "info", text: q ? `${q.title}\n${q.objective}\nHint: ${q.hint || "Explore and read scrolls."}${missing ? `\n${missing}` : ""}` : "All quests complete." }];
        }

        cmdInventory() {
            return [{ kind: "output", text: this.state.inventory.join(", ") || "(empty)" }];
        }

        cmdHealth() {
            return [{ kind: "output", text: `HP=${this.state.hp}` }];
        }

        cmdStatus() {
            return [{ kind: "info", text: `Location: ${this.state.cwd}\nHP: ${this.state.hp}\nXP: ${this.state.xp}\nInventory: ${this.state.inventory.join(", ") || "(empty)"}` }];
        }

        cmdLess(args, stdin) {
            const outputs = global.TermForge.packs.posix.commands.cat.call(this, args, stdin);
            if (!this.capabilities.pager || this.inPipeline || stdin != null || outputs.some((out) => out.kind === "error")) return outputs;
            return [{ kind: "control", action: "page", text: outputs.map((out) => out.text || "").join("\n") }];
        }

        cmdSave(args) {
            if (args[0] === "export") return [{ kind: "output", text: this.encodeBase64(JSON.stringify(this.state)) }];
            if (args[0] === "import") {
                if (!args[1]) return [{ kind: "info", text: "Use save import BASE64 with a token from save export." }];
                try {
                    const binary = global.atob(args[1]);
                    const text = decodeURIComponent(Array.from(binary, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
                    const parsed = JSON.parse(text);
                    this.state = loadState(this.world, parsed, this.catalog);
                    return [{ kind: "success", text: "Progress imported." }];
                } catch (err) { return [{ kind: "error", text: `Cannot import save: ${err.message}` }]; }
            }
            if (this.persistence) {
                try {
                    if (this.persistence.save(this.state) === false) throw new Error("storage unavailable");
                    return [{ kind: "success", text: this.persistence.description || "Progress saved." }];
                } catch (err) { return [{ kind: "error", text: `Could not save progress: ${err.message}` }]; }
            }
            return [{ kind: "info", text: "This session is temporary. Use save export to keep your progress, then save import TOKEN to restore it." }];
        }

        cmdReset() {
            this.state = defaultState(this.world.root);
            this.emit("session.reset", {});
            return [{ kind: "control", action: "reset" }, { kind: "info", text: "Session reset. Start with pwd." }];
        }

        // The {kind:'art'} portrait for a script basename, or null.
        encounterArtLine(script) {
            const text = this.art(`encounter-${script}`);
            return text ? { kind: "art", text } : null;
        }

        runScript(script) {
            const path = this.actual(`${this.state.cwd}/${script}`.replace(/\/+/g, "/"));
            const encounter = this.world.encounters[path];
            if (!encounter) return [{ kind: "error", text: `No runnable script: ./${script}` }];
            const messages = [{ kind: "magic", text: `${encounter.icon || "⚡"} ${encounter.description || script}` }];
            const portrait = this.encounterArtLine(script);
            if (portrait) {
                messages.unshift(portrait);
                if (!Array.isArray(this.state.bestiary)) this.state.bestiary = [];
                if (!this.state.bestiary.includes(script)) this.state.bestiary.push(script);
            }
            this.emit("encounter.run", { key: encounter.key, script, path });
            for (const item of encounter.grants_items || []) {
                if (!this.state.inventory.includes(item)) {
                    this.state.inventory.push(item);
                    this.emit("item.gained", { item });
                }
            }
            const hpBefore = this.state.hp;
            if (encounter.damage) this.state.hp = Math.max(0, this.state.hp - Number(encounter.damage));
            if (encounter.heals) this.state.hp = Math.min(100, this.state.hp + Number(encounter.heals));
            if (this.state.hp !== hpBefore) this.emit("health.changed", { delta: this.state.hp - hpBefore, hp: this.state.hp });
            this.state.flags[encounter.key] = true;
            if ((encounter.grants_items || []).length) {
                messages.push({ kind: "success", text: `Inventory gained: ${encounter.grants_items.join(", ")}` });
            }
            for (const room of encounter.unlocks_rooms || []) {
                const unlocked = this.revealRoom(room);
                if (unlocked) messages.push(unlocked);
            }
            if (encounter.damage) messages.push({ kind: "error", text: `You took ${encounter.damage} damage.` });
            if (encounter.heals) messages.push({ kind: "success", text: `HP restored to ${this.state.hp}.` });
            return messages;
        }

        getVar(key) {
            if (key === "I") return this.state.inventory.join(",");
            if (key === "HP") return String(this.state.hp);
            return this.state.envVars[key] || "";
        }

        setVar(key, value) {
            if (key === "I") this.state.inventory = value.split(",").map((v) => v.trim()).filter(Boolean);
            else if (key === "HP") this.state.hp = Number(value) || this.state.hp;
            else this.state.envVars[key] = value;
        }

        advanceQuests(cmd, args, stdin) {
            let changed = false;
            while (this.state.currentQuestId < this.quests.length) {
                const q = this.quests[this.state.currentQuestId];
                const comp = q.completion || {};
                const required = comp.command || (q.required_commands || [])[0];
                if (required && required !== cmd) break;
                if (comp.location) {
                    const allowed = String(comp.location).split("|");
                    if (!allowed.some((loc) => this.state.cwd.includes(loc))) break;
                }
                if (comp.args && args[0] !== comp.args) break;
                if (comp.args_contains && !args.join(" ").includes(comp.args_contains)) break;
                if (comp.piped_with && !(stdin != null && stdin.length > 0)) break;
                if (comp.flag && !this.state.flags[comp.flag]) break;
                if (comp.item_check) {
                    const needed = String(comp.item_check).split(",").map((v) => v.trim());
                    if (!needed.every((item) => this.state.inventory.includes(item))) break;
                }
                if (!this.state.completedQuestIds.includes(q.id)) {
                    this.state.completedQuestIds.push(q.id);
                    this.awardXp(q.xp || 0, "quest");
                    this.emit("quest.completed", { id: q.id, title: q.title, xp: Number(q.xp || 0) });
                    changed = true;
                }
                this.state.currentQuestId += 1;
            }
            return changed;
        }

    }

    global.BashcrawlRuntime = { Runtime, defaultState, loadState, lineLimit, commandLabel, tokenize, progressionFrom, GAME_PLUGINS };
})(typeof globalThis !== "undefined" ? globalThis : window);
