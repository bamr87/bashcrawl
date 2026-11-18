(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.parser = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge command-line parser: quote-aware tokenizing, `|` pipeline
    // splitting, `>`/`>>` redirection, the small flag/list/set parsers the
    // POSIX command pack shares, and the near-miss matcher behind every
    // "did you mean" (suggest). Pure functions, no environment dependencies.
    // Extracted verbatim from the original browser emulator.

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

    /**
     * The "did you mean" rule the shell, the POSIX pack and explain share:
     * up to 3 known names within 1 edit (names of 4 characters or fewer) or
     * 2 edits (longer ones), closest first, ties alphabetical.
     */
    function suggest(name, known) {
        const limit = name.length <= 4 ? 1 : 2;
        return [...new Set(known)]
            .map((k) => ({ k, d: editDistance(name, k) }))
            .filter(({ d }) => d > 0 && d <= limit)
            .sort((x, y) => x.d - y.d || x.k.localeCompare(y.k))
            .slice(0, 3)
            .map(({ k }) => k);
    }

    return {
        escapeRegExp,
        tokenize,
        tokenizeDetailed,
        splitRedirect,
        parseLineCount,
        parseRangeList,
        expandTrSet,
        splitPipes,
        asLines,
        editDistance,
        suggest,
    };
});
