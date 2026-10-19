/* Bashcrawl Learn — the Learn mode view: a lesson reader beside the terminal.
 *
 * The reader is a VIEW over the story runtime. It renders the active course's
 * current lesson (Markdown → HTML, objectives, hints) or the course catalogue,
 * and every control on it either types a command for you (data-run) or drops
 * one into the prompt (data-fill). The curriculum plugin
 * (termforge/core/curriculum.js) owns the state; this file never changes it.
 * Loaded after hud.js; shell.js owns the instance.
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

    // ── view helpers ────────────────────────────────────────────────────
    function chip(command, label, extra) {
        return `<button type="button" class="tui-button cmd-chip${extra ? ` ${extra}` : ""}" data-run="${escapeHtml(command)}">${escapeHtml(label || command)}</button>`;
    }

    function levelBadge(level) {
        return `<span class="learn-level learn-level-${escapeHtml(level)}">${escapeHtml(level)}</span>`;
    }

    function progressOf(runtime, courseId) {
        const learn = runtime.state.learn && typeof runtime.state.learn === "object" ? runtime.state.learn : {};
        const p = (learn.progress || {})[courseId];
        return p && typeof p === "object" ? p : null;
    }

    function courseCard(runtime, course, n) {
        const p = progressOf(runtime, course.id);
        const done = p ? (Array.isArray(p.done) ? p.done.length : 0) : 0;
        const total = course.lessons.length;
        const complete = Boolean(p && p.complete);
        const active = runtime.state.learn && runtime.state.learn.active === course.id;
        const status = complete ? "done" : p ? "started" : "fresh";
        const pct = total ? Math.round((complete ? total : done) / total * 100) : 0;
        const byId = new Map((runtime.courses || []).map((c) => [c.id, c]));
        const after = (course.requires || [])
            .filter((id) => byId.has(id) && !(progressOf(runtime, id) && progressOf(runtime, id).complete))
            .map((id) => byId.get(id).title);
        const cta = complete ? "✅ Complete — replay" : active ? "▶ Continue" : p ? "▶ Resume" : "Start";
        const skills = (course.skills || []).slice(0, 6).map((s) => `<code>${escapeHtml(s)}</code>`).join(" ");
        return `<button type="button" class="learn-card learn-card-${status}${active ? " is-active" : ""}" data-run="learn ${escapeHtml(course.id)}">`
            + `<span class="learn-card-top">${levelBadge(course.level)}<span class="learn-card-n">Course ${n}</span></span>`
            + `<strong>${escapeHtml(course.title)}</strong>`
            + `<span class="learn-card-summary">${escapeHtml(course.summary || "")}</span>`
            + (skills ? `<span class="learn-card-skills">${skills}</span>` : "")
            + `<span class="learn-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></span>`
            + `<span class="learn-card-meta">${complete ? total : done}/${total} lessons${after.length ? ` · best after ${escapeHtml(after.join(", "))}` : ""}</span>`
            + `<span class="learn-card-cta">${cta}</span>`
            + "</button>";
    }

    class LearnView {
        constructor(options) {
            const opts = options || {};
            this.reader = opts.reader || null;
            this._sig = "";
            this._page = "";
            this._met = [];
        }

        // Repaints only when the lesson model changed (a command that leaves
        // the course alone leaves the reader alone — no flicker, no lost scroll).
        render(runtime, force) {
            if (!this.reader || !runtime || !global.BashcrawlHud) return false;
            const model = global.BashcrawlHud.lessonModel(runtime);
            const metNow = model.active && model.objectives ? model.objectives.map((o) => o.met) : [];
            const sig = JSON.stringify([model.active, model.courseId, model.n, metNow, model.complete, model.completed,
                model.lessonsDone, model.active ? String(runtime.state.cwd).startsWith(model.lab) : null]);
            if (!force && sig === this._sig) return false;
            const page = model.active ? `${model.courseId}/${model.complete ? "done" : model.n}` : "catalogue";
            const samePage = page === this._page;
            const freshlyMet = samePage ? metNow.map((met, i) => met && !this._met[i]) : [];
            this._sig = sig;
            this._page = page;
            this._met = metNow;
            let html;
            if (!model.active) html = this.catalogueHtml(runtime);
            else if (model.complete) html = this.courseDoneHtml(runtime, model);
            else html = this.lessonHtml(runtime, model, freshlyMet);
            this.reader.innerHTML = html;
            if (!samePage) {
                this.reader.scrollTop = 0;
                this.reader.classList.remove("is-entering");
                void this.reader.offsetWidth;
                this.reader.classList.add("is-entering");
            }
            return true;
        }

        catalogueHtml(runtime) {
            const courses = runtime.courses || [];
            const done = courses.filter((c) => progressOf(runtime, c.id) && progressOf(runtime, c.id).complete).length;
            const cards = courses.map((course, i) => courseCard(runtime, course, i + 1)).join("");
            return `<header class="learn-head learn-hero">`
                + `<p class="learn-crumb">🎓 Learn</p>`
                + `<h2>Guided courses</h2>`
                + `<p class="learn-sub">${courses.length} courses, each with a lab of real files at <code>/lab/&lt;course&gt;</code>. `
                + `Read on this side, type on the other: every objective is checked as you work. ${done}/${courses.length} complete.</p>`
                + `</header>`
                + `<div class="learn-cards">${cards}</div>`
                + `<p class="learn-foot kind-dim">Prefer the keyboard? <code data-fill="learn">learn</code> lists the courses, `
                + `<code data-fill="learn navigator">learn navigator</code> starts the first one. Progress is saved in this browser.</p>`;
        }

        lessonHtml(runtime, model, freshlyMet) {
            const course = (runtime.courses || []).find((c) => c.id === model.courseId);
            if (!course) return this.catalogueHtml(runtime);
            const lesson = course.lessons[model.n - 1];
            const p = progressOf(runtime, course.id) || {};
            const done = Array.isArray(p.done) ? p.done : [];
            const inLab = String(runtime.state.cwd).startsWith(model.lab);
            const outline = course.lessons.map((l, i) => {
                const cls = done.includes(l.id) ? "is-done" : i === model.n - 1 ? "is-current" : "is-todo";
                const icon = done.includes(l.id) ? "✓" : i + 1;
                return `<li class="${cls}" title="${escapeHtml(l.title)}"><span>${icon}</span></li>`;
            }).join("");
            const teaches = (lesson.teaches || []).map((t) => `<code>${escapeHtml(t)}</code>`).join(" ");
            const objectives = (model.objectives || []).map((obj, i) => (
                `<li class="${obj.met ? "obj-met" : "obj-open"}${freshlyMet[i] ? " is-new" : ""}">`
                + `<span class="obj-mark">${obj.met ? "✔" : "○"}</span><span>${inlineHtml(obj.text)}</span></li>`
            )).join("");
            const next = model.met === model.objectives.length
                ? `<p class="learn-next kind-success">All objectives met — the next lesson opens on your next command.</p>`
                : "";
            return `<header class="learn-head">`
                + `<p class="learn-crumb"><button type="button" class="learn-link" data-run="learn">🎓 Courses</button> › ${escapeHtml(course.title)} ${levelBadge(course.level)}</p>`
                + `<h2>${escapeHtml(lesson.title)}</h2>`
                + `<p class="learn-sub">Lesson ${model.n} of ${model.total}${teaches ? ` · teaches ${teaches}` : ""}</p>`
                + `<ol class="learn-outline" aria-label="Lessons in this course">${outline}</ol>`
                + `</header>`
                + `<article class="learn-body">${renderMarkdown(lesson.body)}</article>`
                + `<section class="learn-objectives" aria-label="Objectives">`
                + `<h3>Objectives <span class="learn-count">${model.met}/${model.objectives.length}</span></h3>`
                + `<ul>${objectives}</ul>${next}`
                + `<p class="learn-actions">`
                + (inLab ? "" : chip(`cd ${model.lab}`, `Go to the lab: cd ${model.lab}`, "cmd-chip-primary"))
                + chip("lesson hint", "💡 Hint")
                + chip("lab reset", "Reset lab files")
                + chip("learn quit", "Pause course")
                + `</p>`
                + `</section>`;
        }

        courseDoneHtml(runtime, model) {
            const courses = runtime.courses || [];
            const remaining = courses.filter((c) => !(progressOf(runtime, c.id) && progressOf(runtime, c.id).complete));
            const cards = remaining.map((course) => courseCard(runtime, course, courses.indexOf(course) + 1)).join("");
            return `<header class="learn-head learn-done">`
                + `<p class="learn-crumb"><button type="button" class="learn-link" data-run="learn">🎓 Courses</button></p>`
                + `<h2>✅ ${escapeHtml(model.course)} complete</h2>`
                + `<p class="learn-sub">${model.total} lessons done. ${model.completed}/${courses.length} courses complete.</p>`
                + `</header>`
                + (remaining.length
                    ? `<section><h3>Keep going</h3><div class="learn-cards">${cards}</div></section>`
                    : `<section><h3>That is every course.</h3><p>Type <code data-fill="skills">skills</code> for your skill map, `
                      + `<code data-fill="review">review</code> to keep it sharp, or take the Story door and descend.</p></section>`)
                + `<p class="learn-actions">${chip("skills", "Skill map")}${chip("review", "Review")}${chip("learn", "All courses")}</p>`;
        }
    }

    global.BashcrawlLearn = { LearnView, renderMarkdown, inlineHtml };
})(window);
