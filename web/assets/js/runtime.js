(function initRuntime(global) {
    // From the TermForge framework core (vendored under
    // web/assets/js/vendor/termforge/ and loaded before this file — edit
    // termforge/core/, never the vendor copies).
    const { tokenize } = global.TermForge.parser;

    // Local-day helpers for the Daily Challenge, fed from the shell clock.
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

    // ── Encounter Creature Gallery ──────────────────────────────────────
    // Monospace-safe ASCII portraits keyed by encounter SCRIPT BASENAME
    // (runScript receives cmd.slice(2)). Pure ASCII only — no variation-
    // selector emoji. Keys MUST match a real encounter basename in world.json
    // or the line is never emitted. Color + glow come from the .kind-art rule.
    const ENCOUNTER_ART = {
        treasure: ["      ______________", "     /\\             \\", "    /  )=============)", "   /  /  .--------.  \\", "  (  (  / ()  ()()  \\ )", "   \\  \\ '----------' / )", "    \\  )============( /", "     \\/____________\\/", "      jewels gleam within..."].join("\n"),
        monster:  ["        .--.   .--.", "       (    `.'    )", "        )       O ( ", "       (  .-\"\"\"-.  )", "        \\/  ^ ^  \\/", "        (|  (_)  |)", "         \\  '-'  /", "      .---'.___.'---.", "     ( the serpent coils )"].join("\n"),
        ghost:    ["       .-=========-.", "      / .-\"\"\"\"\"\"-. \\", "     / /  o    o  \\ \\", "     | |    ..    | |", "     | |   '--'   | |", "      \\ \\        / /", "       '-\\_/\\/\\_/-'", "        )  (  )  (", "       boo... it drifts"].join("\n"),
        potion:   ["          .-=-.", "          | _ |", "          |( )|", "         .'   '.", "        / ~ ~ ~ \\", "       | ~ ~ ~ ~ |", "       | ~ ~ ~ ~ |", "        '._____.'", "     a glowing brew bubbles"].join("\n"),
        statue:   ["        .------.", "       | .----. |", "       | | OO | |", "       | | <> | |", "       | '----' |", "      _|        |_", "     /   stone    \\", "    /______________\\", "     the guardian wakes"].join("\n"),
        goblet:   ["        \\        /", "         \\.----./", "          \\    /", "           \\  /", "            )(", "           /  \\", "          /____\\", "      a jeweled goblet stands"].join("\n"),
        spell:    ["          *  .  +", "        .  _||_  .", "      +   /    \\   *", "     .   | rune |   .", "      *   \\____/   +", "        '  |  |  '", "     ~ the glyph ignites ~"].join("\n"),
        crystal:  ["         _________", "        /  _   _  \\", "       |  (o) (o)  |", "       |     >     |", "       |   \\___/   |", "        \\_________/", "      the crystal murmurs..."].join("\n"),
        penguin:  ["        .--.", "       /o  o\\", "       \\ <> /", "      /|    |\\", "     ` |    | `", "       |____|", "       /    \\", "    a dapper penguin"].join("\n"),
        nyarlathotep: ["      .-~~~-.", "     / .   . \\", "    |  (o o)  |", "     \\  \\_/  /", "    .-/.   .\\-.", "    ) (|   |) (", "     ~~ \\___/ ~~", "    the crawling chaos"].join("\n"),
        fountain: ["       .  .  .", "        \\ | /", "       .-=^=-.", "      (   :   )", "       \\ ~~~ /", "        |___|", "       /_____\\", "    a wishing fountain"].join("\n"),
    };

    // Bestiary metadata (display name + blurb) for each catalogued encounter,
    // in the order shown by the `bestiary` command.
    const BESTIARY = [
        { key: "treasure", name: "Treasure Chest", blurb: "Spills jewels for the bold." },
        { key: "monster", name: "Coiled Serpent", blurb: "Strikes at the unprepared." },
        { key: "ghost", name: "Restless Ghost", blurb: "Drifts through locked doors." },
        { key: "potion", name: "Glowing Potion", blurb: "Restores a weary hero's vigor." },
        { key: "statue", name: "Stone Guardian", blurb: "Wakes when you draw near." },
        { key: "goblet", name: "Jeweled Goblet", blurb: "A prize of the deep vaults." },
        { key: "spell", name: "Igniting Rune", blurb: "Crackles with raw magick." },
        { key: "crystal", name: "Murmuring Crystal", blurb: "Whispers half-truths." },
        { key: "penguin", name: "Dapper Penguin", blurb: "Inexplicably formal." },
        { key: "nyarlathotep", name: "The Crawling Chaos", blurb: "Best left uncatalogued." },
        { key: "fountain", name: "Wishing Fountain", blurb: "Bubbles with possibility." },
    ];

    // Return the {kind:'art'} portrait for a script basename, or null. O(1), pure.
    function encounterArtLine(script) {
        const art = ENCOUNTER_ART[script];
        return art ? { kind: "art", text: art } : null;
    }

    // ── The Training Arena mini-game ──────────────────────────────────────
    // Riddle -> the real command(s) that answer it. Players practice by
    // casting actual spells (active recall), the most durable way to memorise.
    const TRIALS = [
        { cat: "see", riddle: "Reveal everything standing in your current room.", answers: ["ls"], hint: "Three letters — short for 'list'.", teaches: "ls lists the contents of a room (directory)." },
        { cat: "see", riddle: "Reveal even the HIDDEN passages here (names that begin with a dot).", answers: ["ls -a", "ls -la", "ls -al", "ls -a ."], hint: "ls needs the 'all' flag: -a", teaches: "ls -a shows hidden entries whose names start with a dot." },
        { cat: "move", riddle: "Cast the spell that tells you exactly where you stand.", answers: ["pwd"], hint: "Print Working Directory.", teaches: "pwd prints your current location." },
        { cat: "move", riddle: "Descend into the room named 'cellar'.", answers: ["cd cellar"], hint: "Change Directory into cellar.", teaches: "cd <room> walks you into another directory." },
        { cat: "move", riddle: "Climb back to the room you came from.", answers: ["cd .."], hint: "'..' means the parent room.", teaches: "cd .. moves up one directory." },
        { cat: "read", riddle: "Read the entire scroll lying in this room.", answers: ["cat scroll"], hint: "conCATenate the scroll to your screen.", teaches: "cat <file> prints a file's full contents." },
        { cat: "read", riddle: "Peek at only the FIRST lines of the scroll.", answers: ["head scroll"], hint: "The opposite of 'tail'.", teaches: "head shows the first lines of a file." },
        { cat: "read", riddle: "Glimpse only the LAST lines of the scroll.", answers: ["tail scroll"], hint: "The opposite of 'head'.", teaches: "tail shows the last lines of a file." },
        { cat: "search", riddle: "Hunt the scroll for the word 'amulet'.", answers: ["grep amulet scroll"], hint: "grep <word> <file>", teaches: "grep finds lines matching a pattern inside a file." },
        { cat: "search", riddle: "Count how many lines the scroll holds.", answers: ["wc -l scroll", "wc scroll"], hint: "Word Count, with the -l (lines) flag.", teaches: "wc -l counts the lines in a file." },
        { cat: "make", riddle: "Conjure a brand-new room called 'workshop'.", answers: ["mkdir workshop"], hint: "MaKe DIRectory.", teaches: "mkdir creates a new directory (room)." },
        { cat: "make", riddle: "Forge an empty artifact named 'torch'.", answers: ["touch torch"], hint: "One word — it 'touches' a file into being.", teaches: "touch creates an empty file." },
        { cat: "magic", riddle: "Summon your inventory by echoing the $I treasure-rune.", answers: ["echo $i", 'echo "$i"'], hint: "echo $I", teaches: "echo prints text; $I holds your inventory." },
        { cat: "magic", riddle: "Run the 'treasure' encounter waiting in this room.", answers: ["./treasure"], hint: "Execute it with a leading ./", teaches: "./<script> runs an executable in the current room." },
        { cat: "magic", riddle: "Draw the map of the whole dungeon.", answers: ["map", "tree"], hint: "One short word — or the branching 'tree'.", teaches: "map / tree reveal the dungeon's layout." },
    ];
    const ARENA_OPEN = [
        "   __        __",
        "  /  |      |  \\   THE  TRAINING  ARENA",
        " | (o)|    |(o) |  ~ Spell Drills ~",
        "  \\__/  /\\  \\__/   prove your craft, adventurer",
        "  ====================================",
    ].join("\n");
    const ARENA_DONE = [
        "   *  .  ✦   A R E N A   C L E A R E D   ✦  .  *",
        "  =================================================",
    ].join("\n");
    const ARENA_RANKS = [
        { min: 0, title: "Novice Whisperer" },
        { min: 40, title: "Apprentice of the Shell" },
        { min: 80, title: "Adept Spellcaster" },
        { min: 130, title: "Terminal Master" },
        { min: 190, title: "Archmage of the Command Line" },
    ];
    // Achievements catalog. Icons use only emoji verified to render in COLOR in
    // the monospace log. test(s) reads runtime state; unlocked once, +5 XP each.
    const ACHIEVEMENTS = [
        { id: "first_steps", icon: "🧭", title: "First Steps", desc: "Found your place with pwd.", test: (s) => (s.stats.commands.pwd || 0) > 0 },
        { id: "cartographer", icon: "✨", title: "Cartographer", desc: "Charted the dungeon with map or tree.", test: (s) => (s.stats.commands.map || 0) > 0 || (s.stats.commands.tree || 0) > 0 },
        { id: "scholar", icon: "💡", title: "Scholar", desc: "Read three ancient scrolls.", test: (s) => (s.stats.catScrollCount || 0) >= 3 },
        { id: "world_builder", icon: "⚡", title: "World-Builder", desc: "Conjured a room with mkdir.", test: (s) => (s.stats.commands.mkdir || 0) > 0 },
        { id: "treasure_hunter", icon: "💰", title: "Treasure Hunter", desc: "Claimed your first loot.", test: (s) => (s.inventory || []).length > 0 },
        { id: "key_master", icon: "🔓", title: "Key-Master", desc: "Unlocked a hidden room.", test: (s) => Object.keys(s.reveals || {}).length > 0 },
        { id: "arena_graduate", icon: "🏅", title: "Arena Graduate", desc: "Cleared a Training Arena run.", test: (s) => !!(s.flags && s.flags.arena_cleared) },
        { id: "speed_demon", icon: "🏆", title: "Speed Demon", desc: "Finished a timed Speed Run.", test: (s) => s.speedrunBest != null },
        { id: "trailblazer", icon: "✅", title: "Trailblazer", desc: "Completed a Path-Finder journey.", test: (s) => !!(s.flags && s.flags.pathfind_done) },
        { id: "naturalist", icon: "✨", title: "Naturalist", desc: "Catalogued 5 creatures in the bestiary.", test: (s) => (s.bestiary || []).length >= 5 },
        { id: "seasoned", icon: "🔥", title: "Seasoned Adventurer", desc: "Earned 150 XP.", test: (s) => (s.xp || 0) >= 150 },
    ];

    // Compass rose for the Path-Finder mini-game (box-safe ASCII).
    const PATHFIND_ART = [
        "       .  N  .",
        "    .   \\ | /   .",
        "   W ----(+)---- E",
        "    '   / | \\   '",
        "       '  S  '",
    ].join("\n");
    // Banner shown when the player's rank advances (box-safe ASCII).
    const LEVELUP_ART = [
        "    .  *  .       *   .    *  .",
        "   *   L E V E L   U P !   *",
        "    *  .   *       .   *  .  *",
    ].join("\n");
    // Header for the profile / character sheet (box-safe ASCII).
    const PROFILE_ART = [
        "  .-----------------------------.",
        "  |      C H A R A C T E R      |",
        "  |          S H E E T          |",
        "  '-----------------------------'",
    ].join("\n");

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

    class Runtime extends global.TermForge.Shell {
        constructor(data, state, options) {
            super({
                world: data.world,
                commands: data.commands,
                state: state || defaultState(data.world.root),
                bare: Boolean(options && options.bare),
            });
            this.quests = data.quests.quests || [];
            // The game's full command surface, enumerated in one static
            // literal: P.*/F.* are TermForge pack functions, this.cmd* are
            // game commands on this class. scripts/validate_runtime_commands.py
            // regex-reads this literal — keep one `key: ref,` per line, bare
            // references only, and exactly one `this.handlers = {` in the file.
            const P = global.TermForge.packs.posix.commands;
            const F = global.TermForge.packs.flavour.commands;
            this.handlers = {
                help: this.cmdHelp,
                pwd: P.pwd,
                ls: P.ls,
                cd: P.cd,
                cat: P.cat,
                less: P.cat,
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
                xp: this.cmdXp,
                fortune: F.fortune,
                cowsay: F.cowsay,
                figlet: F.figlet,
                banner: F.banner,
                sl: F.sl,
                train: this.cmdTrain,
                drill: this.cmdTrain,
                practice: this.cmdTrain,
                arena: this.cmdTrain,
                speedrun: this.cmdSpeedrun,
                speed: this.cmdSpeedrun,
                pathfind: this.cmdPathfind,
                seek: this.cmdPathfind,
                journey: this.cmdPathfind,
                achievements: this.cmdAchievements,
                badges: this.cmdAchievements,
                profile: this.cmdProfile,
                stats: this.cmdProfile,
                sheet: this.cmdProfile,
                bestiary: this.cmdBestiary,
                codex: this.cmdBestiary,
                daily: this.cmdDaily,
                challenge: this.cmdDaily,
                commands: this.cmdCommands,
                cmds: this.cmdCommands,
                menu: this.cmdCommands,
                features: this.cmdCommands,
            };
            this.installGameHooks();
        }

        // Wire the game onto the TermForge hook spine. Every subscriber body
        // is the exact logic the pre-framework emulator ran inline in its
        // execute/runPipeline/executeSegment methods.
        installGameHooks() {
            this.hooks.on("preExecute", () => {
                this.refreshDaily();
            });
            // While the Training Arena is active, every line is an answer, not a command.
            this.hooks.on("interceptLine", (line) => (
                (this.state.trainer && this.state.trainer.active) ? this.trainerInput(line) : null
            ));
            // Achievements first (they award XP), then daily, then rank-up (reads final XP).
            this.hooks.on("postExecute", () => (
                this.checkAchievements().concat(this.checkDaily()).concat(this.checkRankUp())
            ));
            // Path-Finder watches normal play: count moves, detect arrival.
            this.hooks.on("observePipeline", (line) => (
                (this.state.pathfind && this.state.pathfind.active) ? this.pathfindObserve(line) : []
            ));
            this.hooks.on("beforeCommand", (cmd, args, stdin) => {
                this.bump(cmd);
                this.state.stats.lastPipedIn = stdin != null;
            });
            // `./script` resolves against the world's encounter table.
            this.hooks.on("execDispatch", (name) => {
                const path = `${this.state.cwd}/${name}`.replace(/\/+/g, "/");
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

        // `man` fallback copy for the game's handler-backed commands.
        manBuiltinNote(cmd) {
            return `Built-in for Bashcrawl Web. Try '${cmd} --help' or open Docs (F1).`;
        }

        // Celebrate when accumulated XP crosses an ARENA_RANKS threshold.
        checkRankUp() {
            const idx = ARENA_RANKS.reduce((acc, r, i) => ((this.state.xp || 0) >= r.min ? i : acc), 0);
            if (typeof this.state.rankIndex !== "number") {
                this.state.rankIndex = idx; // baseline for older saves; no retroactive party
                return [];
            }
            if (idx <= this.state.rankIndex) return [];
            this.state.rankIndex = idx;
            return [
                { kind: "control", action: "levelup" },
                { kind: "art", text: LEVELUP_ART },
                { kind: "success", text: `★  You are now ${ARENA_RANKS[idx].title}!` },
            ];
        }

        bump(cmd) {
            this.state.stats.commands[cmd] = (this.state.stats.commands[cmd] || 0) + 1;
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

        // Prompt shown in the input row; the Arena swaps in a battle prompt.
        // ── Path-Finder mini-game ───────────────────────────────────────────
        // Gives the player a target room and lets them navigate there with REAL
        // cd/ls/pwd; counts cd "moves" and detects arrival. Practices the core
        // navigation skill (distinct from the recall-based Training Arena).
        cmdPathfind(args) {
            if (this.state.trainer && this.state.trainer.active) {
                return [{ kind: "error", text: "Finish or quit the Training Arena first (type 'quit')." }];
            }
            const sub = (args[0] || "").toLowerCase();
            const pf = this.state.pathfind;
            if (["quit", "stop", "abort", "q"].includes(sub)) {
                if (!pf || !pf.active) return [{ kind: "dim", text: "No journey in progress." }];
                const target = pf.targetTitle;
                this.state.pathfind = null;
                return [{ kind: "dim", text: `Journey to ${target} abandoned.` }];
            }
            if (pf && pf.active) {
                return [
                    { kind: "magic", text: `🧭 Still seeking ${pf.targetTitle}  ·  ${pf.moves} move(s) so far` },
                    { kind: "dim", text: "Use cd / ls / pwd to find it. 'pathfind quit' to abandon." },
                ];
            }
            // Pick a reachable main-path target that isn't the current room.
            const candidates = [
                "/entrance",
                "/entrance/cellar",
                "/entrance/cellar/armoury",
                "/entrance/cellar/armoury/chamber",
            ].filter((p) => this.isDir(p) && p !== this.state.cwd);
            if (!candidates.length) return [{ kind: "error", text: "No reachable destination right now." }];
            const target = candidates[Math.floor(this.rng() * candidates.length)];
            const targetTitle = (this.world.rooms[target] || {}).title || target;
            this.state.pathfind = { active: true, target, targetTitle, moves: 0 };
            return [
                { kind: "art", text: PATHFIND_ART },
                { kind: "info", text: `Find your way to ${targetTitle}.` },
                { kind: "dim", text: "Navigate with cd / ls / pwd. Fewer moves = more XP. 'pathfind quit' to abandon." },
            ];
        }

        pathfindObserve(line) {
            const pf = this.state.pathfind;
            const cmd = tokenize(line.trim())[0];
            if (cmd === "cd") pf.moves += 1;
            if (this.state.cwd !== pf.target) return [];
            // Arrived.
            const moves = pf.moves;
            const xp = Math.max(15, 45 - moves * 5);
            this.state.xp += xp;
            const title = pf.targetTitle;
            this.state.pathfind = null;
            this.state.flags.pathfind_done = true;
            const flair = moves <= 1 ? "  A direct route!" : moves <= 3 ? "  Swiftly done." : "";
            return [
                { kind: "success", text: `🧭 You reached ${title} in ${moves} move${moves === 1 ? "" : "s"}!  +${xp} XP${flair}` },
                { kind: "dim", text: "Type 'pathfind' to seek a new destination." },
            ];
        }

        // ── Achievements ─────────────────────────────────────────────────────
        // Evaluate the catalog against current state; award any newly-earned
        // badge (once each, +5 XP) and return announcement lines.
        checkAchievements() {
            if (!Array.isArray(this.state.achievements)) this.state.achievements = [];
            const have = this.state.achievements;
            const out = [];
            for (const a of ACHIEVEMENTS) {
                if (have.includes(a.id)) continue;
                let earned = false;
                try { earned = !!a.test(this.state); } catch (e) { earned = false; }
                if (!earned) continue;
                have.push(a.id);
                this.state.xp += 5;
                out.push({ kind: "success", text: `${a.icon} Achievement unlocked: ${a.title} — ${a.desc}  (+5 XP)` });
            }
            return out;
        }

        // Character sheet: a one-glance summary of all progress.
        cmdProfile() {
            const s = this.state;
            const rank = (ARENA_RANKS.filter((r) => (s.xp || 0) >= r.min).pop() || ARENA_RANKS[0]).title;
            const cmds = s.stats.commands || {};
            const distinct = Object.keys(cmds).length;
            const total = Object.values(cmds).reduce((a, b) => a + b, 0);
            const inv = s.inventory || [];
            const best = s.speedrunBest != null ? `${s.speedrunBest.toFixed(1)}s` : "—";
            const label = (text) => `  ${(text + ":").padEnd(18)}`;
            return [
                { kind: "art", text: PROFILE_ART },
                { kind: "magic", text: `  Rank:  ${rank}` },
                { kind: "output", text: `${label("XP")}${s.xp}        HP: ${s.hp}/100` },
                { kind: "output", text: `${label("Quests")}${s.completedQuestIds.length}/${this.quests.length} complete` },
                { kind: "output", text: `${label("Badges")}${(s.achievements || []).length}/${ACHIEVEMENTS.length} earned` },
                { kind: "output", text: `${label("Scrolls read")}${s.stats.catScrollCount || 0}` },
                { kind: "output", text: `${label("Commands")}${distinct} distinct (${total} cast)` },
                { kind: "output", text: `${label("Hidden rooms")}${Object.keys(s.reveals || {}).length} unlocked` },
                { kind: "output", text: `${label("Best speed run")}${best}` },
                { kind: "output", text: `${label("Inventory")}${inv.length ? inv.join(", ") : "(empty)"}` },
                { kind: "dim", text: "  'achievements' for badges  ·  'train' / 'speedrun' / 'pathfind' to grow" },
            ];
        }

        // ── Daily Challenge ──────────────────────────────────────────────────
        // Each local day offers an XP goal; completing it on consecutive days
        // builds a streak. Rolls over automatically on the first command of a
        // new day. Date use is fine in the browser.
        refreshDaily() {
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

        checkDaily() {
            const d = this.state.daily;
            if (!d || d.completed || !d.date) return [];
            const earned = this.state.xp - d.baselineXp;
            if (earned < d.goal) return [];
            d.completed = true;
            d.streak = (d.lastDate === yesterdayStr(this.clock.now())) ? d.streak + 1 : 1;
            d.lastDate = d.date;
            this.state.xp += 25;
            return [
                { kind: "success", text: `🔥 Daily challenge complete!  +25 XP  ·  Streak: ${d.streak} day${d.streak === 1 ? "" : "s"}` },
                { kind: "dim", text: "Come back tomorrow to keep the streak alive." },
            ];
        }

        cmdDaily() {
            this.refreshDaily();
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

        // Bestiary: catalogue of encounters you've run. `bestiary <key>` shows
        // the art + blurb for a discovered creature; bare `bestiary` lists all.
        cmdBestiary(args) {
            const seen = this.state.bestiary || [];
            const want = (args[0] || "").toLowerCase();
            if (want) {
                const entry = BESTIARY.find((e) => e.key === want);
                if (!entry) return [{ kind: "error", text: `No such creature: ${want}` }];
                if (!seen.includes(want)) return [{ kind: "dim", text: `You haven't encountered the ${entry.name} yet.` }];
                return [
                    { kind: "art", text: ENCOUNTER_ART[want] || "" },
                    { kind: "magic", text: `  ${entry.name}` },
                    { kind: "output", text: `  ${entry.blurb}` },
                ];
            }
            const lines = [{ kind: "magic", text: `✨ Bestiary — ${seen.length}/${BESTIARY.length} catalogued` }];
            for (const e of BESTIARY) {
                lines.push(seen.includes(e.key)
                    ? { kind: "success", text: `  ✅ ${e.name} — ${e.blurb}` }
                    : { kind: "dim", text: "  🔒 ??? — undiscovered" });
            }
            lines.push({ kind: "dim", text: "  Run an encounter (e.g. ./treasure) to catalogue it.  'bestiary <name>' to view one." });
            return lines;
        }

        cmdAchievements() {
            const have = this.state.achievements || [];
            const lines = [{ kind: "magic", text: `🏅 Achievements — ${have.length}/${ACHIEVEMENTS.length} unlocked` }];
            for (const a of ACHIEVEMENTS) {
                const got = have.includes(a.id);
                lines.push({
                    kind: got ? "success" : "dim",
                    text: got ? `${a.icon} ${a.title} — ${a.desc}` : `🔒 ${a.title} — ${a.desc}`,
                });
            }
            return lines;
        }

        // ── Command reference ────────────────────────────────────────────────
        // Discoverability hub for the web-only features. These commands have no
        // bash equivalent and are otherwise invisible, so surface them grouped
        // by purpose with a one-line "what it does" and live progress counts.
        cmdCommands() {
            const s = this.state;
            const badges = (s.achievements || []).length;
            const seen = (s.bestiary || []).length;
            const rank = (ARENA_RANKS.filter((r) => (s.xp || 0) >= r.min).pop() || ARENA_RANKS[0]).title;
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
                        ["achievements", `Badge catalogue — ${badges}/${ACHIEVEMENTS.length} unlocked`],
                        ["bestiary", `Creature codex — ${seen}/${BESTIARY.length} catalogued`],
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

        cmdTrain() {
            return this.startArena(false);
        }

        cmdSpeedrun() {
            return this.startArena(true);
        }

        startArena(speed) {
            const count = Math.min(8, TRIALS.length);
            const pool = TRIALS.map((_, i) => i);
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
                    { kind: "art", text: ARENA_OPEN },
                    { kind: "magic", text: `SPEED RUN — clear ${count} trials against the clock!` },
                    { kind: "dim", text: best != null ? `Your best: ${best.toFixed(1)}s. Beat it!` : "No record yet — set the first time!" },
                    { kind: "dim", text: "Answer fast.  skip = pass · quit = leave" },
                    ...this.trainerChallenge(),
                ];
            }
            return [
                { kind: "art", text: ARENA_OPEN },
                { kind: "info", text: `${count} trials await. Answer each by casting the real spell.` },
                { kind: "dim", text: "Commands:  hint = clue · skip = pass · quit = leave the arena" },
                ...this.trainerChallenge(),
            ];
        }

        trainerChallenge() {
            const t = this.state.trainer;
            const q = TRIALS[t.queue[t.pos]];
            const flame = t.streak >= 3 ? "  🔥" : "";
            return [
                { kind: "magic", text: `✨  Trial ${t.pos + 1}/${t.queue.length}   ·   Score ${t.score} XP   ·   Streak ${t.streak}${flame}` },
                { kind: "output", text: `    ${q.riddle}` },
            ];
        }

        trainerInput(raw) {
            const t = this.state.trainer;
            const cmd = raw.trim().replace(/\s+/g, " ").toLowerCase();
            if (["quit", "exit", ":q", "q"].includes(cmd)) return this.trainerFinish(true);
            const q = TRIALS[t.queue[t.pos]];
            if (cmd === "hint") return [{ kind: "dim", text: `💡 ${q.hint}` }];
            if (cmd === "skip") {
                t.streak = 0; t.tries = 0; t.pos += 1;
                return [{ kind: "dim", text: `↷ Skipped. The spell was:  ${q.answers[0]}  — ${q.teaches}` }, ...this.advanceTrainer()];
            }
            if (q.answers.includes(cmd)) {
                const gained = 10 + Math.min(t.streak, 5) * 2;
                t.score += gained; t.streak += 1; t.best = Math.max(t.best, t.streak);
                this.state.xp += gained;
                t.tries = 0; t.pos += 1;
                const cheer = t.streak >= 3 ? `  🔥 ${t.streak} in a row!` : "";
                return [{ kind: "success", text: `✅ Correct!  +${gained} XP${cheer}   ${q.teaches}` }, ...this.advanceTrainer()];
            }
            t.tries += 1; t.streak = 0;
            if (t.tries >= 2) {
                t.tries = 0; t.pos += 1;
                return [{ kind: "error", text: `❌ The spell was:  ${q.answers[0]}  — ${q.teaches}` }, ...this.advanceTrainer()];
            }
            return [{ kind: "error", text: `❌ "${raw.trim()}" fizzles. Try once more, or type 'hint'.` }];
        }

        advanceTrainer() {
            const t = this.state.trainer;
            if (t.pos >= t.queue.length) return this.trainerFinish(false);
            return this.trainerChallenge();
        }

        trainerFinish(quit) {
            const t = this.state.trainer;
            const answered = t.pos;
            const rank = ARENA_RANKS.filter((r) => t.score >= r.min).pop() || ARENA_RANKS[0];
            const completed = answered >= t.queue.length;
            if (completed) this.state.flags.arena_cleared = true;
            this.state.trainer = null;
            const lines = [];
            if (quit) lines.push({ kind: "dim", text: "You lower your blade and step out of the arena." });
            lines.push({ kind: "art", text: ARENA_DONE });
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

        cmdHint() {
            const q = this.quests[this.state.currentQuestId];
            if (!q) return [{ kind: "success", text: "No quests left. Try `map`, `tree`, `cowsay hi`, or the `train` / `speedrun` / `pathfind` mini-games." }];
            return [{ kind: "magic", text: `🔮 ${q.title}\n   ${q.hint || q.objective}` }];
        }

        cmdXp() {
            const xp = this.state.xp;
            const level = Math.max(1, 1 + Math.floor(xp / 200));
            const into = xp % 200;
            const filled = Math.round(into / 20);
            const bar = "█".repeat(filled) + "░".repeat(10 - filled);
            return [{ kind: "info", text: `Level ${level}  ${bar}  ${into}/200 to next level  (total ${xp} XP)` }];
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
                return [
                    { kind: "magic", text: "📕 The grimoire's knowledge merges with your shell." },
                    { kind: "success", text: "Defined `bc` as a quick demo (output: 42). Scriptorium quest ready." },
                ];
            }
            if (this.readFile(path) !== null) {
                return [{ kind: "info", text: `Sourced ${raw} (no extra definitions in the web port).` }];
            }
            return [{ kind: "error", text: `Cannot source: ${raw}` }];
        }

        cmdQuest() {
            const q = this.quests[this.state.currentQuestId];
            return [{ kind: "info", text: q ? `${q.title}\n${q.objective}\nHint: ${q.hint || "Explore and read scrolls."}` : "All quests complete." }];
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

        cmdSave(args) {
            if (args[0] === "export") {
                return [{ kind: "output", text: this.encodeBase64(JSON.stringify(this.state)) }];
            }
            if (args[0] === "import") {
                return [{ kind: "info", text: "Paste/import UI is planned. For now, localStorage saves automatically." }];
            }
            return [{ kind: "success", text: "Progress is saved automatically in this browser." }];
        }

        cmdReset() {
            this.state = defaultState(this.world.root);
            return [{ kind: "control", action: "reset" }, { kind: "info", text: "Session reset. Start with pwd." }];
        }

        runScript(script) {
            const path = `${this.state.cwd}/${script}`.replace(/\/+/g, "/");
            const encounter = this.world.encounters[path];
            if (!encounter) return [{ kind: "error", text: `No runnable script: ./${script}` }];
            const messages = [{ kind: "magic", text: `${encounter.icon || "⚡"} ${encounter.description || script}` }];
            const portrait = encounterArtLine(script);
            if (portrait) {
                messages.unshift(portrait);
                if (!Array.isArray(this.state.bestiary)) this.state.bestiary = [];
                if (!this.state.bestiary.includes(script)) this.state.bestiary.push(script);
            }
            for (const item of encounter.grants_items || []) {
                if (!this.state.inventory.includes(item)) this.state.inventory.push(item);
            }
            if (encounter.damage) this.state.hp = Math.max(0, this.state.hp - Number(encounter.damage));
            if (encounter.heals) this.state.hp = Math.min(100, this.state.hp + Number(encounter.heals));
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
                    this.state.xp += Number(q.xp || 0);
                    changed = true;
                }
                this.state.currentQuestId += 1;
            }
            return changed;
        }

    }

    global.BashcrawlRuntime = { Runtime, defaultState, tokenize };
})(typeof globalThis !== "undefined" ? globalThis : window);
