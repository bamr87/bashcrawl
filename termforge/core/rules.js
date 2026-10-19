(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.rules = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge rules — declarative predicates over a session.
    //
    // Content (badges, lesson objectives, unlock conditions) describes WHEN
    // something is true as data, so authors extend a TermForge app in YAML or
    // Markdown frontmatter without writing JavaScript. One evaluator serves
    // every surface; validate() turns an authoring mistake into a CI failure
    // instead of a silently-unwinnable objective.
    //
    // A rule is a plain object with exactly ONE head key:
    //
    //   combinators   { all: [rule…] }  { any: [rule…] }  { not: rule }
    //   the command   { command: "ls" | ["map","tree"] }   ctx.cmd is one of
    //                 { arg: "docs" | [...] }               an argument equals one of
    //                 { args_contains: "-name" }            joined args contain text
    //                 { option: "a" }                       a dash-token carries the
    //                                                       letter (-la) or --name
    //                 { piped: true }                       ran with non-empty stdin
    //                 { ok: true }                          produced no error record
    //                 { output_includes: "text" }           some output contains text
    //                 { line_includes: "grep" | [...] }     the whole input line contains
    //                                                       one of these (pipelines)
    //   location      { cwd: "/abs" | [...] }   { cwd_includes: "room" | [...] }
    //   state         { state: "a.b", <cmp>? }   value (truthy without a comparator)
    //                 { count: "a.b", <cmp> }    array length / object key count
    //                 { has: "inventory", value: "x" | [...] }   array holds all
    //                 { flag: "name" }           state.flags[name] is truthy
    //                 { exists: "a.b" }          value is not null/undefined
    //   filesystem    { file_exists: "path" }  { dir_exists: "path" }
    //                 { file_contains: "path", text: "…" }
    //   constant      { always: true|false }
    //
    // Comparators (state / count): eq ne gt gte lt lte in includes matches.
    // Numeric comparisons read a missing value as 0, so `{ state:
    // "stats.commands.pwd", gt: 0 }` is false (not an error) on a fresh save.
    //
    // ctx = { state, cmd?, args?, stdin?, outputs?, line?, shell? } — the command
    // fields are present when a rule is checked after a command ran; `shell`
    // (anything with resolve/isDir/readFile) backs the filesystem heads.

    const COMBINATORS = ["all", "any", "not"];
    const HEADS = [
        ...COMBINATORS,
        "command", "arg", "args_contains", "option", "piped", "ok", "output_includes", "line_includes",
        "cwd", "cwd_includes",
        "state", "count", "has", "flag", "exists",
        "file_exists", "dir_exists", "file_contains",
        "always",
    ];
    const COMPARATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "includes", "matches"];
    // Keys a head may carry beside itself.
    const COMPANIONS = {
        state: COMPARATORS,
        count: COMPARATORS,
        has: ["value"],
        file_contains: ["text"],
    };
    const SINGLE_PATH_HEADS = ["state", "count", "exists", "flag"];
    const UNSAFE_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
    const MAX_PATTERN = 200;

    function isPlainObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }

    /** Own-property lookup of a dotted path; undefined when any hop is missing. */
    function lookup(obj, path) {
        if (typeof path !== "string" || !path) return undefined;
        let cur = obj;
        for (const part of path.split(".")) {
            if (UNSAFE_SEGMENTS.has(part)) return undefined;
            if (cur == null || typeof cur !== "object") return undefined;
            if (!Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
            cur = cur[part];
        }
        return cur;
    }

    function asList(value) {
        return Array.isArray(value) ? value : [value];
    }

    function headOf(rule) {
        return Object.keys(rule).filter((key) => HEADS.includes(key));
    }

    function compare(value, rule) {
        const ops = COMPARATORS.filter((op) => Object.prototype.hasOwnProperty.call(rule, op));
        if (!ops.length) return Boolean(value);
        const num = typeof value === "number" ? value : (value == null ? 0 : Number(value));
        for (const op of ops) {
            const want = rule[op];
            let pass;
            switch (op) {
                case "eq": pass = typeof want === "number" ? num === want : value === want; break;
                case "ne": pass = typeof want === "number" ? num !== want : value !== want; break;
                case "gt": pass = num > want; break;
                case "gte": pass = num >= want; break;
                case "lt": pass = num < want; break;
                case "lte": pass = num <= want; break;
                case "in": pass = asList(want).includes(value); break;
                case "includes":
                    pass = (Array.isArray(value) || typeof value === "string") && value.includes(want);
                    break;
                case "matches":
                    pass = typeof value === "string" && new RegExp(want).test(value);
                    break;
                default: pass = false;
            }
            if (!pass) return false;
        }
        return true;
    }

    function sizeOf(value) {
        if (Array.isArray(value) || typeof value === "string") return value.length;
        if (isPlainObject(value)) return Object.keys(value).length;
        return 0;
    }

    function resolvePath(ctx, raw) {
        const shell = ctx.shell;
        if (!shell || typeof shell.resolve !== "function") return null;
        const cwd = ctx.state && typeof ctx.state.cwd === "string" ? ctx.state.cwd : undefined;
        return cwd ? shell.resolve(String(raw), cwd) : shell.resolve(String(raw));
    }

    /**
     * Evaluate a rule against a context. Never throws for missing state or a
     * missing command context — an unmet condition is simply false.
     */
    function evaluate(rule, ctx) {
        const c = ctx || {};
        if (rule == null) return true;
        if (!isPlainObject(rule)) return false;
        const state = c.state || {};
        const args = Array.isArray(c.args) ? c.args : [];
        const outputs = Array.isArray(c.outputs) ? c.outputs : [];
        const [head] = headOf(rule);
        switch (head) {
            case "all": return asList(rule.all).every((r) => evaluate(r, c));
            case "any": return asList(rule.any).some((r) => evaluate(r, c));
            case "not": return !evaluate(rule.not, c);
            case "command": return c.cmd != null && asList(rule.command).includes(c.cmd);
            case "arg": return asList(rule.arg).some((want) => args.includes(want));
            case "args_contains": return args.join(" ").includes(rule.args_contains);
            case "option": {
                const letter = String(rule.option);
                return args.some((a) => (letter.length > 1
                    ? a === `--${letter}`
                    : /^-[A-Za-z]+$/.test(a) && a.slice(1).includes(letter)));
            }
            case "piped": return (c.stdin != null && c.stdin.length > 0) === Boolean(rule.piped);
            case "ok": return !outputs.some((o) => o && o.kind === "error") === Boolean(rule.ok);
            case "output_includes":
                return outputs.some((o) => o && typeof o.text === "string" && o.text.includes(rule.output_includes));
            case "line_includes": return asList(rule.line_includes).some((part) => String(c.line || "").includes(part));
            case "cwd": return asList(rule.cwd).includes(state.cwd);
            case "cwd_includes": return asList(rule.cwd_includes).some((part) => String(state.cwd || "").includes(part));
            case "state": return compare(lookup(state, rule.state), rule);
            case "count": return compare(sizeOf(lookup(state, rule.count)), rule);
            case "has": {
                const value = lookup(state, rule.has);
                return Array.isArray(value) && asList(rule.value).every((item) => value.includes(item));
            }
            case "flag": return Boolean(lookup(state, "flags") && lookup(state.flags, rule.flag));
            case "exists": return lookup(state, rule.exists) != null;
            case "file_exists": {
                const path = resolvePath(c, rule.file_exists);
                return path != null && c.shell.readFile(path) != null;
            }
            case "dir_exists": {
                const path = resolvePath(c, rule.dir_exists);
                return path != null && Boolean(c.shell.isDir(path));
            }
            case "file_contains": {
                const path = resolvePath(c, rule.file_contains);
                const text = path != null ? c.shell.readFile(path) : null;
                return typeof text === "string" && text.includes(rule.text);
            }
            case "always": return Boolean(rule.always);
            default: return false;
        }
    }

    /**
     * Structural check for authored rules. Returns error strings (empty =
     * valid); `where` prefixes each message so CI output points at content.
     */
    function validate(rule, where) {
        const at = where || "rule";
        if (!isPlainObject(rule)) return [`${at}: must be an object`];
        const heads = headOf(rule);
        if (heads.length !== 1) {
            return [`${at}: needs exactly one of ${HEADS.join(", ")} (got ${heads.length ? heads.join(", ") : Object.keys(rule).join(", ") || "nothing"})`];
        }
        const head = heads[0];
        const errors = [];
        const allowed = new Set([head, ...(COMPANIONS[head] || [])]);
        for (const key of Object.keys(rule)) {
            if (!allowed.has(key)) errors.push(`${at}: unexpected key '${key}' beside '${head}'`);
        }
        if (head === "all" || head === "any") {
            if (!Array.isArray(rule[head]) || !rule[head].length) errors.push(`${at}.${head}: must be a non-empty list`);
            else rule[head].forEach((r, i) => errors.push(...validate(r, `${at}.${head}[${i}]`)));
        } else if (head === "not") {
            errors.push(...validate(rule.not, `${at}.not`));
        } else if (head === "has") {
            if (typeof rule.has !== "string" || rule.has.split(".").some((part) => UNSAFE_SEGMENTS.has(part) || !part)) {
                errors.push(`${at}.has: must be a dotted state path`);
            }
            if (rule.value == null) errors.push(`${at}.has: needs a value`);
        } else if (head === "file_contains") {
            if (typeof rule.text !== "string") errors.push(`${at}.file_contains: needs text`);
        } else if (["piped", "ok", "always"].includes(head)) {
            if (typeof rule[head] !== "boolean") errors.push(`${at}.${head}: must be true or false`);
        } else if (SINGLE_PATH_HEADS.includes(head)) {
            if (typeof rule[head] !== "string" || rule[head].split(".").some((part) => UNSAFE_SEGMENTS.has(part) || !part)) {
                errors.push(`${at}.${head}: must be a dotted state path`);
            }
        } else {
            const values = asList(rule[head]);
            if (!values.length || values.some((v) => typeof v !== "string" || !v)) {
                errors.push(`${at}.${head}: must be a non-empty string (or list of strings)`);
            }
        }
        for (const op of ["gt", "gte", "lt", "lte"]) {
            if (Object.prototype.hasOwnProperty.call(rule, op) && !Number.isFinite(rule[op])) {
                errors.push(`${at}.${op}: must be a number`);
            }
        }
        if (Object.prototype.hasOwnProperty.call(rule, "matches")) {
            if (typeof rule.matches !== "string" || rule.matches.length > MAX_PATTERN) {
                errors.push(`${at}.matches: must be a pattern of at most ${MAX_PATTERN} characters`);
            } else {
                try { new RegExp(rule.matches); } catch (err) { errors.push(`${at}.matches: ${err.message}`); }
            }
        }
        return errors;
    }

    return { HEADS, COMPARATORS, lookup, evaluate, validate };
});
