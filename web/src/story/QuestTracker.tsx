// The objective tracker in the stage's corner, as every RPG keeps one: the
// active quest, its objective, and the spell that advances it, with the
// chronicle's chapter count. Click the spell to drop it into the prompt.
import { game, useGame, useModel, type GameStore } from "../engine/game-store";
import { fillCommand } from "../terminal/actions";
import { ROAD_KEYS } from "./chronicle";
import { useJournal } from "./journal-store";

export function QuestTracker({ store = game }: { store?: GameStore }) {
    useGame((snap) => snap.version, store);
    const quest = useModel("questModel", store);
    const suggestions = useModel("suggestionsModel", store);
    const journal = useJournal();
    const spell = suggestions.find((row) => row.kind === "quest")?.cmd ?? null;
    const chapters = ROAD_KEYS.filter((key) => journal.entries.some((entry) => entry.id === `chapter:${key}`)).length;
    const done = quest.current == null;
    return (
        <aside className="bc-tracker" data-done={done || undefined} aria-label="Current objective" aria-live="polite">
            <p className="bc-tracker-kicker">{done ? "Main road walked" : `Quest ${quest.mainDone + 1} of ${quest.mainTotal}`} · chapter {chapters}/{ROAD_KEYS.length}</p>
            <p className="bc-tracker-title">{quest.current ? quest.current.title : "All quests complete"}</p>
            <p className="bc-tracker-objective">{quest.current ? quest.current.objective : "The halls beyond the rift still wait."}</p>
            {spell && (
                <button type="button" className="bc-chip bc-chip-quest" onClick={() => fillCommand(spell)} title="Drop this spell into the prompt">
                    <span aria-hidden="true">◆ </span>{spell}
                </button>
            )}
        </aside>
    );
}
