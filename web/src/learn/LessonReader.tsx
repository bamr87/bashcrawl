// The Learn door's reader: a view over Hud.lessonModel. The course
// catalogue as cards, the active lesson (Markdown through the engine's
// renderer, an outline, the objectives ticking as you type, the actions),
// and the course-complete page. Every control runs a command or drops one
// into the prompt; the curriculum plugin owns the state.
import { motion } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { requireEngine } from "../engine";
import { game, useModel, type GameStore } from "../engine/game-store";
import type { Course, LessonModel } from "../engine/types";
import { Chip } from "../hud/Chip";
import { handleChipClick } from "../terminal/actions";

function progressOf(store: GameStore, courseId: string) {
    const learn = store.runtime?.state.learn;
    const p = learn?.progress?.[courseId];
    return p && typeof p === "object" ? p : null;
}

function courses(store: GameStore): Course[] {
    return store.runtime?.courses ?? [];
}

function LevelBadge({ level }: { level: string }) {
    return <span className={`bc-level bc-level-${level}`}>{level}</span>;
}

function CourseCard({ store, course, n }: { store: GameStore; course: Course; n: number }) {
    const p = progressOf(store, course.id);
    const done = p ? (Array.isArray(p.done) ? p.done.length : 0) : 0;
    const total = course.lessons.length;
    const complete = Boolean(p && p.complete);
    const active = store.runtime?.state.learn?.active === course.id;
    const status = complete ? "done" : p ? "started" : "fresh";
    const pct = total ? Math.round(((complete ? total : done) / total) * 100) : 0;
    const byId = new Map(courses(store).map((c) => [c.id, c]));
    const after = (course.requires ?? [])
        .filter((id) => byId.has(id) && !progressOf(store, id)?.complete)
        .map((id) => byId.get(id)?.title ?? id);
    const cta = complete ? "✅ Complete — replay" : active ? "▶ Continue" : p ? "▶ Resume" : "Start";
    return (
        <motion.button
            type="button"
            className={`bc-course bc-frame bc-course-${status}${active ? " is-active" : ""}`}
            data-run={`learn ${course.id}`}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        >
            <span className="bc-course-top">
                <LevelBadge level={course.level} />
                <span className="bc-course-n">Course {n}</span>
            </span>
            <strong>{course.title}</strong>
            <span className="bc-course-summary">{course.summary ?? ""}</span>
            {course.skills?.length ? (
                <span className="bc-course-skills">{course.skills.slice(0, 6).map((s) => <code key={s}>{s}</code>)}</span>
            ) : null}
            <span className="bc-course-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% complete`}>
                <span style={{ width: `${pct}%` }} />
            </span>
            <span className="bc-course-meta">
                {complete ? total : done}/{total} lessons{after.length ? ` · best after ${after.join(", ")}` : ""}
            </span>
            <span className="bc-course-cta">{cta}</span>
        </motion.button>
    );
}

function Catalogue({ store }: { store: GameStore }) {
    const all = courses(store);
    const done = all.filter((c) => progressOf(store, c.id)?.complete).length;
    return (
        <>
            <header className="bc-learn-head bc-learn-hero">
                <p className="bc-learn-crumb">🎓 Learn</p>
                <h2 className="bc-display">Guided courses</h2>
                <p className="bc-learn-sub">
                    {all.length} courses, each with a lab of real files at <code>/lab/&lt;course&gt;</code>. Read on this side, type on the other: every objective is checked as you work. {done}/{all.length} complete.
                </p>
            </header>
            <div className="bc-courses">
                {all.map((course, i) => <CourseCard key={course.id} store={store} course={course} n={i + 1} />)}
            </div>
            <p className="bc-learn-foot bc-muted">
                Prefer the keyboard? <code data-fill="learn">learn</code> lists the courses, <code data-fill="learn navigator">learn navigator</code> starts the first one. Progress is saved in this browser.
            </p>
        </>
    );
}

function LessonPage({ store, model, freshlyMet }: { store: GameStore; model: LessonModel; freshlyMet: boolean[] }) {
    const course = courses(store).find((c) => c.id === model.courseId);
    const n = model.n ?? 1;
    const lesson = course?.lessons[n - 1];
    if (!course || !lesson) return <Catalogue store={store} />;
    const html = requireEngine().BashcrawlLearn?.renderMarkdown(lesson.body) ?? "";
    const p = progressOf(store, course.id);
    const done = Array.isArray(p?.done) ? p.done : [];
    const lab = model.lab ?? `/lab/${course.id}`;
    const inLab = String(store.runtime?.state.cwd ?? "").startsWith(lab);
    const objectives = model.objectives ?? [];
    const met = model.met ?? 0;
    return (
        <>
            <header className="bc-learn-head">
                <p className="bc-learn-crumb">
                    <Chip run="learn" store={store}>🎓 Courses</Chip>
                    <span aria-hidden="true">›</span> {course.title} <LevelBadge level={course.level} />
                </p>
                <h2 className="bc-display">{lesson.title}</h2>
                <p className="bc-learn-sub">
                    Lesson {n} of {model.total}{lesson.teaches?.length ? <> · teaches {lesson.teaches.map((t) => <code key={t}>{t}</code>)}</> : null}
                </p>
                <ol className="bc-outline" aria-label="Lessons in this course">
                    {course.lessons.map((l, i) => {
                        const cls = done.includes(l.id) ? "is-done" : i === n - 1 ? "is-current" : "is-todo";
                        return <li key={l.id} className={cls} title={l.title}><span>{done.includes(l.id) ? "✓" : i + 1}</span></li>;
                    })}
                </ol>
            </header>
            {/* The engine escapes lesson text before it marks it up (learn.js, tested). */}
            <article className="learn-body" dangerouslySetInnerHTML={{ __html: html }} />
            <section className="bc-objectives bc-frame" aria-label="Objectives">
                <h3>Objectives <span className="bc-objectives-count">{met}/{objectives.length}</span></h3>
                <ul>
                    {objectives.map((obj, i) => (
                        <motion.li
                            key={obj.text}
                            className={`${obj.met ? "obj-met" : "obj-open"}${freshlyMet[i] ? " is-new" : ""}`}
                            animate={freshlyMet[i] ? { x: [0, 4, 0], scale: [1, 1.02, 1] } : { x: 0, scale: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <span className="obj-mark" aria-hidden="true">{obj.met ? "✔" : "○"}</span>
                            <span dangerouslySetInnerHTML={{ __html: requireEngine().BashcrawlLearn?.inlineHtml(obj.text) ?? obj.text }} />
                        </motion.li>
                    ))}
                </ul>
                {met === objectives.length && objectives.length > 0 && (
                    <p className="bc-learn-next bc-success">All objectives met — the next lesson opens on your next command.</p>
                )}
                <p className="bc-chips bc-learn-actions">
                    {!inLab && <Chip run={`cd ${lab}`} primary store={store}>Go to the lab: cd {lab}</Chip>}
                    <Chip run="lesson hint" store={store}>💡 Hint</Chip>
                    <Chip run="lab reset" store={store}>Reset lab files</Chip>
                    <Chip run="learn quit" store={store}>Pause course</Chip>
                </p>
            </section>
        </>
    );
}

function CourseDone({ store, model }: { store: GameStore; model: LessonModel }) {
    const all = courses(store);
    const remaining = all.filter((c) => !progressOf(store, c.id)?.complete);
    return (
        <>
            <header className="bc-learn-head bc-learn-done">
                <p className="bc-learn-crumb"><Chip run="learn" store={store}>🎓 Courses</Chip></p>
                <h2 className="bc-display">✅ {model.course} complete</h2>
                <p className="bc-learn-sub">{model.total} lessons done. {model.completed}/{all.length} courses complete.</p>
            </header>
            {remaining.length ? (
                <section>
                    <h3>Keep going</h3>
                    <div className="bc-courses">
                        {remaining.map((course) => <CourseCard key={course.id} store={store} course={course} n={all.indexOf(course) + 1} />)}
                    </div>
                </section>
            ) : (
                <section>
                    <h3>That is every course.</h3>
                    <p>Type <code data-fill="skills">skills</code> for your skill map, <code data-fill="review">review</code> to keep it sharp, or take the Story door and descend.</p>
                </section>
            )}
            <p className="bc-chips bc-learn-actions">
                <Chip run="skills" store={store}>Skill map</Chip>
                <Chip run="review" store={store}>Review</Chip>
                <Chip run="learn" store={store}>All courses</Chip>
            </p>
        </>
    );
}

function sameFlags(a: boolean[], b: boolean[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function LessonReader({ store = game }: { store?: GameStore }) {
    const model = useModel("lessonModel", store);
    const page = model.active ? `${model.courseId}/${model.complete ? "done" : model.n}` : "catalogue";
    const metNow = model.active && model.objectives ? model.objectives.map((o) => o.met) : [];
    // Which objectives were met by the last command: derived from the
    // previous render's flags, adjusted during render (no ref, no effect).
    const [memo, setMemo] = useState({ page, met: metNow, fresh: [] as boolean[] });
    if (memo.page !== page || !sameFlags(memo.met, metNow)) {
        setMemo({ page, met: metNow, fresh: memo.page === page ? metNow.map((m, i) => m && !memo.met[i]) : [] });
    }
    const freshlyMet = memo.page === page ? memo.fresh : [];
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) ref.current.scrollTop = 0;
    }, [page]);

    function onClick(event: MouseEvent<HTMLDivElement>) {
        // Chips handle themselves; this catches the renderer's data-fill codes.
        if ((event.target as HTMLElement).closest(".bc-chip")) return;
        handleChipClick(event, store);
    }

    return (
        <div ref={ref} className="bc-reader" aria-label="Lesson reader" onClick={onClick}>
            {/* Keyed on the page: a new page slides in; the old one is simply replaced. */}
            <motion.div
                key={page}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            >
                {!model.active ? <Catalogue store={store} /> : model.complete ? <CourseDone store={store} model={model} /> : <LessonPage store={store} model={model} freshlyMet={freshlyMet} />}
            </motion.div>
        </div>
    );
}
