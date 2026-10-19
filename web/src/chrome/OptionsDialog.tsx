// ⚙ Options: the preferences form plus the things a player reaches for in
// a game's options menu — replay the intro, take the tour again, reset the
// HUD layout, see the keys.
import { navigate } from "../app/useHashRoute";
import { game, type GameStore } from "../engine/game-store";
import { Dialog } from "./Dialog";
import { SettingsForm } from "./SettingsForm";
import { closeOverlay, openOverlay, setUi, startTour, useUi } from "./ui-store";

export function OptionsDialog({ store = game }: { store?: GameStore }) {
    const { overlay } = useUi();
    return (
        <Dialog open={overlay === "options"} title="Options" onClose={closeOverlay} className="bc-options">
            <SettingsForm />
            <div className="bc-opt-actions" role="group" aria-label="More">
                <button type="button" className="bc-btn" onClick={() => openOverlay("intro")}>Replay the intro</button>
                <button type="button" className="bc-btn" onClick={() => { closeOverlay(); navigate("story"); startTour(); }}>Take the tour</button>
                <button type="button" className="bc-btn" onClick={() => store.applyLayout({ op: "reset" })}>Reset HUD layout</button>
                <button type="button" className="bc-btn" onClick={() => { closeOverlay(); setUi({ helpOpen: true }); }}>Keyboard shortcuts</button>
            </div>
        </Dialog>
    );
}
