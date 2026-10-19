// The active quest at a glance, and the full main/side log folded under it.
import { game, useModel, type GameStore } from "../engine/game-store";

export function QuestPanelBody({ store = game }: { store?: GameStore }) {
    const quest = useModel("questModel", store);
    return (
        <>
            {quest.current ? (
                <>
                    <p className="bc-quest-title">{quest.current.title}</p>
                    <p className="bc-quest-objective">{quest.current.objective}</p>
                    <p className="bc-muted bc-quest-xp">{quest.mainDone}/{quest.mainTotal} complete · {quest.xp} XP</p>
                </>
            ) : (
                <>
                    <p className="bc-quest-title bc-success">All quests complete.</p>
                    <p className="bc-muted bc-quest-xp">{quest.xp} XP earned.</p>
                </>
            )}
            <details className="bc-quest-log">
                <summary>Quest log — {quest.mainDone}/{quest.mainTotal} main · {quest.sideDone}/{quest.side.length} side</summary>
                <p className="bc-group-label">Main quests</p>
                <ul className="bc-list">
                    {quest.rows.map((row) => (
                        <li key={row.title} className={`bc-ql-${row.status}`}><span aria-hidden="true">{row.icon} </span>{row.title}</li>
                    ))}
                </ul>
                <p className="bc-group-label">Side quests</p>
                <ul className="bc-list">
                    {quest.side.map((side) => (
                        <li key={side.key} className={side.done ? "bc-ql-done" : "bc-ql-side"} title={side.hint}><span aria-hidden="true">{side.icon} </span>{side.name}</li>
                    ))}
                </ul>
            </details>
        </>
    );
}
