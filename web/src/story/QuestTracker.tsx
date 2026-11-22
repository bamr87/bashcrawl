// The objective tracker in the stage's corner, as every RPG keeps one: the
// active quest, its objective, its checklist when it has one, and the spell
// that advances it, with the chronicle's chapter count. Click the spell to
// drop it into the prompt. It stands in for the sidebar's Quest panel: while
// that panel is open beside the log it says the same thing, and a second
// copy would only sit on top of the log's text, so the tracker stays away
// until the panel is hidden or folded.
import { useEffect, useRef } from "react";

import { game, useGame, useModel, type GameStore } from "../engine/game-store";
import { registerAnchor } from "../fx/anchors";
import { QuestSteps } from "../hud/QuestSteps";
import { fillCommand } from "../terminal/actions";
import { ROAD_KEYS } from "./chronicle";
import { useJournal } from "./journal-store";

export function QuestTracker({ store = game }: { store?: GameStore }) {
    useGame((snap) => snap.version, store);
    const quest = useModel("questModel", store);
    const trackerRef = useRef<HTMLElement>(null);
    const panel = store.layout().panes.find((pane) => pane.id === "quest");
    const shown = !(panel?.visible && !panel.collapsed);
    useEffect(() => registerAnchor("tracker", trackerRef.current), [shown]);
    const suggestions = useModel("suggestionsModel", store);
    const journal = useJournal();
    const spell = suggestions.find((row) => row.kind === "quest")?.cmd ?? null;
    const chapters = ROAD_KEYS.filter((key) => journal.entries.some((entry) => entry.id === `chapter:${key}`)).length;
    const done = quest.current == null;
    if (!shown) return null;
    return (
        <aside ref={trackerRef} className="bc-tracker" data-done={done || undefined} aria-label="Current objective" aria-live="polite">
            <p className="bc-tracker-kicker">{done ? "Main road walked" : `Quest ${quest.mainDone + 1} of ${quest.mainTotal}`} · chapter {chapters}/{ROAD_KEYS.length}</p>
            <p className="bc-tracker-title">{quest.current ? quest.current.title : "All quests complete"}</p>
            <p className="bc-tracker-objective">{quest.current ? quest.current.objective : "The halls beyond the rift still wait."}</p>
            {quest.current && <QuestSteps steps={quest.current.steps} className="bc-tracker-steps" />}
            {spell && (
                <button type="button" className="bc-chip bc-chip-quest" onClick={() => fillCommand(spell)} title="Drop this spell into the prompt">
                    <span aria-hidden="true">◆ </span>{spell}
                </button>
            )}
        </aside>
    );
}
