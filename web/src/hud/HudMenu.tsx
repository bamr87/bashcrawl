// Personalise the HUD: show or hide panes, dock the sidebar, reset. The
// layout is saved apart from the run (bashcrawl-hud-layout-v1), the same
// store the terminal HUD's `hud` command writes.
import { Dialog } from "../chrome/Dialog";
import { setUi, useUi } from "../chrome/ui-store";
import { game, useGame, type GameStore } from "../engine/game-store";
import { PANE_META } from "./panes";

export function HudMenu({ store = game }: { store?: GameStore }) {
    const { hudOpen } = useUi();
    useGame((snap) => snap.version, store);
    const layout = store.snap.get().phase === "ready" ? store.layout() : null;
    return (
        <Dialog open={hudOpen && layout != null} title="Panels" onClose={() => setUi({ hudOpen: false })}>
            <p className="bc-muted">Click a pane's title to fold it. Untick to hide it. The layout is saved separately from your run.</p>
            <ul className="bc-list bc-hud-panes">
                {layout?.panes.filter((pane) => PANE_META[pane.id]).map((pane) => (
                    <li key={pane.id}>
                        <label>
                            <input
                                type="checkbox"
                                checked={pane.visible}
                                onChange={(event) => store.applyLayout({ op: "toggle", id: pane.id, field: "visible", value: event.target.checked })}
                            />
                            <span aria-hidden="true">{PANE_META[pane.id].icon} </span>{PANE_META[pane.id].title}
                        </label>
                        <span className="bc-hud-pane-actions">
                            <button type="button" className="bc-btn" onClick={() => store.applyLayout({ op: "move", id: pane.id, dir: -1 })} aria-label={`Move ${PANE_META[pane.id].title} up`}>↑</button>
                            <button type="button" className="bc-btn" onClick={() => store.applyLayout({ op: "move", id: pane.id, dir: 1 })} aria-label={`Move ${PANE_META[pane.id].title} down`}>↓</button>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="bc-doors">
                <button type="button" className="bc-btn" aria-pressed={layout?.dock === "left"} onClick={() => store.applyLayout({ op: "dock", side: "left" })}>Dock left</button>
                <button type="button" className="bc-btn" aria-pressed={layout?.dock === "right"} onClick={() => store.applyLayout({ op: "dock", side: "right" })}>Dock right</button>
                <button type="button" className="bc-btn" onClick={() => store.applyLayout({ op: "reset" })}>Reset layout</button>
            </p>
        </Dialog>
    );
}
