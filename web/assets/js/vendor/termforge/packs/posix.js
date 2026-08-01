(function (global, factory) {
    "use strict";
    const hasCjs = typeof module !== "undefined" && module.exports && typeof require === "function";
    const deps = hasCjs ? { parser: require("../parser.js") } : { parser: global.TermForge.parser };
    const api = factory(deps);
    if (hasCjs) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.packs = global.TermForge.packs || {};
        global.TermForge.packs.posix = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
    "use strict";
    // TermForge POSIX command pack — the portable teaching subset of the
    // classic Unix toolset, operating on the Shell's VFS. Every function is
    // unbound, invoked as fn.call(shell, args, stdin), and returns Line[].
    // Bodies are extracted verbatim from the bashcrawl web emulator.

    const { escapeRegExp, parseLineCount, parseRangeList, expandTrSet } = deps.parser;

    const commands = {
        pwd() {
            return [{ kind: "output", text: this.state.cwd }];
        },

        ls(args) {
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
        },

        cd(args) {
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
        },

        cat(args) {
            const path = this.resolve(args[0] || "");
            if (!args[0]) return [{ kind: "error", text: "cat requires a file path" }];
            const text = this.readFile(path);
            if (text === null) return [{ kind: "error", text: `No such file: ${args[0]}` }];
            return [{ kind: "output", text }];
        },

        head(args, stdin) {
            const { count, file } = parseLineCount(args);
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "head requires a readable file or piped input" }];
            return [{ kind: "output", text: text.split("\n").slice(0, count).join("\n") }];
        },

        tail(args, stdin) {
            const { count, file } = parseLineCount(args);
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "tail requires a readable file or piped input" }];
            return [{ kind: "output", text: count > 0 ? text.split("\n").slice(-count).join("\n") : "" }];
        },

        wc(args, stdin) {
            const file = args.find((arg) => !arg.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "wc requires a readable file or piped input" }];
            const lines = text ? text.split("\n").length : 0;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            return [{ kind: "output", text: `${lines} ${words} ${text.length}${file ? ` ${file}` : ""}` }];
        },

        grep(args, stdin) {
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
        },

        sort(args, stdin) {
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
        },

        uniq(args, stdin) {
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
        },

        // cut -d DELIM -f LIST  |  cut -c LIST  — extract fields or characters.
        cut(args, stdin) {
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
        },

        // tr SET1 SET2 (translate) | tr -d SET1 (delete). Supports a-z ranges.
        tr(args, stdin) {
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
        },

        // sed 's/pattern/replacement/[g]' — the classic substitute, on files or stdin.
        sed(args, stdin) {
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
        },

        // nl — number lines (handy inside pipelines).
        nl(args, stdin) {
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "nl requires a file or piped input" }];
            const out = text.split("\n").map((line, i) => `${String(i + 1).padStart(6)}  ${line}`);
            return [{ kind: "output", text: out.join("\n") }];
        },

        // rev — reverse each line of input.
        rev(args, stdin) {
            const file = args.find((a) => !a.startsWith("-"));
            const text = file ? this.readFile(this.resolve(file)) : (stdin != null ? stdin : null);
            if (text === null) return [{ kind: "error", text: "rev requires a file or piped input" }];
            const out = text.split("\n").map((line) => [...line].reverse().join(""));
            return [{ kind: "output", text: out.join("\n") }];
        },

        find(args) {
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
        },

        tree(args) {
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
        },

        file(args) {
            if (!args[0]) return [{ kind: "error", text: "file requires a path" }];
            const path = this.resolve(args[0]);
            const node = this.node(path);
            if (!node) return [{ kind: "error", text: `${args[0]}: no such file` }];
            const meta = (this.world.encounters || {})[path];
            if (this.isDir(path)) return [{ kind: "output", text: `${args[0]}: directory` }];
            if (meta) return [{ kind: "output", text: `${args[0]}: executable script (${meta.type || "encounter"})` }];
            const text = this.readFile(path) || "";
            const looksAscii = /[━╔╚║┃─│└┘┌┐]/.test(text) || /^\s*[!#@]/.test(text);
            return [{ kind: "output", text: `${args[0]}: ${looksAscii ? "ASCII art / scroll" : "text file"}` }];
        },

        chmod(args) {
            if (args.length < 2) return [{ kind: "error", text: "chmod +x|-x <file>" }];
            const [mode, target] = args;
            const path = this.resolve(target);
            const node = this.state.userNodes[path];
            if (!node) return [{ kind: "error", text: "Web Bashcrawl chmod only changes session-created files." }];
            if (mode === "+x") {
                node.type = "exec";
                return [{ kind: "success", text: `Marked ${target} as executable.` }];
            }
            if (mode === "-x") {
                node.type = "file";
                return [{ kind: "success", text: `Removed executable bit from ${target}.` }];
            }
            return [{ kind: "info", text: `chmod ${mode} ${target}: numeric modes are decorative in the web port.` }];
        },

        man(args) {
            const cmd = args[0];
            if (!cmd) return [{ kind: "info", text: "Usage: man <command>" }];
            const reference = (this.commands?.categories || {});
            for (const cat of Object.values(reference)) {
                const found = (cat.commands || []).find((entry) => entry.command === cmd || entry.command.startsWith(cmd + " "));
                if (found) {
                    return [{ kind: "info", text: `NAME\n    ${found.command}\n\nDESCRIPTION\n    ${found.description}` }];
                }
            }
            if (this.handlers[cmd]) return [{ kind: "info", text: `NAME\n    ${cmd}\n\nDESCRIPTION\n    ${this.manBuiltinNote(cmd)}` }];
            return [{ kind: "error", text: `man: no entry for '${cmd}'` }];
        },

        date() {
            return [{ kind: "output", text: new Date(this.clock.now()).toString() }];
        },

        env() {
            const lines = Object.entries(this.state.envVars).map(([k, v]) => `${k}=${v}`);
            return [{ kind: "output", text: lines.join("\n") || "(empty environment)" }];
        },

        echo(args) {
            return [{ kind: "output", text: args.join(" ").replace(/\$([A-Za-z_]\w*)/g, (_, key) => this.getVar(key)) }];
        },

        export(args) {
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
        },

        let(args) {
            const expr = args.join(" ").replace(/^["']|["']$/g, "");
            const match = expr.match(/^([A-Za-z_]\w*)\s*=\s*\1\s*([+-])\s*(\d+)$/);
            if (!match) return [{ kind: "error", text: "Only simple VAR=VAR+N or VAR=VAR-N arithmetic is supported." }];
            const start = Number(this.getVar(match[1]) || 0);
            const next = match[2] === "+" ? start + Number(match[3]) : start - Number(match[3]);
            this.setVar(match[1], String(next));
            return [{ kind: "success", text: `${match[1]}=${next}` }];
        },

        alias(args) {
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
        },

        source(args) {
            if (!args[0]) return [{ kind: "error", text: "Usage: source <file>" }];
            const raw = args[0].replace(/^\.\//, "");
            const path = this.resolve(raw);
            if (this.readFile(path) !== null) {
                return [{ kind: "info", text: `Sourced ${raw} (no definitions to apply).` }];
            }
            return [{ kind: "error", text: `Cannot source: ${raw}` }];
        },

        mkdir(args) {
            if (!args[0]) return [{ kind: "error", text: "mkdir requires a name" }];
            const path = this.resolve(args[0]);
            if (this.node(path)) return [{ kind: "error", text: `Already exists: ${args[0]}` }];
            this.state.userNodes[path] = { type: "dir" };
            return [{ kind: "success", text: `Created directory ${args[0]}` }];
        },

        touch(args) {
            if (!args[0]) return [{ kind: "error", text: "touch requires a file" }];
            const path = this.resolve(args[0]);
            if (!this.node(path)) this.state.userNodes[path] = { type: "file", content: "" };
            return [{ kind: "success", text: `Touched ${args[0]}` }];
        },

        cp(args) {
            const eff = args.filter((a) => !a.startsWith("-"));
            if (eff.length < 2) return [{ kind: "error", text: "cp requires source and destination" }];
            if (eff.length > 2) return [{ kind: "error", text: "cp: too many arguments (glob matched several files?)" }];
            const src = this.resolve(eff[0]);
            const dst = this.resolve(eff[1]);
            const text = this.readFile(src);
            if (text === null) return [{ kind: "error", text: `No such file: ${eff[0]}` }];
            this.state.userNodes[dst] = { type: "file", content: text };
            return [{ kind: "success", text: `Copied ${eff[0]} to ${eff[1]}` }];
        },

        mv(args) {
            if (args.length < 2) return [{ kind: "error", text: "mv requires source and destination" }];
            const src = this.resolve(args[0]);
            const dst = this.resolve(args[1]);
            const node = this.state.userNodes[src];
            if (!node) return [{ kind: "error", text: "Web Bashcrawl only moves files you created in this session." }];
            this.state.userNodes[dst] = node;
            delete this.state.userNodes[src];
            return [{ kind: "success", text: `Moved ${args[0]} to ${args[1]}` }];
        },

        rm(args) {
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
        },

        history() {
            return [{ kind: "output", text: this.state.history.map((cmd, i) => `${i + 1}  ${cmd}`).join("\n") || "(empty)" }];
        },

        clear() {
            return [{ kind: "control", action: "clear" }];
        },
    };

    const meta = {
        pwd: { summary: "print the current directory", usage: "pwd" },
        ls: { summary: "list directory contents", usage: "ls [-a] [-F] [DIR]" },
        cd: { summary: "change directory", usage: "cd [DIR|-|..]" },
        cat: { summary: "print file contents", usage: "cat FILE" },
        head: { summary: "first lines of input", usage: "head [-n N] [FILE]" },
        tail: { summary: "last lines of input", usage: "tail [-n N] [FILE]" },
        wc: { summary: "count lines, words, characters", usage: "wc [FILE]" },
        grep: { summary: "search lines by pattern", usage: "grep [-rilnvcw] PATTERN [FILE...]" },
        sort: { summary: "sort lines", usage: "sort [-nru] [FILE]" },
        uniq: { summary: "collapse repeated adjacent lines", usage: "uniq [-cd] [FILE]" },
        cut: { summary: "extract fields or characters", usage: "cut -d DELIM -f LIST | cut -c LIST" },
        tr: { summary: "translate or delete characters", usage: "tr SET1 SET2 | tr -d SET1" },
        sed: { summary: "substitute text", usage: "sed 's/pattern/replacement/g' [FILE]" },
        nl: { summary: "number lines", usage: "nl [FILE]" },
        rev: { summary: "reverse each line", usage: "rev [FILE]" },
        find: { summary: "walk the tree by name/type", usage: "find [DIR] [-name GLOB] [-type f|d]" },
        tree: { summary: "draw the directory tree", usage: "tree [DIR]" },
        file: { summary: "describe a path", usage: "file PATH" },
        chmod: { summary: "toggle the executable bit", usage: "chmod +x|-x FILE" },
        man: { summary: "show a command's manual entry", usage: "man COMMAND" },
        date: { summary: "print the current date/time", usage: "date" },
        env: { summary: "print environment variables", usage: "env" },
        echo: { summary: "print text with $VAR expansion", usage: "echo [TEXT...]" },
        export: { summary: "set an environment variable", usage: "export VAR=value" },
        let: { summary: "simple integer arithmetic", usage: "let VAR=VAR+N" },
        alias: { summary: "define or list command aliases", usage: "alias [name='command']" },
        source: { summary: "source a file into the shell", usage: "source FILE" },
        mkdir: { summary: "create a directory", usage: "mkdir NAME" },
        touch: { summary: "create an empty file", usage: "touch NAME" },
        cp: { summary: "copy a file", usage: "cp SRC DST" },
        mv: { summary: "move a session-created file", usage: "mv SRC DST" },
        rm: { summary: "remove a session-created file", usage: "rm FILE" },
        history: { summary: "show session command history", usage: "history" },
        clear: { summary: "clear the terminal log", usage: "clear" },
    };

    return { name: "posix", commands, meta };
});
