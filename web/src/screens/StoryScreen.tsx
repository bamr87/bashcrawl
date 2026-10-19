// The Story door: the HUD sidebar beside the dungeon log. The stage's
// .px-am is the band where command clips play; the sidebar docks left or
// right per the saved layout.
import { useEffect, useRef } from "react";

import { game, useGame, type GameStore } from "../engine/game-store";
import { registerAnchor } from "../fx/anchors";
import { Sidebar } from "../hud/Sidebar";
import { ScrollCue } from "../terminal/ScrollCue";
import { TerminalLog } from "../terminal/TerminalLog";

export function StoryScreen({ store = game }: { store?: GameStore }) {
    useGame((snap) => snap.version, store);
    const stageRef = useRef<HTMLDivElement>(null);
    useEffect(() => registerAnchor("stage", stageRef.current), []);
    const dock = store.layout().dock;
    return (
        <section className="bc-story" aria-label="Story dungeon" data-dock={dock}>
            <Sidebar store={store} />
            <div ref={stageRef} className="bc-stage-log">
                <TerminalLog store={store} label="Dungeon log" />
                <pre className="px-am" aria-hidden="true" />
                <ScrollCue store={store} />
            </div>
        </section>
    );
}
