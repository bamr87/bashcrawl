(function initCommandFx(global) {
    const ALIASES = {
        less: "cat", drill: "train", practice: "train", arena: "train",
        speed: "speedrun", seek: "pathfind", journey: "pathfind",
        badges: "achievements", stats: "profile", sheet: "profile",
        codex: "bestiary", challenge: "daily", cmds: "commands",
        menu: "commands", features: "commands",
    };

    const COMMANDS = {
        pwd: { family: "locate", motion: "radar", accent: "#22d3ee" },
        ls: { family: "see", motion: "scan", accent: "#4ade80" },
        cd: { family: "move", motion: "warp", accent: "#c084fc" },
        cat: { family: "read", motion: "cat", accent: "#fbbf24" },
        head: { family: "read", motion: "peek-top", accent: "#fde68a" },
        tail: { family: "read", motion: "peek-bottom", accent: "#f59e0b" },
        wc: { family: "count", motion: "tally", accent: "#38bdf8" },
        grep: { family: "search", motion: "hunt", accent: "#fb7185" },
        find: { family: "search", motion: "ripple", accent: "#f472b6" },
        tree: { family: "see", motion: "branch", accent: "#86efac" },
        map: { family: "see", motion: "branch", accent: "#4ade80" },
        look: { family: "see", motion: "blink", accent: "#a3e635" },
        file: { family: "see", motion: "identify", accent: "#2dd4bf" },
        echo: { family: "speak", motion: "echo", accent: "#67e8f9" },
        export: { family: "bind", motion: "bind", accent: "#c084fc" },
        let: { family: "bind", motion: "tick", accent: "#e879f9" },
        alias: { family: "bind", motion: "bind", accent: "#a78bfa" },
        env: { family: "bind", motion: "grid", accent: "#818cf8" },
        source: { family: "bind", motion: "absorb", accent: "#8b5cf6" },
        mkdir: { family: "make", motion: "forge", accent: "#fbbf24" },
        touch: { family: "make", motion: "forge", accent: "#f59e0b" },
        cp: { family: "make", motion: "copy", accent: "#34d399" },
        mv: { family: "make", motion: "shift", accent: "#22d3ee" },
        rm: { family: "make", motion: "burn", accent: "#f87171" },
        chmod: { family: "make", motion: "grant", accent: "#fb923c" },
        ln: { family: "make", motion: "bind", accent: "#c084fc" },
        sort: { family: "xform", motion: "shuffle", accent: "#60a5fa" },
        uniq: { family: "xform", motion: "merge", accent: "#818cf8" },
        cut: { family: "xform", motion: "slice", accent: "#f97316" },
        tr: { family: "xform", motion: "morph", accent: "#14b8a6" },
        sed: { family: "xform", motion: "rewrite", accent: "#f43f5e" },
        nl: { family: "xform", motion: "numbers", accent: "#38bdf8" },
        rev: { family: "xform", motion: "mirror", accent: "#a78bfa" },
        history: { family: "meta", motion: "rewind", accent: "#94a3b8" },
        clear: { family: "meta", motion: "clear", accent: "#64748b" },
        help: { family: "lore", motion: "lore", accent: "#fbbf24" },
        man: { family: "lore", motion: "lore", accent: "#f59e0b" },
        hint: { family: "lore", motion: "lore", accent: "#fde68a" },
        whoami: { family: "locate", motion: "radar", accent: "#22d3ee" },
        date: { family: "locate", motion: "tick", accent: "#67e8f9" },
        quest: { family: "game", motion: "spark", accent: "#fbbf24" },
        inventory: { family: "game", motion: "spark", accent: "#f59e0b" },
        health: { family: "game", motion: "pulse", accent: "#4ade80" },
        status: { family: "game", motion: "grid", accent: "#22d3ee" },
        save: { family: "game", motion: "seal", accent: "#38bdf8" },
        reset: { family: "game", motion: "clear", accent: "#f87171" },
        xp: { family: "game", motion: "spark", accent: "#4ade80" },
        train: { family: "game", motion: "streak", accent: "#fbbf24" },
        speedrun: { family: "game", motion: "streak", accent: "#fb7185" },
        pathfind: { family: "game", motion: "compass", accent: "#22d3ee" },
        achievements: { family: "game", motion: "spark", accent: "#fde68a" },
        profile: { family: "game", motion: "grid", accent: "#a78bfa" },
        bestiary: { family: "game", motion: "beast", accent: "#c084fc" },
        daily: { family: "game", motion: "tick", accent: "#38bdf8" },
        commands: { family: "lore", motion: "lore", accent: "#94a3b8" },
        fortune: { family: "flavour", motion: "lore", accent: "#fbbf24" },
        cowsay: { family: "flavour", motion: "echo", accent: "#86efac" },
        figlet: { family: "flavour", motion: "unroll", accent: "#fde68a" },
        banner: { family: "flavour", motion: "unroll", accent: "#fbbf24" },
        sl: { family: "flavour", motion: "steam", accent: "#94a3b8" },
        exec: { family: "cast", motion: "cast", accent: "#c084fc" },
        _unknown: { family: "error", motion: "error", accent: "#f87171" },
    };

    const FLAG_FX = {
        a: { motion: "unveil", accent: "#fbbf24" },
        A: { motion: "unveil", accent: "#f59e0b" },
        F: { motion: "mark", accent: "#4ade80" },
        l: { motion: "ledger", accent: "#67e8f9" },
        h: { motion: "scale", accent: "#2dd4bf" },
        r: { motion: "ripple", accent: "#fb7185" },
        R: { motion: "ripple", accent: "#f472b6" },
        i: { motion: "soften", accent: "#a78bfa" },
        n: { motion: "numbers", accent: "#38bdf8" },
        v: { motion: "invert", accent: "#f43f5e" },
        c: { motion: "tally", accent: "#22d3ee" },
        w: { motion: "mark", accent: "#fbbf24" },
        d: { motion: "slice", accent: "#fb923c" },
        f: { motion: "follow", accent: "#f59e0b" },
        u: { motion: "merge", accent: "#818cf8" },
        E: { motion: "hunt", accent: "#fb7185" },
        p: { motion: "forge", accent: "#fbbf24" },
        t: { motion: "tick", accent: "#67e8f9" },
        x: { motion: "grant", accent: "#fb923c" },
        name: { motion: "hunt", accent: "#f472b6" },
        type: { motion: "identify", accent: "#2dd4bf" },
        "+x": { motion: "grant", accent: "#4ade80" },
        "-x": { motion: "revoke", accent: "#f87171" },
    };

    function unique(list) {
        const seen = new Set();
        const out = [];
        for (const item of list) {
            if (!item || seen.has(item)) continue;
            seen.add(item);
            out.push(item);
        }
        return out;
    }

    function extractFlags(args) {
        const flags = [];
        for (const arg of args) {
            if (arg === "--") break;
            if (arg === "+x" || arg === "-x") { flags.push(arg); continue; }
            if (arg === "-" || arg === ".." || arg === "~") continue;
            if (arg.startsWith("--") && arg.length > 2) {
                flags.push(arg.slice(2));
                continue;
            }
            if (arg.startsWith("-") && arg.length > 1 && !/^-\d+$/.test(arg)) {
                const body = arg.slice(1);
                const longOpts = { name: 1, type: 1, iname: 1, path: 1, maxdepth: 1 };
                if (longOpts[body]) {
                    flags.push(body);
                } else if (/^[A-Za-z]+$/.test(body) && body.length <= 6) {
                    flags.push(...body.split(""));
                } else {
                    const m = body.match(/^([A-Za-z]+)/);
                    if (m) flags.push(m[1]);
                }
            }
        }
        return unique(flags);
    }

    function hashHue(text) {
        let h = 0;
        for (let i = 0; i < text.length; i += 1) h = (h * 33 + text.charCodeAt(i)) >>> 0;
        return h % 56;
    }

    function describe(line) {
        const raw = String(line || "").trim();
        const empty = {
            cmd: "", flags: [], motion: "scan", flagMotions: [], accent: "#22d3ee",
            piped: false, redirect: "", exec: false, family: "see", known: false, hue: 0,
        };
        if (!raw) return empty;
        const parser = global.TermForge && global.TermForge.parser;
        const pipes = parser && parser.splitPipes ? parser.splitPipes(raw) : raw.split("|").map((s) => s.trim()).filter(Boolean);
        const piped = pipes.length > 1;
        const last = pipes[pipes.length - 1] || raw;
        const redir = parser && parser.splitRedirect ? parser.splitRedirect(last) : { core: last, redirect: null };
        const core = String(redir.core || last).trim();
        const tokens = parser && parser.tokenize ? parser.tokenize(core) : core.split(/\s+/).filter(Boolean);
        let cmd = String(tokens[0] || "").toLowerCase();
        const args = tokens.slice(1);
        let exec = false;
        if (cmd.startsWith("./") || (cmd.startsWith("/") && cmd.includes("/") && cmd !== "/")) {
            exec = true;
            cmd = "exec";
        }
        cmd = ALIASES[cmd] || cmd;
        const flags = extractFlags(args).sort();
        const positional = args.filter((a) => !a.startsWith("-") || a === "-");
        const entry = COMMANDS[cmd] || COMMANDS._unknown;
        let motion = entry.motion;
        if (cmd === "cd") {
            if (positional[0] === "..") motion = "climb";
            else if (positional[0] === "-") motion = "rewind";
            else if (positional[0] === "~" || positional[0] == null) motion = "home";
        }
        if (cmd === "chmod") {
            if (args.some((a) => a.includes("+x") || a === "+x")) motion = "grant";
            else if (args.some((a) => a === "-x" || /^-x/.test(a))) motion = "revoke";
        }
        if (cmd === "tail" && flags.includes("f")) motion = "follow";
        if (cmd === "wc" && flags.includes("l") && flags.length === 1) motion = "tally";
        const flagMotions = unique(flags.map((f) => FLAG_FX[f] && FLAG_FX[f].motion).filter(Boolean));
        if (!COMMANDS[cmd]) motion = "error";
        const redirect = redir.redirect ? (redir.redirect.append ? "append" : "write") : "";
        if (piped && motion !== "error") flagMotions.push("pipe");
        if (redirect === "write") flagMotions.push("write");
        if (redirect === "append") flagMotions.push("append");
        const key = `${piped ? "pipe:" : ""}${redirect ? `${redirect}:` : ""}${cmd}:${flags.join("")}:${motion}`;
        return {
            cmd,
            flags,
            motion,
            flagMotions,
            accent: entry.accent,
            piped,
            redirect,
            exec,
            family: entry.family,
            known: Boolean(COMMANDS[cmd]),
            hue: hashHue(key),
            key,
        };
    }

    function apply(line, opts) {
        const options = opts || {};
        const spec = describe(line);
        if (options.error) {
            spec.motion = "error";
            spec.known = false;
            spec.accent = "#f87171";
        }
        const log = options.log;
        const content = (log && log.closest && log.closest(".tui-content")) || options.root;
        if (!content || !content.setAttribute) return spec;
        content.dataset.fxCmd = spec.cmd || "none";
        content.dataset.fxFlags = spec.flags.join("");
        content.dataset.fxMotion = spec.motion;
        content.dataset.fxPipe = spec.piped ? "1" : "0";
        content.dataset.fxRedirect = spec.redirect || "";
        content.style.setProperty("--fx-accent", spec.accent);
        content.style.setProperty("--fx-hue", String(spec.hue));
        content.classList.remove("fx-play");
        void content.offsetWidth;
        content.classList.add("fx-play");
        const ms = spec.motion === "error" ? 380 : 640;
        setTimeout(() => content.classList.remove("fx-play"), ms);
        if (options.form) {
            options.form.classList.remove("fx-submit");
            void options.form.offsetWidth;
            options.form.classList.add("fx-submit");
            setTimeout(() => options.form.classList.remove("fx-submit"), 320);
        }
        if (options.prompt) {
            options.prompt.classList.remove("fx-cast");
            void options.prompt.offsetWidth;
            options.prompt.classList.add("fx-cast");
            setTimeout(() => options.prompt.classList.remove("fx-cast"), 480);
        }
        return spec;
    }

    const CAT_MARKUP = '<div class="px-cat-sprite">'
        + '<span class="px-cat-ear px-cat-ear-l"></span>'
        + '<span class="px-cat-ear px-cat-ear-r"></span>'
        + '<span class="px-cat-head"></span>'
        + '<span class="px-cat-eye px-cat-eye-l"></span>'
        + '<span class="px-cat-eye px-cat-eye-r"></span>'
        + '<span class="px-cat-nose"></span>'
        + '<span class="px-cat-body"></span>'
        + '<span class="px-cat-paw px-cat-paw-f"></span>'
        + '<span class="px-cat-paw px-cat-paw-b"></span>'
        + '<span class="px-cat-tail"></span>'
        + '<span class="px-cat-bit px-cat-bit-1"></span>'
        + '<span class="px-cat-bit px-cat-bit-2"></span>'
        + '<span class="px-cat-bit px-cat-bit-3"></span>'
        + "</div>";

    function motionOk() {
        return !(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function outputLineCount(outputs) {
        let n = 0;
        for (const out of outputs || []) {
            if (!out || out.action || out.kind === "error") continue;
            n += String(out.text ?? "").split("\n").length;
        }
        return n;
    }

    function playCat(log, outputs) {
        if (!log || !log.querySelectorAll || !motionOk()) return;
        if (!global.document || !global.document.createElement) return;
        const host = log.closest(".tui-content") || log.parentElement;
        if (!host) return;
        let cat = host.querySelector(".px-cat");
        if (!cat) {
            cat = global.document.createElement("div");
            cat.className = "px-cat";
            cat.setAttribute("aria-hidden", "true");
            cat.innerHTML = CAT_MARKUP;
            host.appendChild(cat);
        }
        host.classList.remove("fx-cat-play");
        cat.classList.remove("px-cat-run");
        void host.offsetWidth;
        host.classList.add("fx-cat-play");
        cat.classList.add("px-cat-run");
        const n = outputLineCount(outputs);
        const spans = log.querySelectorAll("span");
        const start = Math.max(0, spans.length - n);
        for (let i = start; i < spans.length; i += 1) {
            spans[i].classList.add("fx-cat-text");
            spans[i].style.setProperty("--cat-delay", `${90 + (i - start) * 48}ms`);
        }
        setTimeout(() => {
            host.classList.remove("fx-cat-play");
            cat.classList.remove("px-cat-run");
        }, 1700);
    }

    global.BashcrawlCommandFx = {
        ALIASES,
        COMMANDS,
        FLAG_FX,
        describe,
        apply,
        extractFlags,
        playCat,
        outputLineCount,
    };
})(typeof globalThis !== "undefined" ? globalThis : this);
