(function (global, factory) {
    "use strict";
    const hasCjs = typeof module !== "undefined" && module.exports && typeof require === "function";
    const rules = hasCjs ? require("./rules.js") : global.TermForge.rules;
    const api = factory(rules);
    if (hasCjs) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.curriculum = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (rules) {
    "use strict";
    // TermForge curriculum — courses, lessons and objectives over a live shell.
    //
    // A course is data (compiled from Markdown files with YAML frontmatter,
    // one file per lesson, the way bashOS keeps one command per .md file):
    //
    //   { id, title, summary, level, order, requires, skills, xp,
    //     intro,                                   // markdown
    //     lab: { dirs: ["sub"], files: { "sub/file": "content" } },
    //     lessons: [{ id, title, teaches, xp, body,  // body: markdown
    //                 objectives: [{ text, when, hint, solution, allow_errors }] }] }
    //
    // Objectives are TermForge rules (core/rules.js) checked after every
    // command (with the command's context) and again after every line (state
    // and filesystem only — so `sort x > y` satisfies "y exists" on the same
    // line). Any order; once met, met. A lesson whose objectives are all met
    // completes, awards its XP, and the next lesson becomes current.
    //
    // Each course brings a lab: its files are seeded into the session overlay
    // under <root>/<course id>/ (default /lab/...) — real, writable session
    // files, so lessons can teach `>`, `mv` and `rm` on something that is
    // safe to break. `lab reset` restores it.

    const LEVELS = ["beginner", "intermediate", "advanced"];

    // Markdown -> Line records for a terminal: headings stand out, fenced
    // code is indented, emphasis markers drop, `inline code` keeps its ticks
    // (they are how a terminal shows "type this").
    const EMPHASIS = [
        [/\*\*([^*]+)\*\*/g, "$1"],
        [/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?=[^*\w]|$)/g, "$1$2"],
        [/(^|\W)_([^_]+)_(?=\W|$)/g, "$1$2"],
        [/\[([^\]]+)\]\([^)]+\)/g, "$1"],
    ];
    // Emphasis is stripped outside code spans only: `*.txt` is a glob.
    function inlineText(s) {
        return String(s).split(/(`[^`]*`)/).map((part, i) => (
            i % 2 ? part : EMPHASIS.reduce((acc, [re, to]) => acc.replace(re, to), part)
        )).join("");
    }

    function markdownLines(md) {
        const out = [];
        const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
        let para = [];
        let code = null;
        const flush = () => {
            if (para.length) out.push({ kind: "output", text: para.join("\n") });
            para = [];
        };
        const inline = inlineText;
        for (const raw of lines) {
            if (code) {
                if (/^\s*```/.test(raw)) {
                    out.push({ kind: "info", text: code.map((l) => `    ${l}`).join("\n") });
                    code = null;
                } else code.push(raw);
                continue;
            }
            if (/^\s*```/.test(raw)) { flush(); code = []; continue; }
            const heading = /^(#{1,6})\s+(.*)$/.exec(raw);
            if (heading) { flush(); out.push({ kind: "magic", text: inline(heading[2]) }); continue; }
            if (!raw.trim()) { flush(); continue; }
            const bullet = /^\s*[-*]\s+(.*)$/.exec(raw);
            para.push(bullet ? `  • ${inline(bullet[1])}` : inline(raw));
        }
        if (code) out.push({ kind: "info", text: code.map((l) => `    ${l}`).join("\n") });
        flush();
        return out;
    }

    /** Structural check of a compiled course list. Returns error strings. */
    function validateCourses(courses) {
        const errors = [];
        const ids = new Set();
        (courses || []).forEach((course, ci) => {
            const at = `course ${course && course.id ? course.id : `#${ci}`}`;
            if (!course || typeof course !== "object") { errors.push(`${at}: must be an object`); return; }
            if (typeof course.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(course.id)) errors.push(`${at}: id must be kebab-case`);
            else if (ids.has(course.id)) errors.push(`${at}: duplicate id`);
            ids.add(course.id);
            if (typeof course.title !== "string" || !course.title) errors.push(`${at}: needs a title`);
            if (!LEVELS.includes(course.level)) errors.push(`${at}: level must be one of ${LEVELS.join(", ")}`);
            if (!Array.isArray(course.lessons) || !course.lessons.length) { errors.push(`${at}: needs at least one lesson`); return; }
            const lessonIds = new Set();
            course.lessons.forEach((lesson, li) => {
                const lat = `${at} lesson ${lesson && lesson.id ? lesson.id : `#${li}`}`;
                if (!lesson || typeof lesson.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(lesson.id)) errors.push(`${lat}: id must be kebab-case`);
                else if (lessonIds.has(lesson.id)) errors.push(`${lat}: duplicate id`);
                if (lesson) lessonIds.add(lesson.id);
                if (!lesson || typeof lesson.title !== "string" || !lesson.title) errors.push(`${lat}: needs a title`);
                if (!lesson || !Array.isArray(lesson.objectives) || !lesson.objectives.length) {
                    errors.push(`${lat}: needs at least one objective`);
                    return;
                }
                lesson.objectives.forEach((obj, oi) => {
                    const oat = `${lat} objective ${oi + 1}`;
                    if (!obj || typeof obj.text !== "string" || !obj.text) errors.push(`${oat}: needs text`);
                    if (!obj || typeof obj.solution !== "string" || !obj.solution.trim()) errors.push(`${oat}: needs a solution (a command line that meets it)`);
                    errors.push(...rules.validate(obj && obj.when, `${oat}.when`));
                });
            });
            for (const req of course.requires || []) {
                if (typeof req !== "string") errors.push(`${at}: requires must list course ids`);
            }
        });
        for (const course of courses || []) {
            for (const req of (course && course.requires) || []) {
                if (typeof req === "string" && !ids.has(req)) errors.push(`course ${course.id}: requires unknown course ${req}`);
            }
        }
        return errors;
    }

    const DEFAULT_TEXT = {
        learnTitle: (done, total) => `🎓 Courses — ${done}/${total} complete`,
        learnRow: (n, icon, title, level, progress) => `  ${String(n).padStart(2)}. ${icon} ${title}  ·  ${level}  ·  ${progress}`,
        learnSummary: (summary) => `        ${summary}`,
        learnAfter: (titles) => `        best after: ${titles.join(", ")}`,
        learnFooter: "learn NAME (or number) to start or resume · lesson to read the current lesson",
        learnUnknown: (name) => `No such course: ${name}. Type learn to see them all.`,
        learnNone: "No course is active. Type learn to pick one.",
        learnPaused: (title) => `Paused ${title}. Your progress is kept — learn resumes it.`,
        learnEnrolled: (title) => `🎓 Enrolled: ${title}`,
        learnResumed: (title) => `🎓 Resuming: ${title}`,
        learnRestarted: (title) => `${title}: progress and lab reset.`,
        learnLab: (path) => `Your lab is ${path} — real files you can read, change and break. Start with: cd ${path}`,
        learnAlreadyDone: (title) => `${title} is complete. learn restart NAME to take it again.`,
        lessonHeader: (course, n, total, title) => `📘 ${course} · Lesson ${n}/${total}: ${title}`,
        lessonObjectives: "Objectives:",
        lessonFooter: "lesson hint · lesson list · lab · learn",
        lessonHint: (text, hint) => `💡 ${text}: ${hint}`,
        lessonNoHint: "Every objective here is met.",
        lessonOutline: (title) => `📘 ${title} — lessons`,
        lessonOutOfRange: (n) => `There is no lesson ${n} in this course.`,
        lessonSkipped: (title) => `↷ Skipped ${title} (no XP).`,
        objectiveMet: (text) => `✔ Objective: ${text}`,
        lessonDone: (title, xp) => `🎓 Lesson complete: ${title}${xp ? `  +${xp} XP` : ""}`,
        lessonNext: (n, total, title) => `📘 Next up — Lesson ${n}/${total}: ${title}. Type lesson to read it.`,
        courseDone: (title, xp) => `🏆 Course complete: ${title}!${xp ? `  +${xp} XP` : ""}`,
        courseNext: "Type learn to choose your next course.",
        labPath: (path) => `🧪 Lab: ${path}  (cd ${path} · lab reset restores it)`,
        labReset: (path) => `🧪 Lab restored: ${path}`,
        labNone: "No course is active, so there is no lab. Type learn to pick one.",
    };

    /**
     * options:
     *   courses: compiled course list (validateCourses-clean)
     *   root:    lab mount root (default "/lab")
     *   award(shell, amount, reason)  XP sink (default: shell.awardXp if present)
     */
    function plugin(options) {
        const opts = options || {};
        const courses = (opts.courses || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));
        const byId = new Map(courses.map((c) => [c.id, c]));
        const root = (opts.root || "/lab").replace(/\/+$/, "");
        const award = typeof opts.award === "function"
            ? opts.award
            : (shell, amount, reason) => { if (typeof shell.awardXp === "function") shell.awardXp(amount, reason); };
        const pending = new WeakMap(); // shell -> Line[] queued by postCommand
        const currentLine = new WeakMap(); // shell -> the input line being run

        function slice(shell) { return shell.pluginState("curriculum"); }
        function progressOf(shell, id) {
            const s = slice(shell);
            if (!s.progress[id]) s.progress[id] = { lesson: 0, met: [], done: [], complete: false };
            return s.progress[id];
        }
        function active(shell) {
            const s = slice(shell);
            const course = s.active ? byId.get(s.active) : null;
            if (!course) return null;
            const p = progressOf(shell, course.id);
            return { course, p, lesson: course.lessons[p.lesson] || null };
        }
        function labPath(course) { return `${root}/${course.id}`; }

        function seedLab(shell, course, reset) {
            const nodes = shell.state.userNodes;
            const base = labPath(course);
            if (reset) {
                for (const path of Object.keys(nodes)) if (path === base || path.startsWith(`${base}/`)) delete nodes[path];
            }
            const lab = course.lab || {};
            const ensureDir = (path) => { if (!nodes[path]) nodes[path] = { type: "dir" }; };
            ensureDir(root);
            ensureDir(base);
            for (const dir of (lab.dirs || []).slice().sort()) {
                let acc = base;
                for (const part of dir.split("/").filter(Boolean)) { acc += `/${part}`; ensureDir(acc); }
            }
            for (const [rel, content] of Object.entries(lab.files || {})) {
                const path = `${base}/${rel}`;
                const parts = rel.split("/").filter(Boolean);
                let acc = base;
                for (const part of parts.slice(0, -1)) { acc += `/${part}`; ensureDir(acc); }
                if (reset || !nodes[path]) nodes[path] = { type: "file", content: String(content) };
            }
        }

        function lessonLines(shell, course, index, p) {
            const lesson = course.lessons[index];
            const current = p && p.lesson === index && !p.complete;
            const doneIds = p ? p.done : [];
            const out = [{ kind: "magic", text: shell.text("lessonHeader", course.title, index + 1, course.lessons.length, lesson.title) }];
            out.push(...markdownLines(lesson.body));
            out.push({ kind: "info", text: shell.text("lessonObjectives") });
            lesson.objectives.forEach((obj, i) => {
                const met = doneIds.includes(lesson.id) || (current && p.met.includes(i));
                out.push({ kind: met ? "success" : "dim", text: `  ${met ? "✅" : "○ "} ${obj.text}` });
            });
            out.push({ kind: "dim", text: shell.text("lessonFooter") });
            return out;
        }

        function catalogue(shell) {
            const s = slice(shell);
            const done = courses.filter((c) => s.progress[c.id] && s.progress[c.id].complete).length;
            const out = [{ kind: "magic", text: shell.text("learnTitle", done, courses.length) }];
            courses.forEach((course, i) => {
                const p = s.progress[course.id];
                const icon = p && p.complete ? "✅" : s.active === course.id ? "▶" : "○";
                const progress = `${p ? p.done.length : 0}/${course.lessons.length} lessons`;
                out.push({ kind: s.active === course.id ? "info" : "output", text: shell.text("learnRow", i + 1, icon, course.title, course.level, progress) });
                if (course.summary) out.push({ kind: "dim", text: shell.text("learnSummary", course.summary) });
                const after = (course.requires || []).filter((id) => byId.has(id) && !(s.progress[id] && s.progress[id].complete));
                if (after.length) out.push({ kind: "dim", text: shell.text("learnAfter", after.map((id) => byId.get(id).title)) });
            });
            out.push({ kind: "dim", text: shell.text("learnFooter") });
            return out;
        }

        function findCourse(name) {
            if (/^\d+$/.test(name)) return courses[Number(name) - 1] || null;
            return byId.get(name) || null;
        }

        function enroll(shell, course) {
            const s = slice(shell);
            const fresh = !s.progress[course.id];
            const p = progressOf(shell, course.id);
            s.active = course.id;
            seedLab(shell, course, false);
            const out = [{ kind: "success", text: shell.text(fresh ? "learnEnrolled" : "learnResumed", course.title) }];
            if (fresh) shell.emit("course.enrolled", { course: course.id, title: course.title });
            if (p.complete) {
                out.push({ kind: "dim", text: shell.text("learnAlreadyDone", course.title) });
                return out;
            }
            if (fresh && course.intro) out.push(...markdownLines(course.intro));
            out.push({ kind: "info", text: shell.text("learnLab", labPath(course)) });
            const lesson = course.lessons[p.lesson];
            shell.emit("lesson.started", { course: course.id, lesson: lesson.id, title: lesson.title });
            out.push(...lessonLines(shell, course, p.lesson, p));
            return out;
        }

        function learn(args) {
            const sub = (args[0] || "").toLowerCase();
            const s = slice(this);
            if (!sub || sub === "list") return catalogue(this);
            if (sub === "quit" || sub === "pause" || sub === "stop") {
                const cur = active(this);
                if (!cur) return [{ kind: "dim", text: this.text("learnNone") }];
                s.active = null;
                return [{ kind: "dim", text: this.text("learnPaused", cur.course.title) }];
            }
            if (sub === "restart") {
                const course = findCourse(String(args[1] || s.active || ""));
                if (!course) return [{ kind: "error", text: this.text("learnUnknown", args[1] || "") }];
                s.progress[course.id] = { lesson: 0, met: [], done: [], complete: false };
                s.completed = s.completed.filter((id) => id !== course.id);
                seedLab(this, course, true);
                s.active = course.id;
                return [{ kind: "success", text: this.text("learnRestarted", course.title) }, ...lessonLines(this, course, 0, s.progress[course.id])];
            }
            const course = findCourse(args[0]);
            if (!course) return [{ kind: "error", text: this.text("learnUnknown", args[0]) }];
            return enroll(this, course);
        }

        function lesson(args) {
            const cur = active(this);
            if (!cur) return [{ kind: "dim", text: this.text("learnNone") }];
            const { course, p } = cur;
            const sub = (args[0] || "").toLowerCase();
            if (sub === "list") {
                const out = [{ kind: "magic", text: this.text("lessonOutline", course.title) }];
                course.lessons.forEach((l, i) => {
                    const icon = p.done.includes(l.id) ? "✅" : i === p.lesson && !p.complete ? "▶" : "○";
                    out.push({ kind: i === p.lesson ? "info" : "output", text: `  ${String(i + 1).padStart(2)}. ${icon} ${l.title}` });
                });
                return out;
            }
            if (/^\d+$/.test(sub)) {
                const n = Number(sub);
                if (n < 1 || n > course.lessons.length) return [{ kind: "error", text: this.text("lessonOutOfRange", n) }];
                return lessonLines(this, course, n - 1, p);
            }
            if (p.complete) return [{ kind: "dim", text: this.text("learnAlreadyDone", course.title) }];
            const current = course.lessons[p.lesson];
            if (sub === "hint") {
                const idx = current.objectives.findIndex((_, i) => !p.met.includes(i));
                if (idx < 0) return [{ kind: "dim", text: this.text("lessonNoHint") }];
                const obj = current.objectives[idx];
                return [{ kind: "magic", text: this.text("lessonHint", obj.text, obj.hint || `try \`${obj.solution}\``) }];
            }
            if (sub === "skip") {
                const out = [{ kind: "dim", text: this.text("lessonSkipped", current.title) }];
                return out.concat(advance(this, course, p, false));
            }
            return lessonLines(this, course, p.lesson, p);
        }

        function lab(args) {
            const cur = active(this);
            if (!cur) return [{ kind: "dim", text: this.text("labNone") }];
            if ((args[0] || "").toLowerCase() === "reset") {
                seedLab(this, cur.course, true);
                return [{ kind: "success", text: this.text("labReset", labPath(cur.course)) }];
            }
            seedLab(this, cur.course, false);
            return [{ kind: "info", text: this.text("labPath", labPath(cur.course)) }];
        }

        // Move past the current lesson (completed or skipped).
        function advance(shell, course, p, earned) {
            const out = [];
            const current = course.lessons[p.lesson];
            if (earned) {
                if (!p.done.includes(current.id)) p.done.push(current.id);
                const xp = current.xp == null ? 25 : Number(current.xp);
                if (xp) award(shell, xp, "lesson");
                shell.emit("lesson.completed", { course: course.id, lesson: current.id, title: current.title, xp });
                out.push({ kind: "success", text: shell.text("lessonDone", current.title, xp) });
            }
            p.met = [];
            p.lesson += 1;
            if (p.lesson >= course.lessons.length) {
                p.lesson = course.lessons.length - 1;
                p.complete = true;
                const s = slice(shell);
                if (!s.completed.includes(course.id)) s.completed.push(course.id);
                const bonus = course.xp == null ? 50 : Number(course.xp);
                if (bonus) award(shell, bonus, "course");
                shell.emit("course.completed", { course: course.id, title: course.title });
                out.push({ kind: "success", text: shell.text("courseDone", course.title, bonus) });
                out.push({ kind: "dim", text: shell.text("courseNext") });
                return out;
            }
            const next = course.lessons[p.lesson];
            shell.emit("lesson.started", { course: course.id, lesson: next.id, title: next.title });
            out.push({ kind: "magic", text: shell.text("lessonNext", p.lesson + 1, course.lessons.length, next.title) });
            return out;
        }

        // Mark objectives met in `ctx`; returns the announcement lines.
        function check(shell, ctx) {
            const cur = active(shell);
            if (!cur || cur.p.complete || !cur.lesson) return [];
            const { course, p, lesson: current } = cur;
            const failed = Array.isArray(ctx.outputs) && ctx.outputs.some((o) => o && o.kind === "error");
            const out = [];
            current.objectives.forEach((obj, i) => {
                if (p.met.includes(i)) return;
                if (failed && !obj.allow_errors) return;
                if (!rules.evaluate(obj.when, ctx)) return;
                p.met.push(i);
                shell.emit("objective.completed", { course: course.id, lesson: current.id, objective: i, text: obj.text });
                out.push({ kind: "success", text: shell.text("objectiveMet", obj.text) });
            });
            return out;
        }

        function queue(shell, lines) {
            if (!lines.length) return;
            const list = pending.get(shell) || [];
            list.push(...lines);
            pending.set(shell, list);
        }

        return {
            id: "curriculum",
            name: "Curriculum",
            version: "1.0.0",
            description: "Courses of lessons with checked objectives, each with its own lab.",
            commands: { learn, lesson, lab },
            meta: {
                learn: { summary: "browse courses; learn NAME starts or resumes one", usage: "learn [NAME|N|quit|restart NAME]", group: "learn" },
                lesson: { summary: "read the current lesson and its objectives", usage: "lesson [hint|list|skip|N]", group: "learn" },
                lab: { summary: "where the active course's practice files live", usage: "lab [reset]", group: "learn" },
            },
            hooks: {
                preExecute(line) { currentLine.set(this, line); },
                postCommand(cmd, args, stdin, outputs) {
                    queue(this, check(this, { state: this.state, cmd, args, stdin, outputs, line: currentLine.get(this) || "", shell: this }));
                },
                postExecute(line, outputs) {
                    currentLine.delete(this);
                    const out = pending.get(this) || [];
                    pending.delete(this);
                    // A redirect writes after its command ran; state and
                    // filesystem objectives get a second look per line.
                    const failed = outputs.some((o) => o && o.kind === "error");
                    if (!failed) out.push(...check(this, { state: this.state, line, shell: this }));
                    const cur = active(this);
                    if (cur && !cur.p.complete && cur.lesson && cur.lesson.objectives.every((_, i) => cur.p.met.includes(i))) {
                        out.push(...advance(this, cur.course, cur.p, true));
                    }
                    return out;
                },
            },
            uiText: DEFAULT_TEXT,
            state: {
                key: "learn",
                defaults: () => ({ active: null, progress: {}, completed: [] }),
                sanitize(s) {
                    const progress = {};
                    if (s.progress && typeof s.progress === "object" && !Array.isArray(s.progress)) {
                        for (const [id, raw] of Object.entries(s.progress)) {
                            const course = byId.get(id);
                            if (!course || !raw || typeof raw !== "object") continue;
                            const lessonIds = new Set(course.lessons.map((l) => l.id));
                            const lesson = Number.isInteger(raw.lesson) && raw.lesson >= 0 && raw.lesson < course.lessons.length ? raw.lesson : 0;
                            const count = course.lessons[lesson].objectives.length;
                            progress[id] = {
                                lesson,
                                met: Array.isArray(raw.met) ? raw.met.filter((i) => Number.isInteger(i) && i >= 0 && i < count) : [],
                                done: Array.isArray(raw.done) ? raw.done.filter((l) => lessonIds.has(l)) : [],
                                complete: raw.complete === true,
                            };
                        }
                    }
                    s.progress = progress;
                    if (typeof s.active !== "string" || !byId.has(s.active)) s.active = null;
                    // `completed` is derived from progress, so the two never disagree.
                    s.completed = Array.isArray(s.completed)
                        ? s.completed.filter((id, i, all) => progress[id] && progress[id].complete && all.indexOf(id) === i) : [];
                },
            },
        };
    }

    return { plugin, validateCourses, markdownLines, inlineText, LEVELS, DEFAULT_TEXT };
});
