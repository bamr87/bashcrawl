(function initRuntime(global) {
    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function tokenize(line) {
        return tokenizeDetailed(line).map((t) => t.text);
    }

    // Quote-aware tokenizer: keeps whether each token was quoted, so glob
    // expansion can skip quoted patterns ('*.txt' stays literal, *.txt expands)
    // exactly like a real shell.
    function tokenizeDetailed(line) {
        const tokens = [];
        const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
        let match;
        while ((match = re.exec(line))) {
            if (match[1] != null) tokens.push({ text: match[1], quoted: true });
            else if (match[2] != null) tokens.push({ text: match[2], quoted: true });
            else {
                // Bare token: strip embedded quoted segments (-d',' -> -d,) and
                // mark it quoted so glob expansion leaves it literal.
                const stripped = match[3].replace(/'([^']*)'/g, "$1").replace(/"([^"]*)"/g, "$1");
                tokens.push({ text: stripped, quoted: stripped !== match[3] });
            }
        }
        return tokens;
    }

    // Split a command line at its first unquoted `>` / `>>` output redirection.
    // Returns { core, redirect, missingTarget, trailingText } where redirect =
    // { path, append } or null.
    function splitRedirect(line) {
        // Pass 1: excise fd-prefixed and duplication redirects (`2>/dev/null`,
        // `2>&1`, `1>&2`, `>&2`). The emulator has no stderr stream, so these
        // are no-ops; the rest of the line stays live.
        let quote = null;
        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (quote) {
                if (ch === quote) quote = null;
                continue;
            }
            if (ch === "'" || ch === "\"") { quote = ch; continue; }
            if (ch !== ">") continue;
            // An fd spec is a digit immediately before `>` standing as its own
            // word (`ls 2>x`), not a digit ending a filename (`sort x2>y`).
            const isFd = /\d/.test(line[i - 1] || "") && (i < 2 || /\s/.test(line[i - 2]));
            const start = isFd ? i - 1 : i;
            let j = i + 1;
            if (line[j] === ">") j += 1;
            while (j < line.length && /\s/.test(line[j])) j += 1;
            let k = j;
            while (k < line.length && !/\s/.test(line[k])) k += 1;
            const target = line.slice(j, k);
            if ((isFd && line[i - 1] === "2") || target.startsWith("&")) {
                line = line.slice(0, start) + line.slice(k);
                i = start - 1;
                continue;
            }
            i = k - 1; // real stdout redirect: leave it for pass 2
        }
        // Pass 2: split at the first `>` / `>>` that survived pass 1.
        quote = null;
        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (quote) {
                if (ch === quote) quote = null;
                continue;
            }
            if (ch === "'" || ch === "\"") { quote = ch; continue; }
            if (ch !== ">") continue;
            const isFd = /\d/.test(line[i - 1] || "") && (i < 2 || /\s/.test(line[i - 2]));
            const start = isFd ? i - 1 : i;
            const append = line[i + 1] === ">";
            const after = line.slice(i + (append ? 2 : 1)).trim();
            const words = after ? after.split(/\s+/) : [];
            return {
                core: line.slice(0, start).trim(),
                redirect: words.length ? { path: words[0], append } : null,
                missingTarget: !words.length,
                trailingText: words.length > 1,
            };
        }
        return { core: line, redirect: null, missingTarget: false, trailingText: false };
    }

    // Parse head/tail line-count flags: `-n N`, attached `-nN`, and classic
    // `-N`. Returns { count, file } with the first non-flag arg as the file.
    function parseLineCount(args) {
        let count = 10;
        let file = null;
        for (let i = 0; i < args.length; i += 1) {
            const a = args[i];
            if (a === "-n") { count = Number(args[++i]) || 10; continue; }
            const m = a.match(/^-n?(\d+)$/);
            if (m) { count = Number(m[1]); continue; }
            if (!a.startsWith("-") && file == null) file = a;
        }
        return { count, file };
    }

    // Parse a cut(1)-style list ("1,3", "2-4", "3-") into [lo, hi] ranges.
    function parseRangeList(spec) {
        if (!spec) return null;
        const ranges = [];
        for (const part of String(spec).split(",")) {
            const m = part.match(/^(\d+)?(-)?(\d+)?$/);
            if (!m || (!m[1] && !m[3])) return null;
            const lo = m[1] ? Number(m[1]) : 1;
            const hi = m[2] ? (m[3] ? Number(m[3]) : Infinity) : lo;
            if (lo < 1 || hi < lo) return null;
            ranges.push([lo, hi]);
        }
        return ranges;
    }

    // Expand a tr(1) set ("a-z", "A-Za-z0-9") into an array of characters.
    function expandTrSet(spec) {
        const chars = [];
        for (let i = 0; i < spec.length; i += 1) {
            if (spec[i + 1] === "-" && spec[i + 2] && spec[i + 2] !== "-") {
                const lo = spec.charCodeAt(i);
                const hi = spec.charCodeAt(i + 2);
                for (let c = lo; c <= hi; c += 1) chars.push(String.fromCharCode(c));
                i += 2;
            } else {
                chars.push(spec[i]);
            }
        }
        return chars;
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

    // Local-day helpers for the Daily Challenge (browser Date is fine here).
    function isoDay(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }
    function todayStr() { return isoDay(new Date()); }
    function yesterdayStr() { return isoDay(new Date(Date.now() - 86400000)); }
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
                cut: this.cmdCut,
                tr: this.cmdTr,
                sed: this.cmdSed,
                nl: this.cmdNl,
                rev: this.cmdRev,
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
        }

        execute(line) {
            // Bare/scoped mode (Practice Arcade sandboxes): no dailies, badges,
            // rank-ups, or trainer forks — just the pipeline.
            if (this.bare) return this.runPipeline(line);
            this.refreshDaily();
            // While the Training Arena is active, every line is an answer, not a command.
            const out = (this.state.trainer && this.state.trainer.active)
                ? this.trainerInput(line)
                : this.runPipeline(line);
            // Achievements first (they award XP), then daily, then rank-up (reads final XP).
            const extra = this.checkAchievements().concat(this.checkDaily()).concat(this.checkRankUp());
            return extra.length ? out.concat(extra) : out;
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

        runPipeline(line) {
            // `cmd > file` / `cmd >> file`: capture the pipeline's stdout into a
            // player-created file instead of the log — real shell redirection.
            const { core, redirect, missingTarget, trailingText } = splitRedirect(line.trim());
            if (missingTarget) return [{ kind: "error", text: "syntax error: expected a filename after >" }];
            if (trailingText) return [{ kind: "error", text: "syntax error: unexpected text after > FILE" }];
            const segments = splitPipes(core);
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
            if (redirect && !collected.some((r) => r.kind === "error")) {
                const text = collected
                    .filter((r) => !r.action)
                    .map((r) => r.text || "")
                    .join("\n");
                const failure = this.writeFile(redirect.path, text, redirect.append);
                if (failure) return [failure];
                const lineCount = text ? text.split("\n").length : 0;
                return [{ kind: "dim", text: `(${redirect.append ? "appended" : "wrote"} ${lineCount} line${lineCount === 1 ? "" : "s"} to ${redirect.path})` }];
            }
            // Path-Finder watches normal play: count moves, detect arrival.
            if (this.state.pathfind && this.state.pathfind.active) {
                collected.push(...this.pathfindObserve(line));
            }
            return collected;
        }

        // Persist text into a player-visible file (userNodes overlay; shadows a
        // same-named world file, mirroring a real overwrite).
        writeFile(rawPath, text, append) {
            const path = this.resolve(rawPath);
            if (this.isDir(path)) return { kind: "error", text: `cannot write to ${rawPath}: is a directory` };
            const parent = this.parentPath(path);
            if (!this.isDir(parent)) return { kind: "error", text: `cannot write to ${rawPath}: no such directory` };
            let content = text;
            if (append) {
                const prev = this.readFile(path);
                if (prev) content = prev.replace(/\n$/, "") + "\n" + text;
            }
            this.state.userNodes[path] = { type: "file", content };
            return null;
        }

        // Expand an unquoted glob pattern against the directory it points into.
        // Returns matched names (dir prefix preserved), or [] when nothing matches
        // (caller keeps the literal token, like bash without nullglob).
        expandGlob(pattern) {
            const slash = pattern.lastIndexOf("/");
            const dirRaw = slash >= 0 ? pattern.slice(0, slash + 1) : "";
            const nameRaw = slash >= 0 ? pattern.slice(slash + 1) : pattern;
            if (!nameRaw || !/[*?]/.test(nameRaw)) return [];
            const dirPath = slash >= 0 ? this.resolve(dirRaw || "/") : this.state.cwd;
            if (!this.isDir(dirPath)) return [];
            const re = new RegExp(
                "^" + escapeRegExp(nameRaw).replace(/\\\*/g, "[^/]*").replace(/\\\?/g, "[^/]") + "$"
            );
            return this.entries(dirPath, nameRaw.startsWith("."))
                .map((entry) => entry.name)
                .filter((name) => re.test(name))
                .sort()
                .map((name) => dirRaw + name);
        }

        executeSegment(segment, stdin) {
            const expanded = this.applyAlias(segment.trim());
            const detailed = tokenizeDetailed(expanded);
            if (!detailed.length) return [];
            const cmd = detailed[0].text;
            // Glob expansion: unquoted * / ? args expand against the filesystem;
            // quoted patterns stay literal (teaches why `find -name "*.txt"`
            // needs those quotes).
            const args = [];
            for (let i = 1; i < detailed.length; i += 1) {
                const token = detailed[i];
                if (!token.quoted && !token.text.startsWith("-") && /[*?]/.test(token.text)) {
                    const matches = this.expandGlob(token.text);
                    if (matches.length) {
                        args.push(...matches);
                        continue;
                    }
                }
                args.push(token.text);
            }
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
            // Player-written files shadow shipped world files (a `>` redirect onto
            // an existing file overwrites it, exactly like a real filesystem).
            const node = this.state.userNodes[path];
            if (node && node.type === "file") return node.content || "";
            const real = this.actual(path);
            if (Object.prototype.hasOwnProperty.call(this.world.files, real)) return this.world.files[real];
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
            const today = todayStr();
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
            d.streak = (d.lastDate === yesterdayStr()) ? d.streak + 1 : 1;
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
            // `cd -` bounces back to the previous room, printing it like bash.
            if (args[0] === "-") {
                const prev = this.state.prevCwd;
                if (!prev) return [{ kind: "error", text: "cd: OLDPWD not set" }];
                if (!this.isDir(prev)) return [{ kind: "error", text: `Not a directory: ${prev}` }];
                this.state.prevCwd = this.state.cwd;
                this.state.cwd = prev;
                return [{ kind: "output", text: prev }, { kind: "success", text: `Moved to ${prev}` }];
            }
            const next = this.resolve(args[0] || this.world.root);
            if (!this.isDir(next)) return [{ kind: "error", text: `Not a directory: ${args[0] || next}` }];
            this.state.prevCwd = this.state.cwd;
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
            const { count, file } = parseLineCount(args);
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "head requires a readable file or piped input" }];
            return [{ kind: "output", text: text.split("\n").slice(0, count).join("\n") }];
        }

        cmdTail(args, stdin) {
            const { count, file } = parseLineCount(args);
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "tail requires a readable file or piped input" }];
            return [{ kind: "output", text: count > 0 ? text.split("\n").slice(-count).join("\n") : "" }];
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
            const flags = args.filter((a) => a.startsWith("-") && a.length > 1);
            const positional = args.filter((a) => !a.startsWith("-") || a === "-");
            const pattern = positional[0];
            let files = positional.slice(1);
            if (!pattern) return [{ kind: "error", text: "grep requires a pattern. Usage: grep [-rilnvc] PATTERN [FILE...]" }];
            const flagStr = flags.join("").replace(/-/g, "");
            const insensitive = flagStr.includes("i");
            const invert = flagStr.includes("v");
            const recursive = flagStr.includes("r") || flagStr.includes("R");
            const namesOnly = flagStr.includes("l");
            const countOnly = flagStr.includes("c");
            const numbered = flagStr.includes("n");
            const wordMatch = flagStr.includes("w");
            // Real grep patterns are regular expressions. Try the pattern as a
            // regex first; fall back to a literal match if it doesn't compile.
            let re;
            const body = wordMatch ? `\\b(?:${pattern})\\b` : pattern;
            try {
                re = new RegExp(body, insensitive ? "i" : "");
            } catch (err) {
                re = new RegExp(wordMatch ? `\\b${escapeRegExp(pattern)}\\b` : escapeRegExp(pattern), insensitive ? "i" : "");
            }
            if (recursive) {
                const roots = files.length ? files : ["."];
                files = [];
                const walk = (path, label) => {
                    if (this.isDir(path)) {
                        // Real grep -r searches dotfiles too (it only skips . and ..).
                        for (const entry of this.entries(path, true)) {
                            walk(`${path === "/" ? "" : path}/${entry.name}`, `${label}/${entry.name}`);
                        }
                    } else if (this.readFile(path) !== null) {
                        files.push(label);
                    }
                };
                for (const root of roots) walk(this.resolve(root), root.replace(/\/$/, ""));
            }
            const showName = files.length > 1 || recursive;
            const out = [];
            let anyMatch = false;
            const scan = (text, label) => {
                let count = 0;
                const lines = [];
                text.split("\n").forEach((lineText, idx) => {
                    const hit = re.test(lineText);
                    if (invert ? !hit : hit) {
                        count += 1;
                        lines.push(`${showName ? `${label}:` : ""}${numbered ? `${idx + 1}:` : ""}${lineText}`);
                    }
                });
                if (count > 0) anyMatch = true;
                if (namesOnly) {
                    if (count > 0) out.push(label);
                } else if (countOnly) {
                    out.push(`${showName ? `${label}:` : ""}${count}`);
                } else {
                    out.push(...lines);
                }
            };
            if (files.length) {
                for (const file of files) {
                    // grep FILE convention: a lone '-' means read the pipe (stdin).
                    if (file === "-") {
                        if (stdin == null) return [{ kind: "error", text: "grep: -: no piped input" }];
                        scan(stdin, "(stdin)");
                        continue;
                    }
                    const path = this.resolve(file);
                    if (this.isDir(path)) {
                        out.push(`grep: ${file}: is a directory`);
                        continue;
                    }
                    const text = this.readFile(path);
                    if (text === null) return [{ kind: "error", text: `grep: ${file}: no such file` }];
                    scan(text, file);
                }
            } else if (stdin != null) {
                scan(stdin, "(stdin)");
            } else {
                return [{ kind: "error", text: "grep needs a file or piped input. Usage: grep [-rilnvc] PATTERN [FILE...]" }];
            }
            if (!anyMatch && !countOnly) {
                return [{ kind: "output", text: `(no matches for '${pattern}')` }];
            }
            return [{ kind: "output", text: out.join("\n") }];
        }

        cmdSort(args, stdin) {
            const flags = args.filter((a) => a.startsWith("-")).join("");
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "sort requires a file or piped input" }];
            let lines = text.split("\n");
            // -n keys off the leading number like real sort(1); non-numeric = 0.
            const numKey = (s) => { const n = parseFloat(s.trimStart()); return Number.isNaN(n) ? 0 : n; };
            lines.sort((a, b) => (flags.includes("n") ? numKey(a) - numKey(b) : a.localeCompare(b)));
            if (flags.includes("r")) lines.reverse();
            if (flags.includes("u")) {
                const seen = new Set();
                lines = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
            }
            return [{ kind: "output", text: lines.join("\n") }];
        }

        cmdUniq(args, stdin) {
            const flags = args.filter((a) => a.startsWith("-")).join("");
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "uniq requires a file or piped input" }];
            const counting = flags.includes("c");
            const dupesOnly = flags.includes("d");
            const groups = [];
            for (const line of text.split("\n")) {
                const last = groups[groups.length - 1];
                if (last && last.line === line) last.count += 1;
                else groups.push({ line, count: 1 });
            }
            const out = groups
                .filter((g) => (dupesOnly ? g.count > 1 : true))
                .map((g) => (counting ? `${String(g.count).padStart(7)} ${g.line}` : g.line));
            return [{ kind: "output", text: out.join("\n") }];
        }

        // cut -d DELIM -f LIST  |  cut -c LIST  — extract fields or characters.
        cmdCut(args, stdin) {
            let delim = "\t";
            let fieldSpec = null;
            let charSpec = null;
            const files = [];
            for (let i = 0; i < args.length; i += 1) {
                const a = args[i];
                if (a === "-d") delim = args[++i] ?? "\t";
                else if (a.startsWith("-d") && a.length > 2) delim = a.slice(2);
                else if (a === "-f") fieldSpec = args[++i];
                else if (a.startsWith("-f") && a.length > 2) fieldSpec = a.slice(2);
                else if (a === "-c") charSpec = args[++i];
                else if (a.startsWith("-c") && a.length > 2) charSpec = a.slice(2);
                else if (!a.startsWith("-")) files.push(a);
            }
            if (!fieldSpec && !charSpec) {
                return [{ kind: "error", text: "cut requires -f LIST (with -d DELIM) or -c LIST" }];
            }
            const text = files[0] ? this.readFile(this.resolve(files[0])) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "cut requires a file or piped input" }];
            const wants = parseRangeList(fieldSpec || charSpec);
            if (!wants) return [{ kind: "error", text: `cut: invalid list: ${fieldSpec || charSpec}` }];
            const out = text.split("\n").map((line) => {
                if (charSpec) {
                    return wants.map(([lo, hi]) => line.slice(lo - 1, hi === Infinity ? undefined : hi)).join("");
                }
                const parts = line.split(delim);
                if (parts.length === 1) return line; // no delimiter: pass through, like real cut
                const picked = [];
                wants.forEach(([lo, hi]) => {
                    for (let f = lo; f <= Math.min(hi, parts.length); f += 1) picked.push(parts[f - 1]);
                });
                return picked.join(delim);
            });
            return [{ kind: "output", text: out.join("\n") }];
        }

        // tr SET1 SET2 (translate) | tr -d SET1 (delete). Supports a-z ranges.
        cmdTr(args, stdin) {
            if (stdin == null) return [{ kind: "error", text: "tr reads piped input. Try: cat file | tr a-z A-Z" }];
            const del = args[0] === "-d";
            const squeeze = args[0] === "-s";
            const sets = args.filter((a) => a !== "-d" && a !== "-s");
            const set1 = expandTrSet(sets[0] || "");
            if (!set1.length) return [{ kind: "error", text: "tr requires a character set. Usage: tr SET1 SET2 | tr -d SET1" }];
            if (del) {
                const drop = new Set(set1);
                return [{ kind: "output", text: [...stdin].filter((ch) => !drop.has(ch)).join("") }];
            }
            if (squeeze) {
                const squeezeSet = new Set(set1);
                let prev = null;
                const kept = [...stdin].filter((ch) => {
                    const dup = ch === prev && squeezeSet.has(ch);
                    prev = ch;
                    return !dup;
                });
                return [{ kind: "output", text: kept.join("") }];
            }
            const set2 = expandTrSet(sets[1] || "");
            if (!set2.length) return [{ kind: "error", text: "tr requires two sets. Usage: tr SET1 SET2" }];
            const map = new Map();
            set1.forEach((ch, i) => map.set(ch, set2[Math.min(i, set2.length - 1)]));
            return [{ kind: "output", text: [...stdin].map((ch) => map.get(ch) ?? ch).join("") }];
        }

        // sed 's/pattern/replacement/[g]' — the classic substitute, on files or stdin.
        cmdSed(args, stdin) {
            const expr = args.find((a) => !a.startsWith("-"));
            const file = args.filter((a) => !a.startsWith("-"))[1];
            const m = expr && expr.match(/^s(.)((?:\\.|[^\\])*?)\1((?:\\.|[^\\])*?)\1([gi]*)$/);
            if (!m) return [{ kind: "error", text: "sed supports substitution: sed 's/pattern/replacement/g'" }];
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "sed requires a file or piped input" }];
            const caseFlag = m[4].includes("i") ? "i" : "";
            let re;
            try {
                re = new RegExp(m[2], caseFlag);
            } catch (err) {
                re = new RegExp(escapeRegExp(m[2].replace(/\\(.)/g, "$1")), caseFlag);
            }
            const global = m[4].includes("g");
            // Escape `$` so JS replace metacharacters ($&, $1) stay literal like sed.
            const replacement = m[3].replace(/\\(.)/g, "$1").replace(/\$/g, "$$$$");
            const out = text.split("\n").map((line) => (
                global
                    ? line.replace(new RegExp(re.source, re.flags + "g"), replacement)
                    : line.replace(re, replacement)
            ));
            return [{ kind: "output", text: out.join("\n") }];
        }

        // nl — number lines (handy inside pipelines).
        cmdNl(args, stdin) {
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "nl requires a file or piped input" }];
            const out = text.split("\n").map((line, i) => `${String(i + 1).padStart(6)}  ${line}`);
            return [{ kind: "output", text: out.join("\n") }];
        }

        // rev — reverse each line of input.
        cmdRev(args, stdin) {
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "rev requires a file or piped input" }];
            const out = text.split("\n").map((line) => [...line].reverse().join(""));
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
            // Expand $NAME / ${NAME} in the value like a real shell, so
            // `export I=amulet,$I` accumulates inventory instead of storing "$I".
            const value = joined.slice(idx + 1).trim()
                .replace(/\$\{(\w+)\}|\$([A-Za-z_]\w*)/g, (_, braced, bare) => this.getVar(braced || bare));
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
            const eff = args.filter((a) => !a.startsWith("-"));
            if (eff.length < 2) return [{ kind: "error", text: "cp requires source and destination" }];
            if (eff.length > 2) return [{ kind: "error", text: "cp: too many arguments (glob matched several files?)" }];
            const src = this.resolve(eff[0]);
            const dst = this.resolve(eff[1]);
            const text = this.readFile(src);
            if (text === null) return [{ kind: "error", text: `No such file: ${eff[0]}` }];
            this.state.userNodes[dst] = { type: "file", content: text };
            return [{ kind: "success", text: `Copied ${eff[0]} to ${eff[1]}` }];
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
            const userNode = this.state.userNodes[path];
            const worldFile = Object.prototype.hasOwnProperty.call(this.world.files, this.actual(path));
            if (userNode) {
                delete this.state.userNodes[path];
                // A `>` overwrite of a shipped file only shadows it; rm peels
                // the shadow off and the original shows through again.
                if (worldFile) return [{ kind: "dim", text: `Removed your written copy of ${args[0]} — the original remains.` }];
                return [{ kind: "success", text: `Removed ${args[0]}` }];
            }
            if (worldFile) return [{ kind: "error", text: `rm: cannot remove '${args[0]}': the dungeon's own files are indestructible` }];
            return [{ kind: "error", text: "Only session-created files can be removed in Web Bashcrawl." }];
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
