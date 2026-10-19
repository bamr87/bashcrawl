// The Arcade door: side panels beside the floor (the cards) or the trial's
// own log, on the same stage frame as the story so command clips play here.
import { useEffect, useRef } from "react";

import { ArcadeHome } from "../arcade/ArcadeHome";
import { BestScoresPanel, CheatsPanel, ObjectivePanel, RunStatsPanel } from "../arcade/ArcadePanels";
import { useArcade, type ArcadeStore } from "../arcade/arcade-store";
import { registerAnchor } from "../fx/anchors";
import { TerminalLog } from "../terminal/TerminalLog";

export function ArcadeScreen({ store }: { store: ArcadeStore }) {
    const phase = useArcade((snap) => snap.phase, store);
    const stageRef = useRef<HTMLDivElement>(null);
    useEffect(() => registerAnchor("stage", stageRef.current), [phase]);
    return (
        <section className="bc-story bc-arcade" aria-label="Practice Arcade">
            <aside className="bc-sidebar" aria-label="Arcade status panels">
                <ObjectivePanel store={store} />
                <RunStatsPanel store={store} />
                <CheatsPanel store={store} />
                <BestScoresPanel store={store} />
            </aside>
            {phase === "home" ? (
                <ArcadeHome store={store} />
            ) : (
                <div ref={stageRef} className="bc-stage-log">
                    <TerminalLog store={store} label="Trial log" />
                    <pre className="px-am" aria-hidden="true" />
                </div>
            )}
        </section>
    );
}
