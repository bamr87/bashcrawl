// The arcade's side panels: the objective, this run's stats (ticking),
// one-line concept cheats, and the best scores.
import { useEffect, useState } from "react";

import { PanelFrame } from "../hud/PanelFrame";
import type { ArcadeStore } from "./arcade-store";
import { useArcade } from "./arcade-store";

function useFold(): [boolean, () => void] {
    const [collapsed, setCollapsed] = useState(false);
    return [collapsed, () => setCollapsed((c) => !c)];
}

export function ObjectivePanel({ store }: { store: ArcadeStore }) {
    useArcade((snap) => snap.version, store);
    const [collapsed, toggle] = useFold();
    const objective = store.objective();
    return (
        <PanelFrame id="arcade-objective" title="Objective" icon="◆" collapsed={collapsed} onToggle={toggle}>
            {objective ? (
                <>
                    <p className="bc-quest-title">{objective.title}</p>
                    <p>{objective.text}</p>
                </>
            ) : (
                <>
                    <p className="bc-quest-title">Choose a trial</p>
                    <p className="bc-muted">Click a card — or type its name and press Enter.</p>
                </>
            )}
        </PanelFrame>
    );
}

export function RunStatsPanel({ store }: { store: ArcadeStore }) {
    const phase = useArcade((snap) => snap.phase, store);
    useArcade((snap) => snap.version, store);
    const [collapsed, toggle] = useFold();
    const [, setTick] = useState(0);
    useEffect(() => {
        if (phase !== "trial") return;
        const timer = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(timer);
    }, [phase]);
    const stats = store.stats();
    return (
        <PanelFrame id="arcade-stats" title="This run" icon="◎" collapsed={collapsed} onToggle={toggle}>
            {stats ? (
                <ul className="bc-list">
                    <li>Commands: <strong>{stats.moves}</strong></li>
                    <li>Hints: <strong>{stats.hints}</strong></li>
                    <li>Elapsed: <strong>{stats.seconds}s</strong></li>
                </ul>
            ) : (
                <p className="bc-muted">Stats appear during a trial.</p>
            )}
        </PanelFrame>
    );
}

export function CheatsPanel({ store }: { store: ArcadeStore }) {
    useArcade((snap) => snap.version, store);
    const [collapsed, toggle] = useFold();
    const cheats = store.cheats();
    return (
        <PanelFrame id="arcade-cheats" title="Concept cheats" icon="✧" collapsed={collapsed} onToggle={toggle}>
            {cheats.length ? cheats.map(([syntax, note]) => (
                <p key={syntax} className="bc-cheat"><code>{syntax}</code> <span className="bc-muted">{note}</span></p>
            )) : <p className="bc-muted">Concept cheats appear during a trial.</p>}
        </PanelFrame>
    );
}

export function BestScoresPanel({ store }: { store: ArcadeStore }) {
    useArcade((snap) => snap.version, store);
    const [collapsed, toggle] = useFold();
    return (
        <PanelFrame id="arcade-best" title="Best scores" icon="★" collapsed={collapsed} onToggle={toggle}>
            <ul className="bc-list">
                {store.games.map((gameDef) => {
                    const rec = store.records.games[gameDef.id];
                    return (
                        <li key={gameDef.id}>
                            <span aria-hidden="true">{gameDef.icon} </span>{gameDef.title} — {rec?.plays ? <>best <strong>{rec.best}</strong> ({rec.plays})</> : "—"}
                        </li>
                    );
                })}
            </ul>
        </PanelFrame>
    );
}
