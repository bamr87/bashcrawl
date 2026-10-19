// The Story door: the HUD sidebar beside the dungeon log (the sidebar's
// panels arrive with the HUD step; the stage's .px-am is the band where
// command clips play).
import { game, type GameStore } from "../engine/game-store";
import { TerminalLog } from "../terminal/TerminalLog";

export function StoryScreen({ store = game }: { store?: GameStore }) {
    return (
        <section className="bc-story" aria-label="Story dungeon">
            <aside className="bc-sidebar" aria-label="Game status panels" />
            <div className="bc-stage-log" data-fx-anchor="stage">
                <TerminalLog store={store} label="Dungeon log" />
                <pre className="px-am" aria-hidden="true" />
            </div>
        </section>
    );
}
