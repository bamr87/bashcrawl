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
            };
        }

        execute(line) {
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

        basename(path) {
            return path.split("/").filter(Boolean).pop() || "";
        }

        node(path) {
            if (this.world.directories[path]) return { type: "dir" };
            if (Object.prototype.hasOwnProperty.call(this.world.files, path)) return { type: "file" };
            return this.state.userNodes[path] || null;
        }

        isDir(path) {
            return Boolean(this.world.directories[path] || this.state.userNodes[path]?.type === "dir");
        }

        readFile(path) {
            if (Object.prototype.hasOwnProperty.call(this.world.files, path)) return this.world.files[path];
            const node = this.state.userNodes[path];
            if (node && node.type === "file") return node.content || "";
            return null;
        }

        entries(path, showHidden = false) {
            const base = this.world.directories[path] || [];
            const result = base.filter((entry) => showHidden || !entry.hidden).map((entry) => ({ ...entry }));
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
            return this.world.rooms[this.state.cwd] || {};
        }

        cmdHelp() {
            return [
                { kind: "info", text: "Open the Docs panel with F1 (or click Docs)." },
                { kind: "dim", text: "Try:  pwd | ls -F | cat scroll | cd cellar | tree | map | hint | cowsay hi | ./oracle" },
            ];
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
            for (const item of encounter.grants_items || []) {
                if (!this.state.inventory.includes(item)) this.state.inventory.push(item);
            }
            if (encounter.damage) this.state.hp = Math.max(0, this.state.hp - Number(encounter.damage));
            if (encounter.heals) this.state.hp = Math.min(100, this.state.hp + Number(encounter.heals));
            this.state.flags[encounter.key] = true;
            if ((encounter.grants_items || []).length) {
                messages.push({ kind: "success", text: `Inventory gained: ${encounter.grants_items.join(", ")}` });
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
