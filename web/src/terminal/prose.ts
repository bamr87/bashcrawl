// The reader layer's classifier. A file viewer (cat, less, head, tail,
// more) prints a scroll as plain lines; this turns each line into HTML by
// the conventions the scrolls already follow in a terminal — `===`/`####`
// rules with a centred CAPS title between them, `#  TITLE  #` frames, CAPS
// labels, `$ cmd   # comment` examples, command/purpose tables, box-drawing
// panels, *atmosphere*, **emphasis**, `code` — and, for the READMEs,
// Markdown. The text is never rewritten: markers stay in the DOM inside
// .sc-mark (hidden by CSS, except in box tables where hiding them would
// break the alignment), so copy and assistive tech still get the file as it
// is. A recognised command carries data-fill and types itself into the
// prompt on click. Pure functions over strings; log-decor.ts is the DOM pass.

export type Escape = (value: unknown) => string;

export interface ProseContext {
    /** Names the shell answers to: a line that starts with one is an example to cast. */
    commands: ReadonlySet<string>;
    escapeHtml: Escape;
}

export interface ProseLine {
    /** The line's class; its span gets `sc sc-<cls>`. */
    cls: string;
    html: string;
}

export const FILE_VIEWERS: ReadonlySet<string> = new Set(["cat", "less", "more", "head", "tail"]);

/** Words a scroll shows as commands that are not runtime handlers: shell builtins and the encounters. */
export const SHELL_WORDS: readonly string[] = [
    "alias", "export", "let", "source", "unset", "env", "chmod", "ln", "cp", "mv", "rm", "exit",
    "./treasure", "./potion", "./spell", "./statue", "./ghost", "./monster", "./goblet",
];

export function commandOf(line: string): string {
    return line.trim().split(/\s+/)[0] ?? "";
}

export function isFileView(line: string): boolean {
    return FILE_VIEWERS.has(commandOf(line));
}

const FRAME_CHARS = "─━═┈┉│┃║┌┐└┘├┤┬┴┼╭╮╰╯╔╗╚╝╠╣╦╩╬┏┓┗┛┣┫┳┻╋";
const FRAME_RUN = new RegExp(`[${FRAME_CHARS}]+`, "g");
const BOX_TOP = /^\s*[┌╭╔┏]/;
const BOX_BOTTOM = /^\s*[└╰╚┗]/;
const BOX_SIDE = /^\s*[│║┃├╠┣]/;
const HEAVY_RULE = /^\s*(?:={12,}|#{12,}|[═━]{12,})\s*$/;
const SOFT_RULE = /^\s*(?:-{10,}|~{8,}|[─┈]{10,}|\.{10,}|_{10,})\s*$/;
const TABLE_UNDERLINE = /^\s*-{3,}(?:\s+-{3,})+\s*$/;
const FRAMED_TITLE = /^(#)(\s+)(\S(?:.*\S)?)(\s+)(#)(\s*)$/;
const MD_HEADING = /^(#{1,6})(\s+)(\S.*)$/;
// Only backtick fences: the scrolls draw `~~~~` rules under their headings.
const FENCE = /^\s*```/;
const PROMPT_LINE = /^(\s*)(\$)(\s+)(\S.*)$/;
const BULLET = /^(\s*)([•▸►◦]|[-*](?=\s)|\d{1,2}[.)])(\s+)(\S.*)$/;
const WHOLE_EM = /^(\s*)\*([^*\s](?:[^*]*[^*\s])?)\*(\s*)$/;
const STATUS = /^(\s*)(✅|☑|✔️|✔|✓|❌|✖|⚠️|⚠|🚫|💡)(\s+)(\S.*)$/u;
const EMOJI_LEAD = /^(\s*)(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)(\s+)(\S.*)$/u;
const CAPS_LABEL = /^(\s*)([A-Z][A-Z0-9 ,&'()/!?.-]{2,}?)([:?!])(\s.*|)$/;
const SOFT_LABEL = /^(\s*)([A-Z][^:]{1,46}):(\s*)$/;
const DIR_ENTRY = /^(\s+)([\w.-]+\/)(\s{2,})(\S.*)$/;
const COMMENT_SPLIT = /^(.*?\S)(\s{2,}#.*|\s#\s.*)$/;
const COLUMN_SPLIT = /^(.*?\S)(\s{3,})(\S.*)$/;
const HEREDOC = /<<-?\s*['"]?(\w+)['"]?/;
const TOKEN = /\s+|'[^']*'|"[^"]*"|\S+/g;
const VAR = /\$(?:\{[A-Za-z_]\w*\}|[A-Za-z_]\w*|[0-9@#?!*-])/g;
const CODE = /`([^`\n]+)`/g;
const BOLD = /\*\*([^*\n]+?)\*\*/g;
const ITALIC = /(^|[^*\w>])\*([^*\s][^*\n]*?)\*(?![\w*])/g;
const OPERATOR = /(^|\s)(\|\||&&|\||;)(\s|$)/;
/** Flags, paths, dots, quotes, operators or variables: what makes a line look like a command. */
const COMMAND_EVIDENCE = /(^|\s)-{1,2}\w|[|;&><$'"/]|(^|\s)\.\.?(\s|$)|(^|\s)~(\/|\s|$)/;
const OPERATORS = new Set(["|", "||", "&&", ";", ">", ">>", "<", "<<", "<<<", "2>", "2>&1", "&>", "&"]);
const KEYWORDS = new Set([
    "if", "then", "else", "elif", "fi", "for", "in", "do", "done", "while", "until", "case", "esac",
    "function", "exit", "return", "local", "read", "shift", "break", "continue",
]);

/** Mostly upper-case letters (a title or a label), with at least three of them. */
function caps(text: string): boolean {
    const letters = text.replace(/[^A-Za-z]/g, "");
    if (letters.length < 3) return false;
    return letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.75;
}

export class ProseDecorator {
    private prevRule = false;
    private fence = false;
    private started = false;
    private script = false;
    private heredoc: string | null = null;

    constructor(private readonly ctx: ProseContext) {}

    /** Classify and render the next line of the file. */
    line(raw: string): ProseLine {
        const out = this.classify(raw);
        if (raw.trim()) this.prevRule = out.cls === "rule";
        return out;
    }

    // ── structure ──────────────────────────────────────────────────────
    private classify(raw: string): ProseLine {
        const esc = this.ctx.escapeHtml;
        const trimmed = raw.trim();
        if (!trimmed) return { cls: "blank", html: esc(raw) };
        if (!this.started) {
            this.started = true;
            this.script = trimmed.startsWith("#!");
        }
        if (this.script) return this.scriptLine(raw, trimmed);
        if (FENCE.test(raw)) {
            this.fence = !this.fence;
            return { cls: "fence", html: esc(raw) };
        }
        if (this.fence) return this.codeLine(raw, trimmed);
        if (HEAVY_RULE.test(raw)) return { cls: "rule", html: esc(raw) };
        if (SOFT_RULE.test(raw) || TABLE_UNDERLINE.test(raw)) return { cls: "rule-soft", html: esc(raw) };
        if (BOX_TOP.test(raw) || BOX_BOTTOM.test(raw) || BOX_SIDE.test(raw)) return this.boxLine(raw);
        const framed = FRAMED_TITLE.exec(raw);
        if (framed) {
            const g = (i: number) => framed[i] ?? "";
            return {
                cls: "h1",
                html: `<span class="sc-hash">${esc(g(1))}</span>${g(2)}${this.inline(g(3))}${g(4)}<span class="sc-hash">${esc(g(5))}</span>${g(6)}`,
            };
        }
        const heading = MD_HEADING.exec(raw);
        if (heading) {
            const hashes = heading[1] ?? "";
            return {
                cls: `md-h${Math.min(hashes.length, 3)}`,
                html: `<span class="sc-mark">${hashes}</span>${heading[2] ?? ""}${this.inline(heading[3] ?? "")}`,
            };
        }
        if (this.prevRule && /^\s{2,}\S/.test(raw) && (caps(trimmed) || /\p{Extended_Pictographic}/u.test(trimmed))) {
            return { cls: "h1", html: this.inline(raw) };
        }
        return this.body(raw, trimmed, false);
    }

    /** Everything that is not page structure; shared with box interiors and bullet bodies. */
    private body(raw: string, trimmed: string, inner: boolean): ProseLine {
        const esc = this.ctx.escapeHtml;
        let m: RegExpExecArray | null;
        if ((m = PROMPT_LINE.exec(raw))) {
            return { cls: "cmd", html: `${m[1] ?? ""}<span class="sc-prompt">$</span>${m[3] ?? ""}${this.commandWithTrail(m[4] ?? "")}` };
        }
        if ((m = STATUS.exec(raw))) {
            const mark = m[2] ?? "";
            const tone = /^(?:✅|☑|✔|✓)/u.test(mark) ? "ok" : mark === "💡" ? "tip" : "warn";
            return { cls: "status", html: `${m[1] ?? ""}<span class="sc-${tone}">${mark}</span>${m[3] ?? ""}${this.inline(m[4] ?? "")}` };
        }
        if ((m = BULLET.exec(raw))) {
            const rest = m[4] ?? "";
            const body = this.body(rest, rest.trim(), true);
            const restHtml = body.cls === "text" ? body.html : `<span class="sc-${body.cls}">${body.html}</span>`;
            return { cls: "bullet", html: `${m[1] ?? ""}<span class="sc-bullet">${esc(m[2])}</span>${m[3] ?? ""}${restHtml}` };
        }
        if ((m = WHOLE_EM.exec(raw))) {
            return { cls: "em", html: `${m[1] ?? ""}<span class="sc-mark">*</span>${this.inline(m[2] ?? "")}<span class="sc-mark">*</span>${m[3] ?? ""}` };
        }
        if ((m = EMOJI_LEAD.exec(raw))) {
            const rest = m[4] ?? "";
            if (rest.length <= 72 && !/^[=\-–:]/.test(rest)) {
                return { cls: "h2", html: `${m[1] ?? ""}${esc(m[2])}${m[3] ?? ""}${this.inline(rest)}` };
            }
        }
        if (!inner && /^\s{8,}\S/.test(raw) && caps(trimmed.split(":")[0] ?? trimmed)) {
            return { cls: "h2", html: this.inline(raw) };
        }
        if (caps(trimmed) && !trimmed.includes(":") && trimmed.split(/\s{2,}/).length >= 2) {
            return { cls: "th", html: esc(raw) };
        }
        if ((m = CAPS_LABEL.exec(raw))) {
            return { cls: "labelled", html: `${m[1] ?? ""}<span class="sc-label">${esc((m[2] ?? "") + (m[3] ?? ""))}</span>${this.inline(m[4] ?? "")}` };
        }
        if (caps(trimmed) && trimmed.length <= 60) return { cls: "label", html: esc(raw) };
        if ((m = SOFT_LABEL.exec(raw))) {
            return { cls: "labelled", html: `${m[1] ?? ""}<span class="sc-label">${esc(m[2])}:</span>${m[3] ?? ""}` };
        }
        const command = this.commandRow(raw, trimmed, inner);
        if (command) return command;
        if ((m = DIR_ENTRY.exec(raw))) {
            return { cls: "dir", html: `${m[1] ?? ""}<span class="sc-dir">${esc(m[2])}</span>${m[3] ?? ""}<span class="sc-desc">${this.inline(m[4] ?? "")}</span>` };
        }
        return { cls: "text", html: this.inline(raw) };
    }

    /**
     * An example without a `$`: "    cd cellar", "ls -F        See file
     * types", "cmd1 | cmd2    Pipe…". The first word must be a command the
     * shell knows (or the line must show an operator), and a line with no
     * flag, path, quote or comment to vouch for it must be short and
     * indented — "find the key before you leave" is prose.
     */
    private commandRow(raw: string, trimmed: string, inner: boolean): ProseLine | null {
        const indent = raw.length - raw.trimStart().length;
        const rest = raw.slice(indent);
        const first = trimmed.split(/\s+/)[0] ?? "";
        const comment = COMMENT_SPLIT.exec(rest);
        const columns = comment ? null : COLUMN_SPLIT.exec(rest);
        const head = (comment ? comment[1] : columns ? columns[1] : rest) ?? rest;
        const known = this.ctx.commands.has(first) || first.startsWith("./");
        if (!known && !OPERATOR.test(head)) return null;
        const evidence = Boolean(comment || columns) || COMMAND_EVIDENCE.test(head);
        if (!evidence && !(head.split(/\s+/).length <= 3 && (indent >= 2 || inner))) return null;
        let html = this.renderCommand(head);
        if (comment) html += `<span class="sc-comment">${this.ctx.escapeHtml(comment[2])}</span>`;
        else if (columns) html += `${columns[2] ?? ""}<span class="sc-desc">${this.inline(columns[3] ?? "")}</span>`;
        return { cls: "cmd", html: raw.slice(0, indent) + html };
    }

    /** The text after a `$ `: the command, then a `# comment` or a far-right description. */
    private commandWithTrail(rest: string): string {
        const comment = COMMENT_SPLIT.exec(rest);
        if (comment) return this.renderCommand(comment[1] ?? "") + `<span class="sc-comment">${this.ctx.escapeHtml(comment[2])}</span>`;
        const columns = COLUMN_SPLIT.exec(rest);
        if (columns) return this.renderCommand(columns[1] ?? "") + `${columns[2] ?? ""}<span class="sc-desc">${this.inline(columns[3] ?? "")}</span>`;
        return this.renderCommand(rest);
    }

    /** Box-drawing panels: the frame runs dimmed, a border's text as the panel's title, interiors classified on their own. */
    private boxLine(raw: string): ProseLine {
        const esc = this.ctx.escapeHtml;
        const border = BOX_TOP.test(raw) || BOX_BOTTOM.test(raw);
        let html = "";
        let last = 0;
        FRAME_RUN.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = FRAME_RUN.exec(raw))) {
            html += this.boxText(raw.slice(last, m.index), border);
            html += `<span class="sc-frame">${esc(m[0])}</span>`;
            last = m.index + m[0].length;
        }
        html += this.boxText(raw.slice(last), border);
        return { cls: "box", html };
    }

    private boxText(segment: string, border: boolean): string {
        if (!segment) return "";
        if (!segment.trim()) return this.ctx.escapeHtml(segment);
        if (border) return `<span class="sc-box-title">${this.inline(segment)}</span>`;
        const inner = this.body(segment, segment.trim(), true);
        return inner.cls === "text" ? inner.html : `<span class="sc-${inner.cls}">${inner.html}</span>`;
    }

    // ── code ───────────────────────────────────────────────────────────
    /** A shell script (an encounter read with cat): comments, commands, and the heredoc's story as plain text. */
    private scriptLine(raw: string, trimmed: string): ProseLine {
        const esc = this.ctx.escapeHtml;
        if (this.heredoc) {
            if (trimmed === this.heredoc) {
                this.heredoc = null;
                return { cls: "heredoc", html: `<span class="sc-op">${esc(raw)}</span>` };
            }
            return { cls: "text", html: this.inline(raw) };
        }
        if (trimmed.startsWith("#")) return { cls: "comment", html: esc(raw) };
        const first = trimmed.split(/\s+/)[0] ?? "";
        const known = this.ctx.commands.has(first) || first.startsWith("./");
        const commandish = known || KEYWORDS.has(first) || /^[A-Za-z_]\w*=/.test(first) || /^[{}]$/.test(first) || /^\w+\s*\(\)/.test(trimmed);
        if (!commandish) return { cls: "text", html: this.inline(raw) };
        const here = HEREDOC.exec(trimmed);
        if (here) this.heredoc = here[1] ?? null;
        const indent = raw.length - raw.trimStart().length;
        return { cls: "cmd", html: raw.slice(0, indent) + this.renderCommand(raw.slice(indent), known) };
    }

    /** Inside a Markdown fence: `$ cmd` and known commands light up, anything else is code. */
    private codeLine(raw: string, trimmed: string): ProseLine {
        const prompt = PROMPT_LINE.exec(raw);
        if (prompt) {
            return { cls: "cmd", html: `${prompt[1] ?? ""}<span class="sc-prompt">$</span>${prompt[3] ?? ""}${this.commandWithTrail(prompt[4] ?? "")}` };
        }
        const first = trimmed.split(/\s+/)[0] ?? "";
        if (this.ctx.commands.has(first) || first.startsWith("./")) {
            const indent = raw.length - raw.trimStart().length;
            return { cls: "cmd", html: raw.slice(0, indent) + this.renderCommand(raw.slice(indent)) };
        }
        return { cls: "codeline", html: this.ctx.escapeHtml(raw) };
    }

    /** Syntax colour for one command line: name, flags, paths, strings, variables, operators. */
    private renderCommand(text: string, fill = true): string {
        const esc = this.ctx.escapeHtml;
        let html = "";
        let expectName = true;
        for (const token of text.match(TOKEN) ?? []) {
            if (/^\s+$/.test(token)) {
                html += token;
                continue;
            }
            let cls: string;
            if (OPERATORS.has(token)) {
                cls = "sc-op";
                expectName = true;
            } else if (expectName) {
                if (KEYWORDS.has(token)) cls = "sc-kw";
                else {
                    cls = "sc-cmd-name";
                    expectName = false;
                }
            } else if (/^['"]/.test(token)) cls = "sc-str";
            else if (token.startsWith("$")) cls = "sc-var";
            else if (token.length > 1 && token.startsWith("-")) cls = "sc-flag";
            else if (/\/|^\.\.?$|^~/.test(token)) cls = "sc-path";
            else cls = "sc-arg";
            html += `<span class="${cls}">${esc(token)}</span>`;
        }
        const attrs = fill ? ` data-fill="${esc(text.trim())}" title="Click to type this"` : "";
        return `<span class="sc-cmd"${attrs}>${html}</span>`;
    }

    // ── inline ─────────────────────────────────────────────────────────
    /** **Bold** may wrap `code` ("**`/` means a directory**"), so it is found on the raw line first. */
    private inline(raw: string): string {
        let html = "";
        let last = 0;
        BOLD.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = BOLD.exec(raw))) {
            html += this.plain(raw.slice(last, m.index));
            html += `<span class="sc-mark">**</span><strong class="sc-strong">${this.plain(m[1] ?? "")}</strong><span class="sc-mark">**</span>`;
            last = m.index + m[0].length;
        }
        return html + this.plain(raw.slice(last));
    }

    /** `code` chips (castable when they start with a command), emphasis and $VARs in the text between. */
    private plain(raw: string): string {
        let html = "";
        let last = 0;
        CODE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CODE.exec(raw))) {
            html += this.emphasis(raw.slice(last, m.index));
            html += codeChip(m[1] ?? "", "`", this.ctx);
            last = m.index + m[0].length;
        }
        return html + this.emphasis(raw.slice(last));
    }

    private emphasis(raw: string): string {
        return this.ctx.escapeHtml(raw)
            .replace(VAR, '<span class="sc-var">$&</span>')
            .replace(ITALIC, '$1<span class="sc-mark">*</span><em class="sc-em">$2</em><span class="sc-mark">*</span>');
    }
}

function castable(code: string, ctx: ProseContext): boolean {
    const first = commandOf(code);
    return Boolean(first) && (ctx.commands.has(first) || first.startsWith("./"));
}

function codeChip(code: string, mark: string, ctx: ProseContext): string {
    const escaped = ctx.escapeHtml(code);
    const attrs = castable(code, ctx) ? ` data-fill="${escaped}" title="Click to type this"` : "";
    return `<span class="sc-mark">${mark}</span><span class="sc-code"${attrs}>${escaped}</span><span class="sc-mark">${mark}</span>`;
}

/** A whole file as the log would show it: one classified span per line. */
export function renderProseHtml(text: string, ctx: ProseContext): string {
    const decorator = new ProseDecorator(ctx);
    return text
        .split("\n")
        .map((raw) => {
            const { cls, html } = decorator.line(raw);
            return `<span class="sc sc-${cls}">${html}</span>`;
        })
        .join("\n");
}

const LIGHT = /`([^`\n]+)`|'([a-z][\w. -]{0,30}?)'/g;

/**
 * The runtime's own messages ("Try `ls -la`", "Type 'map' for…"): code in
 * backticks becomes a chip, a quoted word does too when the shell knows it.
 * Returns null when there is nothing to do, so the span is left untouched.
 */
export function inlineLight(raw: string, ctx: ProseContext): string | null {
    if (!raw.includes("`") && !raw.includes("'")) return null;
    const esc = ctx.escapeHtml;
    let html = "";
    let last = 0;
    let changed = false;
    LIGHT.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LIGHT.exec(raw))) {
        const code = m[1] ?? m[2] ?? "";
        if (m[1] === undefined && !castable(code, ctx)) continue;
        html += esc(raw.slice(last, m.index));
        html += m[1] !== undefined
            ? codeChip(code, "`", ctx)
            : `'<span class="sc-code" data-fill="${esc(code)}" title="Click to type this">${esc(code)}</span>'`;
        last = m.index + m[0].length;
        changed = true;
    }
    return changed ? html + esc(raw.slice(last)) : null;
}
