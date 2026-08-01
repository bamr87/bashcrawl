(function (global, factory) {
    "use strict";
    const hasCjs = typeof module !== "undefined" && module.exports && typeof require === "function";
    const deps = hasCjs
        ? {
            parser: require("./parser.js"),
            vfs: require("./vfs.js"),
            state: require("./state.js"),
            hooks: require("./hooks.js"),
            registry: require("./registry.js"),
        }
        : {
            parser: global.TermForge.parser,
            vfs: global.TermForge.vfs,
            state: global.TermForge.state,
            hooks: global.TermForge.hooks,
            registry: global.TermForge.registry,
        };
    const api = factory(deps);
    if (hasCjs) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.shell = api;
        global.TermForge.Shell = api.Shell;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
    "use strict";
    // TermForge Shell — the terminal-emulator kernel.
    //
    // One Shell = one session over a world: quote-aware parsing, `|` pipelines
    // with stdin chaining, `>`/`>>` redirection into the VFS overlay, glob
    // expansion, aliases, env vars, tab completions — with every app-specific
    // behavior (quests, scoring, encounters, telemetry) attached through the
    // hook bus rather than baked in. Command handlers are unbound functions
    // invoked as fn.call(shell, args, stdin) returning Line[] (core/protocol).
    //
    // Determinism: the ambient sources (wall clock, randomness, base64) are
    // injectable so hosts/tests can pin them; defaults fall back to the
    // environment's own.

    const { tokenizeDetailed, tokenize, splitRedirect, splitPipes, escapeRegExp } = deps.parser;

    function defaultEncodeBase64(text) {
        if (typeof btoa === "function") return btoa(text);
        return Buffer.from(String(text), "latin1").toString("base64");
    }

    class Shell {
        /**
         * @param {object} options
         * @param {object} options.world      VFS world map (see core/vfs.js)
         * @param {object} [options.state]    session state (default: defaultShellState)
         * @param {object} [options.handlers] explicit command manifest (wins over packs)
         * @param {Array}  [options.packs]    packs merged via registry.buildHandlers
         * @param {object} [options.commands] docs bundle for `man`-style lookups
         * @param {object} [options.hooks]    a HookBus (default: fresh empty bus)
         * @param {{now: () => number}} [options.clock]
         * @param {() => number} [options.rng]
         * @param {(s: string) => string} [options.encodeBase64]
         * @param {boolean} [options.bare]    skip ALL hooks in execute() (scoped
         *                                    sandboxes; also settable post-hoc)
         */
        constructor(options) {
            const opts = options || {};
            if (!opts.world) throw new Error("Shell requires options.world");
            this.world = opts.world;
            this.commands = opts.commands || { categories: {}, quick_ref: {}, runtime: [] };
            this.state = opts.state || deps.state.defaultShellState(this.world.root);
            this.hooks = opts.hooks || new deps.hooks.HookBus();
            this.clock = opts.clock || { now: () => Date.now() };
            this.rng = opts.rng || Math.random;
            this.encodeBase64 = opts.encodeBase64 || defaultEncodeBase64;
            this.bare = Boolean(opts.bare);
            this.vfs = deps.vfs.createVfs(this.world, { getState: () => this.state });
            this.handlers = opts.handlers || deps.registry.buildHandlers(...(opts.packs || []));
        }

        // ── Execution spine ──────────────────────────────────────────────────

        execute(line) {
            // Bare/scoped mode (mini-game sandboxes): no app hooks — just the
            // pipeline.
            if (this.bare) return this.runPipeline(line);
            this.hooks.run("preExecute", line);
            // An interceptor (e.g. an active quiz) consumes the whole line
            // instead of the shell parser.
            const intercepted = this.hooks.first("interceptLine", line);
            const out = intercepted != null ? intercepted : this.runPipeline(line);
            const extra = this.hooks.collect("postExecute", line, out);
            return extra.length ? out.concat(extra) : out;
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
            // Passive observers (e.g. navigation mini-games) watch normal play.
            const observed = this.hooks.collect("observePipeline", line, collected);
            if (observed.length) collected.push(...observed);
            return collected;
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
            this.hooks.run("beforeCommand", cmd, args, stdin);
            if (cmd.startsWith("./")) {
                const output = this.runExecutable(cmd.slice(2));
                this.hooks.run("postCommand", cmd, args, undefined, output);
                return output;
            }
            const handler = this.handlers[cmd];
            if (!handler) {
                return [{ kind: "error", text: `Unknown command: ${cmd}. Try help.` }];
            }
            const output = handler.call(this, args, stdin);
            this.hooks.run("postCommand", cmd, args, stdin, output);
            return output;
        }

        // `./name`: apps register execDispatch subscribers (encounter engines,
        // tool runners); the first non-null result handles the invocation.
        runExecutable(name) {
            const dispatched = this.hooks.first("execDispatch", name);
            if (dispatched != null) return dispatched;
            return [{ kind: "error", text: `No runnable script: ./${name}` }];
        }

        // ── Line plumbing ────────────────────────────────────────────────────

        applyAlias(line) {
            const [head, ...rest] = tokenize(line);
            if (!head || !this.state.aliases[head]) return line;
            return [this.state.aliases[head], ...rest].join(" ");
        }

        // Persist text into a player-visible file (userNodes overlay; shadows a
        // same-named world file, mirroring a real overwrite).
        writeFile(rawPath, text, append) {
            const path = this.resolve(rawPath);
            if (this.vfs.providerFor(path)) return { kind: "error", text: `cannot write to ${rawPath}: read-only filesystem` };
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

        // ── Variables ────────────────────────────────────────────────────────
        // (apps override these to map special names onto their own state)

        getVar(key) {
            return this.state.envVars[key] || "";
        }

        setVar(key, value) {
            this.state.envVars[key] = value;
        }

        // ── Filesystem delegates ─────────────────────────────────────────────

        resolve(path, cwd = this.state.cwd) {
            return this.vfs.resolve(path, cwd);
        }

        parentPath(path) {
            return this.vfs.parentPath(path);
        }

        actual(path) {
            return this.vfs.actual(path);
        }

        basename(path) {
            return this.vfs.basename(path);
        }

        node(path) {
            return this.vfs.node(path);
        }

        isDir(path) {
            return this.vfs.isDir(path);
        }

        readFile(path) {
            return this.vfs.readFile(path);
        }

        entries(path, showHidden = false) {
            return this.vfs.entries(path, showHidden);
        }

        currentRoomMeta() {
            return this.vfs.roomMeta(this.state.cwd);
        }

        // Reveal a hidden directory by logical name; apps may override to add
        // their own announcement copy.
        revealRoom(name) {
            const found = this.vfs.findHiddenDir(name);
            if (!found || this.state.reveals[found.visiblePath]) return null;
            this.state.reveals[found.visiblePath] = found.realPath;
            return { kind: "success", text: `Unlocked: ${name}/` };
        }

        // ── UX surface ───────────────────────────────────────────────────────

        promptLabel() {
            return `${this.state.cwd} $`;
        }

        // `man` fallback text for handler-backed commands with no docs entry;
        // apps override to point at their own help surface.
        manBuiltinNote(cmd) {
            return `Built-in command. Try '${cmd} --help'.`;
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

    return { Shell };
});
