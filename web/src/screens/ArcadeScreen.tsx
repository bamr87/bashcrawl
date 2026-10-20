// The Arcade door: side panels beside the floor (the cards) or the trial's
// own log, on the same stage frame as the story so command clips play here.
// A Vim Catacombs trial puts its buffer above the log. Floor and trial swap
// with a slide.
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import { ArcadeHome } from "../arcade/ArcadeHome";
import { BestScoresPanel, CheatsPanel, ObjectivePanel, RunStatsPanel } from "../arcade/ArcadePanels";
import { useArcade, type ArcadeStore } from "../arcade/arcade-store";
import { VimStage } from "../arcade/VimStage";
import { registerAnchor } from "../fx/anchors";
import { TerminalLog } from "../terminal/TerminalLog";

export function ArcadeScreen({ store }: { store: ArcadeStore }) {
    const phase = useArcade((snap) => snap.phase, store);
    const stageRef = useRef<HTMLDivElement>(null);
    const vim = useArcade((snap) => snap.gameId === "vim" && snap.phase !== "home", store);
    const home = phase === "home";
    useEffect(() => registerAnchor("stage", stageRef.current), [phase]);
    return (
        <section className="bc-story bc-arcade" aria-label="Practice Arcade">
            <aside className="bc-sidebar" aria-label="Arcade status panels">
                <ObjectivePanel store={store} />
                <RunStatsPanel store={store} />
                <CheatsPanel store={store} />
                <BestScoresPanel store={store} />
            </aside>
            <motion.div key={home ? "home" : "trial"} className="bc-screen" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}>
                {home ? (
                    <ArcadeHome store={store} />
                ) : (
                    <div ref={stageRef} className={`bc-stage-log${vim ? " bc-stage-log-vim" : ""}`}>
                        {vim && <VimStage store={store} />}
                        <TerminalLog store={store} label="Trial log" />
                        <pre className="px-am" aria-hidden="true" />
                    </div>
                )}
            </motion.div>
        </section>
    );
}
