/* Bashcrawl Learn — the lesson Markdown renderer.
 *
 * Lessons are Markdown (docs/authoring-courses.md); this turns the subset
 * they use into HTML the web reader shows. Text is escaped first, so lesson
 * copy cannot inject markup; inline code and code-block lines become
 * clickable (data-fill drops the command into the prompt). The reader itself
 * is a React component (web/src/learn/LessonReader.tsx) over Hud.lessonModel;
 * the curriculum plugin (termforge/core/curriculum.js) owns the state.
 * Loaded as a classic script; node tests load it the same way.
 */
(function initLearn(global) {
    const escapeHtml = (value) => global.TermForge.sinks.escapeHtml(String(value == null ? "" : value));

    // ── Markdown → HTML: the subset lessons use (docs/authoring-courses.md).
    // Text is escaped first; inline code becomes a clickable <code data-fill>.
    const INLINE = [
        [/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"],
        [/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?=[^*\w]|$)/g, "$1<em>$2</em>"],
        [/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>"],
        [/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'],
        [/\[([^\]]+)\]\([^)]*\)/g, "$1"],
    ];

    function inlineHtml(text) {
        return escapeHtml(text).split(/(`[^`]*`)/).map((part, i) => {
            if (i % 2) {
                const code = part.slice(1, -1);
                return `<code class="learn-code-inline" data-fill="${code}" title="Click to put it in the prompt">${code}</code>`;
            }
            return INLINE.reduce((acc, [re, to]) => acc.replace(re, to), part);
        }).join("");
    }

    const CALLOUT = /^\**(Real world|Tip|Note|Why|Try it|Careful)\**:\**\s*(.*)$/i;

    function renderMarkdown(md) {
        const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
        const out = [];
        let para = [];
        let list = null;
        let code = null;
        const closeList = () => { if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; } };
        const flush = () => {
            if (para.length) out.push(`<p>${inlineHtml(para.join(" "))}</p>`);
            para = [];
            closeList();
        };
        const codeBlock = (rows) => `<pre class="learn-code"><code>${rows.map((row) => (
            `<span class="learn-code-line" data-fill="${escapeHtml(row.trim())}">${escapeHtml(row)}</span>`
        )).join("\n")}</code></pre>`;
        for (const raw of lines) {
            if (code) {
                if (/^\s*```/.test(raw)) { out.push(codeBlock(code)); code = null; } else code.push(raw);
                continue;
            }
            if (/^\s*```/.test(raw)) { flush(); code = []; continue; }
            const heading = /^(#{1,6})\s+(.*)$/.exec(raw);
            if (heading) {
                flush();
                const level = Math.min(4, heading[1].length + 2);
                out.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`);
                continue;
            }
            if (!raw.trim()) { flush(); continue; }
            const bullet = /^\s*[-*]\s+(.*)$/.exec(raw);
            if (bullet) {
                if (para.length) { out.push(`<p>${inlineHtml(para.join(" "))}</p>`); para = []; }
                list = list || [];
                list.push(`<li>${inlineHtml(bullet[1])}</li>`);
                continue;
            }
            closeList();
            const callout = CALLOUT.exec(raw);
            if (callout) {
                flush();
                out.push(`<p class="learn-callout"><strong>${escapeHtml(callout[1])}:</strong> ${inlineHtml(callout[2])}</p>`);
                continue;
            }
            para.push(raw);
        }
        if (code) out.push(codeBlock(code));
        flush();
        return out.join("");
    }

    global.BashcrawlLearn = { renderMarkdown, inlineHtml };
})(window);
