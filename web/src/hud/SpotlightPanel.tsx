// What THIS room teaches (rooms.yaml `teaches` / `essential_commands`):
// concept tags and one-line cheats that drop into the prompt.
import { game, useGame, type GameStore } from "../engine/game-store";
import type { EssentialCommand } from "../engine/types";
import { Chip } from "./Chip";

export function SpotlightPanelBody({ store = game }: { store?: GameStore }) {
    useGame((snap) => snap.version, store);
    const meta = store.runtime?.currentRoomMeta() ?? {};
    const teaches = meta.teaches ?? [];
    const essentials = (meta.essential_commands ?? []).slice(0, 4).map((entry): EssentialCommand => (
        typeof entry === "string" ? { command: entry } : entry
    ));
    if (!teaches.length && !essentials.length) {
        return <p className="bc-muted">Explore on — each room highlights the concepts it teaches.</p>;
    }
    return (
        <>
            {teaches.length > 0 && (
                <p className="bc-tags">
                    {teaches.map((t) => <span key={t} className="bc-tag">{t}</span>)}
                </p>
            )}
            {essentials.map((entry) => (
                <p key={entry.command} className="bc-cheat">
                    <Chip fill={entry.command} store={store}>{entry.command}</Chip>
                    {entry.description && <span className="bc-muted"> {entry.description}</span>}
                </p>
            ))}
        </>
    );
}
