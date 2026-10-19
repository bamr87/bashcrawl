// The Learn door: the lesson reader beside the same story terminal, with a
// slimmer sidebar (the lab's files, skills, the hero).
import { useEffect, useRef } from "react";

import { game, useGame, type GameStore } from "../engine/game-store";
import { registerAnchor } from "../fx/anchors";
import { Sidebar } from "../hud/Sidebar";
import { LessonReader } from "../learn/LessonReader";
import { TerminalLog } from "../terminal/TerminalLog";

const LEARN_PANES = ["room", "skills", "hero"];

export function LearnScreen({ store = game }: { store?: GameStore }) {
    useGame((snap) => snap.version, store);
    const stageRef = useRef<HTMLDivElement>(null);
    useEffect(() => registerAnchor("stage", stageRef.current), []);
    useEffect(() => registerAnchor("lesson", document.querySelector<HTMLElement>(".bc-objectives")), []);
    return (
        <section className="bc-story bc-learn" aria-label="Learn" data-dock={store.layout().dock}>
            <Sidebar store={store} only={LEARN_PANES} />
            <LessonReader store={store} />
            <div ref={stageRef} className="bc-stage-log bc-stage-learn">
                <TerminalLog store={store} label="Lab terminal" />
                <pre className="px-am" aria-hidden="true" />
            </div>
        </section>
    );
}
