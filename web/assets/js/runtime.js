(function initRuntime(global) {
    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function tokenize(line) {
        const tokens = [];
        const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
        let match;
        while ((match = re.exec(line))) {
            tokens.push(match[1] ?? match[2] ?? match[3]);
        }
        return tokens;
    }

    function splitPipes(line) {
        const segments = [];
        let depth = 0;
        let quote = null;
        let buf = "";
        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (quote) {
                if (ch === quote) quote = null;
                buf += ch;
                continue;
            }
            if (ch === "'" || ch === "\"") { quote = ch; buf += ch; continue; }
            if (ch === "(" || ch === "[") depth += 1;
            if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
            if (ch === "|" && depth === 0) {
                segments.push(buf);
                buf = "";
                continue;
            }
            buf += ch;
        }
        segments.push(buf);
        return segments.map((s) => s.trim()).filter(Boolean);
    }

    function asLines(text) {
        if (text == null) return [];
        return String(text).split("\n");
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
    };

    // Return the {kind:'art'} portrait for a script basename, or null. O(1), pure.
    function encounterArtLine(script) {
        const art = ENCOUNTER_ART[script];
        return art ? { kind: "art", text: art } : null;
    }

    const ART = {
        banner: [
            "       ╔════════════════════════════════════════════════════╗",
            "       ║   ____            __                       __      ║",
            "       ║  / __ )___ ______/ /_  ______________ ___ / /      ║",
            "       ║ / __  / __ `/ ___/ __ \\/ ___/ ___/ __ `__ \\/ /      ║",
            "       ║/ /_/ / /_/ (__  ) / / / /__/ /  / / / / / / /__    ║",
            "       ║\\____/\\__,_/____/_/ /_/\\___/_/  /_/ /_/ /_/____/    ║",
            "       ║                                                    ║",
            "       ║       Type  pwd  to begin the descent. F1 for help ║",
            "       ╚════════════════════════════════════════════════════╝",
        ].join("\n"),
        cow: (msg) => {
            const m = String(msg || "Moo.");
            const top = " " + "_".repeat(m.length + 2);
            const mid = "< " + m + " >";
            const bot = " " + "-".repeat(m.length + 2);
            return [
                top,
                mid,
                bot,
                "        \\   ^__^",
                "         \\  (oo)\\_______",
                "            (__)\\       )\\/\\",
                "                ||----w |",
                "                ||     ||",
            ].join("\n");
        },
        sl: [
            "      ====        ________                ___________",
            "  _D _|  |_______/        \\__I_I_____===__|_________|",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|",
            "   /     |  |   H  |  |     |   |         ||_| |_||",
            "  |      |  |   H  |__--------------------| [___] |",
            "  | ________|___H__/__|_____/[][]~\\_______|       |",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__",
            "__/ =| o |=-O=====O=====O=====O \\ ____Y___________|__|",
            " |/-=|___|=    ||    ||    ||    |_____/~\\___/   ",
            "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/         ",
        ].join("\n"),
        sparkle: [
            "      .   *  .   .  *  .   *",
            "    *  ✦  .   *  ✧   .  *  ✦   ✧",
            "      ✦  ✧ ✦  Q U E S T  ✦ ✧ ✦",
            "    *      C O M P L E T E      *",
            "      ✧  *   .  ✦   . *  ✧   ✦",
        ].join("\n"),
        skull: [
            "        _____",
            "       /     \\",
            "      | () () |",
            "       \\  ^  /",
            "        |||||",
            "        |||||",
        ].join("\n"),
        portal: [
            "          .  *  .   *  .   .",
            "        ╭───────────────────╮",
            "        │  ◌  the portal  ◌  │",
            "        │   ───→  /scriptorium",
            "        ╰───────────────────╯",
            "          *  .   .  *  .  *",
        ].join("\n"),
        treasure: [
            "       _.--\"\"--._",
            "      / _      _ \\",
            "     | (o)____(o) |",
            "      \\ '--.__,--' /",
            "       `-._____.-'",
        ].join("\n"),
    };

    const FORTUNES = [
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
    ];

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

    function defaultState(root) {
        return {
            cwd: root || "/entrance",
            hp: 100,
            xp: 0,
            inventory: [],
            aliases: {},
            envVars: {},
            userNodes: {},
            completedQuestIds: [],
            currentQuestId: 0,
            history: [],
            historyIndex: -1,
            flags: {},
            reveals: {},
            trainer: null,
            pathfind: null,
            speedrunBest: null,
            achievements: [],
            stats: { commands: {}, catScrollCount: 0, initialized: false },
        };
    }

    class Runtime {
        constructor(data, state) {
            this.world = data.world;
            this.quests = data.quests.quests || [];
            this.commands = data.commands;
            this.state = state || defaultState(this.world.root);
            this.handlers = {
                help: this.cmdHelp,
                pwd: this.cmdPwd,
                ls: this.cmdLs,
                cd: this.cmdCd,
                cat: this.cmdCat,
                less: this.cmdCat,
                head: this.cmdHead,
                tail: this.cmdTail,
                wc: this.cmdWc,
                grep: this.cmdGrep,
                echo: this.cmdEcho,
                export: this.cmdExport,
                let: this.cmdLet,
                alias: this.cmdAlias,
                source: this.cmdSource,
                mkdir: this.cmdMkdir,
                touch: this.cmdTouch,
                cp: this.cmdCp,
                mv: this.cmdMv,
                rm: this.cmdRm,
                history: this.cmdHistory,
                clear: this.cmdClear,
                quest: this.cmdQuest,
                inventory: this.cmdInventory,
                health: this.cmdHealth,
                status: this.cmdStatus,
                save: this.cmdSave,
                reset: this.cmdReset,
                sort: this.cmdSort,
                uniq: this.cmdUniq,
                find: this.cmdFind,
                tree: this.cmdTree,
                file: this.cmdFile,
                chmod: this.cmdChmod,
                man: this.cmdMan,
                whoami: this.cmdWhoami,
                date: this.cmdDate,
                env: this.cmdEnv,
                map: this.cmdMap,
                look: this.cmdLook,
                hint: this.cmdHint,
                xp: this.cmdXp,
                fortune: this.cmdFortune,
                cowsay: this.cmdCowsay,
                figlet: this.cmdFiglet,
                banner: this.cmdBanner,
                sl: this.cmdSl,
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
            };
        }

        execute(line) {
            // While the Training Arena is active, every line is an answer, not a command.
            const out = (this.state.trainer && this.state.trainer.active)
                ? this.trainerInput(line)
                : this.runPipeline(line);
            // Achievements are checked after every line, in all modes.
            const unlocked = this.checkAchievements();
            return unlocked.length ? out.concat(unlocked) : out;
        }

        runPipeline(line) {
            const segments = splitPipes(line.trim());
            if (!segments.length) return [];
            let stdin = null;
            const collected = [];
            for (let i = 0; i < segments.length; i += 1) {
                const segment = segments[i];
                const result = this.executeSegment(segment, stdin);
                const isLast = i === segments.length - 1;
                if (!isLast) {
                    stdin = result
                        .filter((r) => r.action !== "clear" && r.action !== "reset" && r.kind !== "error")
                        .map((r) => r.text || "")
                        .join("\n");
                    if (result.some((r) => r.kind === "error")) {
                        collected.push(...result);
                        return collected;
                    }
                    continue;
                }
                collected.push(...result);
            }
            // Path-Finder watches normal play: count moves, detect arrival.
            if (this.state.pathfind && this.state.pathfind.active) {
                collected.push(...this.pathfindObserve(line));
            }
            return collected;
        }

        executeSegment(segment, stdin) {
            const expanded = this.applyAlias(segment.trim());
            const tokens = tokenize(expanded);
            if (!tokens.length) return [];
            const cmd = tokens[0];
            const args = tokens.slice(1);
            this.bump(cmd);
            this.state.stats.lastPipedIn = stdin != null;
            if (cmd.startsWith("./")) {
                const output = this.runScript(cmd.slice(2));
                this.advanceQuests(cmd, args);
                return output;
            }
            const handler = this.handlers[cmd];
            if (!handler) {
                return [{ kind: "error", text: `Unknown command: ${cmd}. Try help.` }];
            }
            const output = handler.call(this, args, stdin);
            this.advanceQuests(cmd, args, stdin);
            return output;
        }

        applyAlias(line) {
            const [head, ...rest] = tokenize(line);
            if (!head || !this.state.aliases[head]) return line;
            return [this.state.aliases[head], ...rest].join(" ");
        }

        bump(cmd) {
            this.state.stats.commands[cmd] = (this.state.stats.commands[cmd] || 0) + 1;
        }

        resolve(path, cwd = this.state.cwd) {
            if (!path || path === ".") return cwd;
            const base = path.startsWith("/") ? [] : cwd.split("/").filter(Boolean);
            for (const part of path.split("/")) {
                if (!part || part === ".") continue;
                if (part === "..") base.pop();
                else base.push(part);
            }
            return "/" + base.join("/");
        }

        parentPath(path) {
            const parts = path.split("/").filter(Boolean);
            parts.pop();
            return "/" + parts.join("/");
        }

        // Translate a player-visible path (e.g. /entrance/chapel) into the actual
        // stored world path (e.g. /entrance/.chapel) for any room the player has
        // unlocked. Mirrors the bash treasure's `mv ../.chapel ../chapel`.
        actual(path) {
            const reveals = this.state.reveals || {};
            let best = null;
            for (const visible of Object.keys(reveals)) {
                if (path === visible || path.startsWith(visible + "/")) {
                    if (!best || visible.length > best.length) best = visible;
                }
            }
            return best ? reveals[best] + path.slice(best.length) : path;
        }

        basename(path) {
            return path.split("/").filter(Boolean).pop() || "";
        }

        node(path) {
            const real = this.actual(path);
            if (this.world.directories[real]) return { type: "dir" };
            if (Object.prototype.hasOwnProperty.call(this.world.files, real)) return { type: "file" };
            return this.state.userNodes[path] || null;
        }

        isDir(path) {
            return Boolean(this.world.directories[this.actual(path)] || this.state.userNodes[path]?.type === "dir");
        }

        readFile(path) {
            const real = this.actual(path);
            if (Object.prototype.hasOwnProperty.call(this.world.files, real)) return this.world.files[real];
            const node = this.state.userNodes[path];
            if (node && node.type === "file") return node.content || "";
            return null;
        }

        entries(path, showHidden = false) {
            const real = this.actual(path);
            const reveals = this.state.reveals || {};
            const base = this.world.directories[real] || [];
            const result = [];
            for (const entry of base) {
                // A hidden room the player has unlocked is shown un-dotted and visible,
                // matching the bash treasure that renames `.chapel` -> `chapel`.
                if (entry.hidden && reveals[`${path}/${entry.name.replace(/^\./, "")}`.replace(/\/+/g, "/")]) {
                    result.push({ name: entry.name.replace(/^\./, ""), type: entry.type, hidden: false });
                } else if (showHidden || !entry.hidden) {
                    result.push({ ...entry });
                }
            }
            const prefix = path.endsWith("/") ? path : `${path}/`;
            for (const [nodePath, node] of Object.entries(this.state.userNodes)) {
                if (this.parentPath(nodePath) !== path) continue;
                const name = this.basename(nodePath);
                if (!showHidden && name.startsWith(".")) continue;
                if (!result.some((entry) => entry.name === name)) {
                    result.push({ name, type: node.type, hidden: name.startsWith(".") });
                }
                void prefix;
            }
            return result.sort((a, b) => a.name.localeCompare(b.name));
        }

        currentRoomMeta() {
            return this.world.rooms[this.actual(this.state.cwd)] || {};
        }

        // Reveal a hidden room by logical name (e.g. "chapel"), mapping the visible
        // path to its stored dotted path. Returns a message if newly unlocked.
        revealRoom(name) {
            const dotName = `.${name}`;
            for (const [dirPath, list] of Object.entries(this.world.directories)) {
                if (!Array.isArray(list) || !list.some((e) => e.name === dotName && e.hidden)) continue;
                const visiblePath = `${dirPath}/${name}`.replace(/\/+/g, "/");
                const realPath = `${dirPath}/${dotName}`.replace(/\/+/g, "/");
                if (this.state.reveals[visiblePath]) return null;
                this.state.reveals[visiblePath] = realPath;
                return { kind: "success", text: `🔓 A new passage opens: ${name}/` };
            }
            return null;
        }

        cmdHelp() {
            return [
                { kind: "info", text: "Open the Docs panel with F1 (or click Docs)." },
                { kind: "dim", text: "Try:  pwd | ls -F | cat scroll | cd cellar | tree | map | hint | cowsay hi | ./oracle" },
                { kind: "magic", text: "Mini-games:  'train' drills spells (or 'speedrun' against the clock);  'pathfind' quests to a target room. All grant XP." },
                { kind: "dim", text: "Type 'achievements' to see the badges you can earn." },
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
            const target = candidates[Math.floor(Math.random() * candidates.length)];
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
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            this.state.trainer = {
                queue: pool.slice(0, count), pos: 0, score: 0, streak: 0, best: 0, tries: 0,
                active: true, speed: !!speed, startedAt: speed ? Date.now() : 0,
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
                const elapsed = Math.round((Date.now() - t.startedAt) / 100) / 10;
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

        cmdPwd() {
            return [{ kind: "output", text: this.state.cwd }];
        }

        cmdLs(args) {
            const showHidden = args.some((arg) => arg.includes("a"));
            const showMarkers = args.some((arg) => arg.includes("F"));
            const targetArg = args.find((arg) => !arg.startsWith("-"));
            const target = this.resolve(targetArg || ".");
            if (!this.isDir(target)) return [{ kind: "error", text: `Not a directory: ${targetArg || target}` }];
            const text = this.entries(target, showHidden).map((entry) => {
                if (!showMarkers) return entry.name;
                if (entry.type === "dir") return `${entry.name}/`;
                if (entry.type === "exec") return `${entry.name}*`;
                return entry.name;
            }).join("  ");
            return [{ kind: "output", text: text || "(empty)" }];
        }

        cmdCd(args) {
            const next = this.resolve(args[0] || this.world.root);
            if (!this.isDir(next)) return [{ kind: "error", text: `Not a directory: ${args[0] || next}` }];
            this.state.cwd = next;
            return [{ kind: "success", text: `Moved to ${next}` }];
        }

        cmdCat(args) {
            const path = this.resolve(args[0] || "");
            if (!args[0]) return [{ kind: "error", text: "cat requires a file path" }];
            const text = this.readFile(path);
            if (text === null) return [{ kind: "error", text: `No such file: ${args[0]}` }];
            if (this.basename(path) === "scroll") this.state.stats.catScrollCount += 1;
            return [{ kind: "output", text }];
        }

        cmdHead(args, stdin) {
            const countIndex = args.indexOf("-n");
            const count = countIndex >= 0 ? Number(args[countIndex + 1]) || 10 : 10;
            const file = args.find((arg, index) => arg !== "-n" && index !== countIndex + 1);
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "head requires a readable file or piped input" }];
            return [{ kind: "output", text: text.split("\n").slice(0, count).join("\n") }];
        }

        cmdTail(args, stdin) {
            const countIndex = args.indexOf("-n");
            const count = countIndex >= 0 ? Number(args[countIndex + 1]) || 10 : 10;
            const file = args.find((arg, index) => arg !== "-n" && index !== countIndex + 1);
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "tail requires a readable file or piped input" }];
            return [{ kind: "output", text: text.split("\n").slice(-count).join("\n") }];
        }

        cmdWc(args, stdin) {
            const file = args.find((arg) => !arg.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "wc requires a readable file or piped input" }];
            const lines = text ? text.split("\n").length : 0;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            return [{ kind: "output", text: `${lines} ${words} ${text.length}${file ? ` ${file}` : ""}` }];
        }

        cmdGrep(args, stdin) {
            const flags = args.filter((a) => a.startsWith("-"));
            const positional = args.filter((a) => !a.startsWith("-"));
            const pattern = positional[0];
            const file = positional[1];
            if (!pattern) return [{ kind: "error", text: "grep requires a pattern" }];
            let text;
            if (file) {
                text = this.readFile(this.resolve(file));
                if (text === null) return [{ kind: "error", text: `No such file: ${file}` }];
            } else if (stdin != null) {
                text = stdin;
            } else {
                return [{ kind: "error", text: "grep needs a file or piped input" }];
            }
            const flagStr = flags.join("");
            const insensitive = flagStr.includes("i");
            const invert = flagStr.includes("v");
            const re = new RegExp(escapeRegExp(pattern), insensitive ? "i" : "");
            const matches = text.split("\n").filter((line) => {
                const m = re.test(line);
                return invert ? !m : m;
            });
            return [{ kind: "output", text: matches.join("\n") || `(no matches for '${pattern}')` }];
        }

        cmdSort(args, stdin) {
            const flags = args.filter((a) => a.startsWith("-")).join("");
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "sort requires a file or piped input" }];
            const lines = text.split("\n");
            lines.sort((a, b) => (flags.includes("n") ? Number(a) - Number(b) : a.localeCompare(b)));
            if (flags.includes("r")) lines.reverse();
            return [{ kind: "output", text: lines.join("\n") }];
        }

        cmdUniq(args, stdin) {
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "uniq requires a file or piped input" }];
            const out = [];
            let prev = null;
            for (const line of text.split("\n")) {
                if (line !== prev) out.push(line);
                prev = line;
            }
            return [{ kind: "output", text: out.join("\n") }];
        }

        cmdFind(args) {
            const startArg = args[0] && !args[0].startsWith("-") ? args[0] : ".";
            const startPath = this.resolve(startArg === "." ? "." : startArg);
            const nameIdx = args.indexOf("-name");
            const typeIdx = args.indexOf("-type");
            const pattern = nameIdx >= 0 ? args[nameIdx + 1] : null;
            const filterType = typeIdx >= 0 ? args[typeIdx + 1] : null;
            if ((nameIdx >= 0 && !pattern) || (typeIdx >= 0 && !filterType)) {
                return [{ kind: "error", text: "find -name <glob> or -type f|d expected" }];
            }
            const re = pattern ? new RegExp("^" + escapeRegExp(pattern).replace(/\\\*/g, ".*").replace(/\\\?/g, ".") + "$") : null;
            const matches = [];
            const visit = (path) => {
                const isDir = this.isDir(path);
                const name = this.basename(path) || "/";
                const typeMatch = !filterType || (filterType === "d" && isDir) || (filterType === "f" && !isDir);
                const nameMatch = !re || re.test(name);
                if (typeMatch && nameMatch && path !== startPath) matches.push(path.replace(startPath, "."));
                if (!isDir) return;
                for (const entry of this.entries(path, true)) {
                    visit((path === "/" ? "" : path) + "/" + entry.name);
                }
            };
            visit(startPath);
            return [{ kind: "output", text: matches.join("\n") || "(nothing found)" }];
        }

        cmdTree(args) {
            const startArg = args[0] || ".";
            const startPath = this.resolve(startArg);
            if (!this.isDir(startPath)) return [{ kind: "error", text: `tree: not a directory: ${startArg}` }];
            const lines = [this.basename(startPath) || "/"];
            const walk = (path, prefix, depth) => {
                if (depth > 4) return;
                const items = this.entries(path, false);
                items.forEach((entry, idx) => {
                    const last = idx === items.length - 1;
                    const tee = last ? "└── " : "├── ";
                    const marker = entry.type === "dir" ? "/" : entry.type === "exec" ? "*" : "";
                    lines.push(prefix + tee + entry.name + marker);
                    if (entry.type === "dir") {
                        walk(path + "/" + entry.name, prefix + (last ? "    " : "│   "), depth + 1);
                    }
                });
            };
            walk(startPath, "", 0);
            return [{ kind: "art", text: lines.join("\n") }];
        }

        cmdFile(args) {
            if (!args[0]) return [{ kind: "error", text: "file requires a path" }];
            const path = this.resolve(args[0]);
            const node = this.node(path);
            if (!node) return [{ kind: "error", text: `${args[0]}: no such file` }];
            const meta = this.world.encounters[path];
            if (this.isDir(path)) return [{ kind: "output", text: `${args[0]}: directory` }];
            if (meta) return [{ kind: "output", text: `${args[0]}: executable script (${meta.type || "encounter"})` }];
            const text = this.readFile(path) || "";
            const looksAscii = /[━╔╚║┃─│└┘┌┐]/.test(text) || /^\s*[!#@]/.test(text);
            return [{ kind: "output", text: `${args[0]}: ${looksAscii ? "ASCII art / scroll" : "text file"}` }];
        }

        cmdChmod(args) {
            if (args.length < 2) return [{ kind: "error", text: "chmod +x|-x <file>" }];
            const [mode, target] = args;
            const path = this.resolve(target);
            const node = this.state.userNodes[path];
            if (!node) return [{ kind: "error", text: "Web Bashcrawl chmod only changes session-created files." }];
            if (mode === "+x") {
                node.type = "exec";
                this.state.flags.chmod_x = true;
                return [{ kind: "success", text: `Marked ${target} as executable.` }];
            }
            if (mode === "-x") {
                node.type = "file";
                return [{ kind: "success", text: `Removed executable bit from ${target}.` }];
            }
            return [{ kind: "info", text: `chmod ${mode} ${target}: numeric modes are decorative in the web port.` }];
        }

        cmdMan(args) {
            const cmd = args[0];
            if (!cmd) return [{ kind: "info", text: "Usage: man <command>" }];
            const reference = (this.commands?.categories || {});
            for (const cat of Object.values(reference)) {
                const found = (cat.commands || []).find((entry) => entry.command === cmd || entry.command.startsWith(cmd + " "));
                if (found) {
                    return [{ kind: "info", text: `NAME\n    ${found.command}\n\nDESCRIPTION\n    ${found.description}` }];
                }
            }
            if (this.handlers[cmd]) return [{ kind: "info", text: `NAME\n    ${cmd}\n\nDESCRIPTION\n    Built-in for Bashcrawl Web. Try '${cmd} --help' or open Docs (F1).` }];
            return [{ kind: "error", text: `man: no entry for '${cmd}'` }];
        }

        cmdWhoami() {
            return [{ kind: "info", text: "adventurer  (you have walked these halls before...)" }];
        }

        cmdDate() {
            return [{ kind: "output", text: new Date().toString() }];
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

        cmdMap() {
            const here = this.state.cwd;
            const arrow = (path) => path === here ? " ← you are here" : "";
            const lines = [
                "  /entrance" + arrow("/entrance"),
                "  ├── cellar/" + arrow("/entrance/cellar"),
                "  │   └── armoury/" + arrow("/entrance/cellar/armoury"),
                "  │       ├── chamber/" + arrow("/entrance/cellar/armoury/chamber"),
                "  │       └── workshop/" + arrow("/entrance/cellar/armoury/workshop"),
                "  ├── scriptorium/" + arrow("/entrance/scriptorium"),
                "  │   └── observatory/" + arrow("/entrance/scriptorium/observatory"),
                "  └── .chapel/  (hidden — try ls -la)",
                "      └── courtyard/aviary/hall/library/.study/" + arrow("/entrance/.chapel/courtyard/aviary/hall/library/.study"),
            ];
            return [{ kind: "art", text: lines.join("\n") }];
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
            if (!q) return [{ kind: "success", text: "No quests left. Try `map`, `tree`, `cowsay hi`, or `./oracle` in /entrance/scriptorium." }];
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

        cmdFortune() {
            const text = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
            return [{ kind: "magic", text: `🥠  ${text}` }];
        }

        cmdCowsay(args, stdin) {
            const msg = (args.length ? args.join(" ") : stdin) || "Moo.";
            return [{ kind: "art", text: ART.cow(msg) }];
        }

        cmdFiglet(args) {
            const text = args.join(" ") || "BASHCRAWL";
            const upper = text.toUpperCase();
            return [{ kind: "art", text: upper.split("").map((c) => c).join(" ") + "\n" + "=".repeat(upper.length * 2) }];
        }

        cmdBanner() {
            return [{ kind: "art", text: ART.banner }];
        }

        cmdSl() {
            return [{ kind: "art", text: ART.sl + "\n     (Sometimes typos take you for a ride. Try `ls`.)" }];
        }

        cmdEcho(args) {
            return [{ kind: "output", text: args.join(" ").replace(/\$([A-Za-z_]\w*)/g, (_, key) => this.getVar(key)) }];
        }

        cmdExport(args) {
            const joined = args.join(" ");
            const idx = joined.indexOf("=");
            if (idx < 1) return [{ kind: "error", text: "Usage: export VAR=value" }];
            const key = joined.slice(0, idx).trim();
            const value = joined.slice(idx + 1).trim();
            this.setVar(key, value);
            return [{ kind: "success", text: `Exported ${key}=${value}` }];
        }

        cmdLet(args) {
            const expr = args.join(" ").replace(/^["']|["']$/g, "");
            const match = expr.match(/^([A-Za-z_]\w*)\s*=\s*\1\s*([+-])\s*(\d+)$/);
            if (!match) return [{ kind: "error", text: "Only simple VAR=VAR+N or VAR=VAR-N arithmetic is supported." }];
            const start = Number(this.getVar(match[1]) || 0);
            const next = match[2] === "+" ? start + Number(match[3]) : start - Number(match[3]);
            this.setVar(match[1], String(next));
            return [{ kind: "success", text: `${match[1]}=${next}` }];
        }

        cmdAlias(args) {
            if (!args.length) {
                const aliases = Object.entries(this.state.aliases);
                return [{ kind: "output", text: aliases.map(([k, v]) => `alias ${k}='${v}'`).join("\n") || "(no aliases)" }];
            }
            const joined = args.join(" ");
            const idx = joined.indexOf("=");
            if (idx < 1) return [{ kind: "error", text: "Usage: alias ll='ls -F'" }];
            const key = joined.slice(0, idx).trim();
            const value = joined.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
            this.state.aliases[key] = value;
            return [{ kind: "success", text: `Alias set: ${key}='${value}'` }];
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

        cmdMkdir(args) {
            if (!args[0]) return [{ kind: "error", text: "mkdir requires a name" }];
            const path = this.resolve(args[0]);
            if (this.node(path)) return [{ kind: "error", text: `Already exists: ${args[0]}` }];
            this.state.userNodes[path] = { type: "dir" };
            return [{ kind: "success", text: `Created directory ${args[0]}` }];
        }

        cmdTouch(args) {
            if (!args[0]) return [{ kind: "error", text: "touch requires a file" }];
            const path = this.resolve(args[0]);
            if (!this.node(path)) this.state.userNodes[path] = { type: "file", content: "" };
            return [{ kind: "success", text: `Touched ${args[0]}` }];
        }

        cmdCp(args) {
            if (args.length < 2) return [{ kind: "error", text: "cp requires source and destination" }];
            const src = this.resolve(args[0]);
            const dst = this.resolve(args[1]);
            const text = this.readFile(src);
            if (text === null) return [{ kind: "error", text: `No such file: ${args[0]}` }];
            this.state.userNodes[dst] = { type: "file", content: text };
            return [{ kind: "success", text: `Copied ${args[0]} to ${args[1]}` }];
        }

        cmdMv(args) {
            if (args.length < 2) return [{ kind: "error", text: "mv requires source and destination" }];
            const src = this.resolve(args[0]);
            const dst = this.resolve(args[1]);
            const node = this.state.userNodes[src];
            if (!node) return [{ kind: "error", text: "Web Bashcrawl only moves files you created in this session." }];
            this.state.userNodes[dst] = node;
            delete this.state.userNodes[src];
            return [{ kind: "success", text: `Moved ${args[0]} to ${args[1]}` }];
        }

        cmdRm(args) {
            if (!args[0]) return [{ kind: "error", text: "rm requires a file" }];
            const path = this.resolve(args[0]);
            if (!this.state.userNodes[path]) return [{ kind: "error", text: "Only session-created files can be removed in Web Bashcrawl." }];
            delete this.state.userNodes[path];
            return [{ kind: "success", text: `Removed ${args[0]}` }];
        }

        cmdHistory() {
            return [{ kind: "output", text: this.state.history.map((cmd, i) => `${i + 1}  ${cmd}`).join("\n") || "(empty)" }];
        }

        cmdClear() {
            return [{ kind: "control", action: "clear" }];
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
                return [{ kind: "output", text: btoa(JSON.stringify(this.state)) }];
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
            if (portrait) messages.unshift(portrait);
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

        completions(text) {
            const tokens = tokenize(text);
            const last = tokens.length ? tokens[tokens.length - 1] : "";
            if (!tokens.length || (tokens.length === 1 && !text.endsWith(" "))) {
                return Object.keys(this.handlers).filter((cmd) => cmd.startsWith(last));
            }
            return this.entries(this.state.cwd, true).map((entry) => entry.name).filter((name) => name.startsWith(last));
        }
    }

    global.BashcrawlRuntime = { Runtime, defaultState, tokenize };
})(window);
