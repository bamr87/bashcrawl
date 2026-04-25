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
                "save": this.cmdSave,
                "reset": this.cmdReset,
            };
        }

        execute(line) {
            const expanded = this.applyAlias(line.trim());
            const tokens = tokenize(expanded);
            if (!tokens.length) return [];
            const cmd = tokens[0];
            const args = tokens.slice(1);
            this.bump(cmd);

            let output;
            if (cmd.startsWith("./")) {
                output = this.runScript(cmd.slice(2));
            } else {
                const handler = this.handlers[cmd];
                output = handler ? handler.call(this, args) : [{ kind: "error", text: `Unknown command: ${cmd}. Try help.` }];
            }
            this.advanceQuests(cmd, args);
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
            return [{ kind: "info", text: "Open the Docs panel with F1 or the Docs button. Try: pwd, ls -F, cat scroll, cd cellar." }];
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

        cmdHead(args) {
            const countIndex = args.indexOf("-n");
            const count = countIndex >= 0 ? Number(args[countIndex + 1]) || 10 : 10;
            const file = args.find((arg, index) => arg !== "-n" && index !== countIndex + 1);
            const text = this.readFile(this.resolve(file || ""));
            if (text === null) return [{ kind: "error", text: "head requires a readable file" }];
            return [{ kind: "output", text: text.split("\n").slice(0, count).join("\n") }];
        }

        cmdTail(args) {
            const countIndex = args.indexOf("-n");
            const count = countIndex >= 0 ? Number(args[countIndex + 1]) || 10 : 10;
            const file = args.find((arg, index) => arg !== "-n" && index !== countIndex + 1);
            const text = this.readFile(this.resolve(file || ""));
            if (text === null) return [{ kind: "error", text: "tail requires a readable file" }];
            return [{ kind: "output", text: text.split("\n").slice(-count).join("\n") }];
        }

        cmdWc(args) {
            const file = args.find((arg) => !arg.startsWith("-"));
            const text = this.readFile(this.resolve(file || ""));
            if (text === null) return [{ kind: "error", text: "wc requires a readable file" }];
            const lines = text ? text.split("\n").length : 0;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            return [{ kind: "output", text: `${lines} ${words} ${text.length} ${file}` }];
        }

        cmdGrep(args) {
            if (args.length < 2) return [{ kind: "error", text: "grep requires a pattern and file" }];
            const [pattern, file] = args;
            const text = this.readFile(this.resolve(file));
            if (text === null) return [{ kind: "error", text: `No such file: ${file}` }];
            const re = new RegExp(escapeRegExp(pattern), "i");
            const matches = text.split("\n").filter((line) => re.test(line));
            return [{ kind: "output", text: matches.join("\n") || `(no matches for '${pattern}')` }];
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
            if (encounter.heals) this.state.hp = Math.min(100, Number(encounter.heals));
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

        advanceQuests(cmd, args) {
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
