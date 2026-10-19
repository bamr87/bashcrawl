// The active lesson's checklist (or the invitation to start a course).
import { game, useModel, type GameStore } from "../engine/game-store";
import { Chip } from "./Chip";

export function LessonPanelBody({ store = game }: { store?: GameStore }) {
    const lesson = useModel("lessonModel", store);
    if (!lesson.active) {
        return (
            <>
                <p>{lesson.courses} courses, each with its own lab of real files to practise on.</p>
                <p className="bc-chips">
                    <Chip goto="learn" primary store={store}>🎓 Open Learn</Chip>
                    <Chip run="learn navigator" store={store}>Start: Finding Your Way</Chip>
                </p>
            </>
        );
    }
    if (lesson.complete) {
        return (
            <>
                <p className="bc-success"><strong>{lesson.course}</strong> ✅ complete</p>
                <p className="bc-chips"><Chip goto="learn" primary store={store}>🎓 Pick the next course</Chip></p>
            </>
        );
    }
    const objectives = lesson.objectives ?? [];
    return (
        <>
            <p className="bc-quest-title">{lesson.course}</p>
            <p className="bc-muted">Lesson {lesson.n}/{lesson.total}: {lesson.title} · {lesson.met}/{objectives.length}</p>
            <ul className="bc-list">
                {objectives.map((obj) => (
                    <li key={obj.text} className={obj.met ? "bc-ql-done" : "bc-ql-side"}><span aria-hidden="true">{obj.met ? "✔" : "○"} </span>{obj.text}</li>
                ))}
            </ul>
            <p className="bc-chips">
                <Chip goto="learn" primary store={store}>📖 Reader</Chip>
                <Chip run="lesson hint" store={store}>Hint</Chip>
                {lesson.lab && <Chip run={`cd ${lesson.lab}`} store={store}>Go to lab</Chip>}
            </p>
        </>
    );
}
