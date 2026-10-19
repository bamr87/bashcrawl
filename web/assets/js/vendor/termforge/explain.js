(function (global, factory) {
    "use strict";
    const hasCjs = typeof module !== "undefined" && module.exports && typeof require === "function";
    const parser = hasCjs ? require("./parser.js") : global.TermForge.parser;
    const api = factory(parser);
    if (hasCjs) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.explain = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (parser) {
    "use strict";
    // TermForge explain — an offline, deterministic "explainshell".
    //
    // `explain cat notes | grep -n todo | wc -l` breaks a command line into
    // its pipeline stages, names each command, decodes every flag, says what
    // each argument resolves to in THIS session (a file here, a directory, a
    // glob matching N names, a variable's current value), and narrates the
    // pipes and redirections between them. `explain` alone explains the line
    // you ran before it. No model call: the knowledge is the flag table below
    // plus the app's own command docs, so it works on every surface, offline.
    //
    // explainLine(shell, line, docs?) -> structured stages; plugin(options)
    // -> the `explain` command. The whole raw line is captured (interceptLine),
    // so pipes need no quoting.

    const { tokenizeDetailed, splitRedirect, splitPipes } = parser;

    // Common flags of the standard tools, in plain words. Brand-neutral shell
    // knowledge; apps add or override entries via the plugin's `flags` option.
    const FLAGS = {
        ls: { a: "include hidden entries (names that start with .)", l: "long format: permissions, owner, size, date", F: "mark types: / directory, * executable, @ link", h: "human-readable sizes (with -l)", R: "recurse into subdirectories", t: "sort by modification time", r: "reverse the sort order", 1: "one entry per line", A: "hidden entries, but not . and .." },
        grep: { i: "ignore upper/lower case", n: "prefix each match with its line number", r: "search directories recursively", R: "search directories recursively", v: "invert: keep lines that do NOT match", c: "print only the number of matching lines", l: "print only the names of files that match", w: "match whole words only", E: "extended regular expressions", o: "print only the matched part", e: "the next argument is the pattern" },
        wc: { l: "count lines", w: "count words", c: "count bytes", m: "count characters" },
        sort: { n: "numeric order (10 after 9)", r: "reverse the order", u: "unique: drop duplicate lines", k: "sort by a key field", t: "field separator for -k", f: "ignore case" },
        uniq: { c: "prefix each line with how many times it repeats", d: "print only lines that repeat", u: "print only lines that never repeat", i: "ignore case" },
        head: { n: "how many lines to show (default 10)", c: "how many bytes to show" },
        tail: { n: "how many lines to show (default 10)", f: "follow: keep printing as the file grows", c: "how many bytes to show" },
        cut: { d: "the field delimiter (default: TAB)", f: "which fields to keep, e.g. 2 or 1,3", c: "which character positions to keep, e.g. 2-4" },
        tr: { d: "delete the characters in SET1", s: "squeeze runs of a repeated character" },
        find: { name: "match names against a glob pattern", iname: "like -name, ignoring case", type: "f = only files, d = only directories", maxdepth: "how many levels deep to look", mindepth: "skip results shallower than this" },
        mkdir: { p: "create missing parent directories too" },
        rm: { r: "remove directories and everything inside", f: "force: never ask, ignore missing files", i: "ask before every removal" },
        cp: { r: "copy directories recursively", i: "ask before overwriting", v: "say what is being copied" },
        mv: { i: "ask before overwriting", v: "say what is being moved", n: "never overwrite" },
        cat: { n: "number every output line", A: "show invisible characters" },
        echo: { n: "do not print the trailing newline", e: "interpret backslash escapes like \\n" },
        sed: { n: "print only lines a command asks to print", i: "edit files in place", e: "the next argument is a script", E: "extended regular expressions" },
        tree: { a: "include hidden entries", d: "directories only", L: "limit the depth" },
        chmod: { R: "apply recursively" },
        nl: { b: "which lines to number" },
        less: { N: "show line numbers", S: "chop long lines instead of wrapping" },
        history: { c: "clear the history" },
        alias: {},
        export: { p: "list exported variables" },
    };

    // Options that consume the following argument as their value.
    const TAKES_VALUE = {
        head: ["n", "c"], tail: ["n", "c"], cut: ["d", "f", "c"], sort: ["k", "t"],
        find: ["name", "iname", "type", "maxdepth", "mindepth"], sed: ["e"], grep: ["e"], tree: ["L"],
    };
    // Commands whose dash-words are whole option names (find -name), not letter bundles.
    const WORD_OPTIONS = new Set(["find"]);
    // Commands that destroy or overwrite: explain says so before you run them.
    const CAREFUL = {
        rm: "removes files for good: there is no trash can in a shell",
        mv: "silently replaces a file that already has the destination name",
        cp: "silently overwrites a file that already has the destination name",
    };
    const MAX_LINE = 1024;

    // Optimal-string-alignment distance: a swapped pair of letters (grpe ->
    // grep) costs 1, the most common typo at a keyboard.
    function editDistance(a, b) {
        const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
        for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
        for (let i = 1; i <= a.length; i += 1) {
            for (let j = 1; j <= b.length; j += 1) {
                dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
            }
        }
        return dp[a.length][b.length];
    }

    /** Closest known command names (1 edit for short names, 2 for long), best first. */
    function suggest(name, known) {
        const limit = name.length <= 4 ? 1 : 2;
        return known
            .map((k) => ({ k, d: editDistance(name, k) }))
            .filter(({ d }) => d > 0 && d <= limit)
            .sort((x, y) => x.d - y.d || x.k.localeCompare(y.k))
            .slice(0, 3)
            .map(({ k }) => k);
    }

    function summaryOf(shell, docs, cmd) {
        const fromDocs = docs && docs.meta && docs.meta[cmd];
        if (fromDocs && fromDocs.summary) return fromDocs.summary;
        const fromPlugin = shell.commandMeta && shell.commandMeta[cmd];
        if (fromPlugin && fromPlugin.summary) return fromPlugin.summary;
        for (const cat of Object.values((shell.commands && shell.commands.categories) || {})) {
            const hit = (cat.commands || []).find((e) => e.command === cmd);
            if (hit) return hit.description;
        }
        return null;
    }

    function describeArg(shell, token, role) {
        const text = token.text;
        if (role) return role;
        if (/^\$[A-Za-z_]\w*$/.test(text)) {
            const value = shell.getVar(text.slice(1));
            return `variable ${text} — currently ${value ? `"${value}"` : "empty"}`;
        }
        if (!token.quoted && /[*?]/.test(text)) {
            const matches = shell.expandGlob(text);
            return matches.length
                ? `glob — the shell expands it to ${matches.length} name${matches.length === 1 ? "" : "s"}: ${matches.slice(0, 4).join(" ")}${matches.length > 4 ? " …" : ""}`
                : "glob — matches nothing here, so it stays literal";
        }
        if (token.quoted && /[*?]/.test(text)) return "quoted pattern — passed through literally, NOT expanded by the shell";
        const path = shell.resolve(text);
        if (shell.isDir(path)) return text === ".." ? "the parent directory" : text === "." ? "this directory" : `a directory (${path})`;
        if (shell.readFile(path) != null) return `a file (${path})`;
        return token.quoted ? "quoted text" : "an argument";
    }

    function sedScript(text) {
        const m = /^s(.)(.*?)\1(.*?)\1([gI]*)$/.exec(text);
        if (!m) return "a sed script";
        return `substitute: replace "${m[2]}" with "${m[3]}"${m[4].includes("g") ? " everywhere on each line" : " (first match on each line)"}`;
    }

    /**
     * Break one command line into explained stages.
     * @returns {{ line, stages: [{cmd, known, summary, careful, parts: [{text, kind, note}]}],
     *             redirect: {path, append}|null, errors: string[] }}
     */
    function explainLine(shell, line, docs) {
        const text = String(line || "").trim().slice(0, MAX_LINE);
        const { core, redirect, missingTarget } = splitRedirect(text);
        const errors = [];
        if (missingTarget) errors.push("a > needs a file name after it");
        const known = Object.keys(shell.handlers || {});
        const flagTable = { ...FLAGS, ...((docs && docs.flags) || {}) };
        const stages = splitPipes(core).map((segment) => {
            const raw = segment.trim();
            const aliased = shell.state.aliases && shell.state.aliases[raw.split(/\s+/)[0]];
            const tokens = tokenizeDetailed(raw);
            const head = tokens[0] ? tokens[0].text : "";
            const stage = { cmd: head, raw, known: false, summary: null, careful: null, alias: aliased || null, parts: [] };
            if (!head) return stage;
            if (head.startsWith("./")) {
                stage.known = true;
                stage.summary = `run the executable ${head.slice(2)} in this directory`;
            } else {
                stage.known = Boolean(shell.handlers && shell.handlers[head]) || Boolean(aliased);
                stage.summary = aliased ? `alias for: ${aliased}` : summaryOf(shell, docs, head);
                if (!stage.known) stage.suggestions = suggest(head, known);
            }
            stage.careful = CAREFUL[head] || null;
            const flags = flagTable[head] || {};
            const takes = TAKES_VALUE[head] || [];
            let positional = 0;
            for (let i = 1; i < tokens.length; i += 1) {
                const token = tokens[i];
                const t = token.text;
                if (head === "chmod" && /^[+-][rwx]+$/.test(t)) {
                    const verb = t[0] === "+" ? "add" : "remove";
                    stage.parts.push({ text: t, kind: "flag", note: `${verb} ${t.slice(1).split("").map((c) => ({ r: "read", w: "write", x: "execute" })[c]).join("/")} permission` });
                    continue;
                }
                if (t.startsWith("-") && t.length > 1 && !token.quoted) {
                    const word = t.replace(/^-+/, "");
                    if (WORD_OPTIONS.has(head) || t.startsWith("--")) {
                        const note = flags[word] || "an option";
                        if (takes.includes(word) && tokens[i + 1]) {
                            const value = tokens[i + 1];
                            const quotedGlob = value.quoted && /[*?]/.test(value.text)
                                ? " (quoted, so the command sees the pattern itself, not the shell's expansion)" : "";
                            stage.parts.push({ text: `${t} ${value.text}`, kind: "flag", note: note + quotedGlob });
                            i += 1;
                        } else stage.parts.push({ text: t, kind: "flag", note });
                        continue;
                    }
                    // Bundled short flags: -la = -l -a. A value flag may carry
                    // its value glued on (-n5, -d,) or take the next token.
                    const letters = word.split("");
                    for (let j = 0; j < letters.length; j += 1) {
                        const letter = letters[j];
                        const note = flags[letter] || (/^\d+$/.test(word) ? `shorthand for -n ${word}` : "an option");
                        if (/^\d+$/.test(word)) { stage.parts.push({ text: t, kind: "flag", note }); break; }
                        if (takes.includes(letter)) {
                            const glued = word.slice(j + 1);
                            if (glued) stage.parts.push({ text: `-${letter}${glued}`, kind: "flag", note: `${note} = "${glued}"` });
                            else if (tokens[i + 1]) {
                                stage.parts.push({ text: `-${letter} ${tokens[i + 1].text}`, kind: "flag", note: `${note} = "${tokens[i + 1].text}"` });
                                i += 1;
                            } else stage.parts.push({ text: `-${letter}`, kind: "flag", note: `${note} (value missing)` });
                            break;
                        }
                        stage.parts.push({ text: `-${letter}`, kind: "flag", note });
                    }
                    continue;
                }
                let role = null;
                if (head === "grep" && positional === 0) role = "the pattern to search for";
                else if (head === "sed" && positional === 0) role = sedScript(t);
                else if (head === "tr" && positional < 2) role = positional === 0 ? "SET1: characters to translate" : "SET2: what they become";
                else if (head === "echo") role = /^\$[A-Za-z_]\w*$/.test(t) ? null : "text to print";
                else if (head === "export" && t.includes("=")) role = `set ${t.split("=")[0]} to "${t.slice(t.indexOf("=") + 1)}"`;
                else if (head === "alias" && t.includes("=")) role = `define ${t.split("=")[0]} as a shortcut`;
                else if ((head === "mkdir" || head === "touch") && !shell.readFile(shell.resolve(t)) && !shell.isDir(shell.resolve(t))) role = "a new name to create";
                else if ((head === "cp" || head === "mv") && positional === 1) role = "the destination";
                stage.parts.push({ text: t, kind: "arg", note: describeArg(shell, token, role) });
                positional += 1;
            }
            return stage;
        });
        return { line: text, stages, redirect: redirect || null, errors };
    }

    const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

    /** Render an explainLine() result as Line records. */
    function render(result, text) {
        const t = (key, ...args) => text(key, ...args);
        const out = [{ kind: "magic", text: `${t("explainTitle")}  ${result.line}` }];
        const width = Math.min(18, Math.max(6, ...result.stages.flatMap((s) => [s.cmd.length, ...s.parts.map((p) => p.text.length)])));
        const pad = (s) => s.padEnd(width);
        result.stages.forEach((stage, i) => {
            const n = CIRCLED[i] || `${i + 1}.`;
            out.push({ kind: "info", text: `${n} ${stage.raw || stage.cmd}` });
            if (!stage.known) {
                const hint = stage.suggestions && stage.suggestions.length ? t("explainDidYouMean", stage.suggestions) : "";
                out.push({ kind: "error", text: `     ${pad(stage.cmd)}  ${t("explainUnknown")}${hint}` });
            } else {
                out.push({ kind: "output", text: `     ${pad(stage.cmd)}  ${stage.summary || t("explainNoDocs")}` });
            }
            for (const part of stage.parts) out.push({ kind: part.kind === "flag" ? "output" : "dim", text: `     ${pad(part.text)}  ${part.note}` });
            if (stage.careful) out.push({ kind: "error", text: `     ⚠ ${stage.careful}` });
            const next = result.stages[i + 1];
            if (next) out.push({ kind: "dim", text: `   │ ${t("explainPipe", stage.cmd, next.cmd)}` });
        });
        if (result.redirect) {
            out.push({ kind: "dim", text: `   └ ${t(result.redirect.append ? "explainAppend" : "explainWrite", result.redirect.path)}` });
        }
        for (const err of result.errors) out.push({ kind: "error", text: `   ${err}` });
        out.push({ kind: "dim", text: t("explainFooter") });
        return out;
    }

    const DEFAULT_TEXT = {
        explainTitle: "🔍 explain",
        explainUsage: "Usage: explain COMMAND LINE   (or just `explain` to explain the line you ran before)",
        explainNothing: "Nothing to explain yet: run a command first, or type explain followed by one.",
        explainUnknown: "not a command here",
        explainDidYouMean: (names) => ` — did you mean ${names.join(", ")}?`,
        explainNoDocs: "a built-in command (see man)",
        explainPipe: (from, to) => `pipe: ${from}'s output becomes ${to}'s input`,
        explainWrite: (path) => `> ${path}: write the final output into ${path} (replacing it)`,
        explainAppend: (path) => `>> ${path}: add the final output to the end of ${path}`,
        explainFooter: "Nothing was run. Type the line itself to see its result.",
    };

    function lastLine(shell) {
        const history = (shell.state && shell.state.history) || [];
        for (let i = history.length - 1; i >= 0; i -= 1) {
            const line = String(history[i] || "").trim();
            if (line && !/^explain(\s|$)/.test(line)) return line;
        }
        return "";
    }

    function strip(text) {
        const t = text.trim();
        const m = /^(['"])([\s\S]*)\1$/.exec(t);
        return m ? m[2] : t;
    }

    /**
     * The `explain` plugin. options: { docs?: { meta, flags } } — extra
     * summaries ({cmd: {summary}}) and flag notes ({cmd: {letter: note}}).
     */
    function plugin(options) {
        const opts = options || {};
        function run(rest) {
            const target = rest.trim() ? strip(rest) : lastLine(this);
            if (!target) return [{ kind: "info", text: this.text("explainNothing") }, { kind: "dim", text: this.text("explainUsage") }];
            return render(explainLine(this, target, opts.docs), (key, ...args) => this.text(key, ...args));
        }
        return {
            id: "explain",
            name: "Explain",
            version: "1.0.0",
            description: "Break any command line into stages, flags and arguments — offline.",
            commands: {
                explain(args) { return run.call(this, args.join(" ")); },
            },
            meta: { explain: { summary: "break a command line into its parts and say what each does", usage: "explain [COMMAND LINE]", group: "learn" } },
            hooks: {
                // Capture the raw line so `explain a | b > c` needs no quoting.
                interceptLine(line) {
                    const m = /^\s*explain(?:\s+([\s\S]*))?$/.exec(line);
                    return m ? run.call(this, m[1] || "") : null;
                },
            },
            uiText: DEFAULT_TEXT,
        };
    }

    return { FLAGS, TAKES_VALUE, explainLine, render, suggest, plugin, DEFAULT_TEXT };
});
