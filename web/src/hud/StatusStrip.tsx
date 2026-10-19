// The party status bar under the header: rank with the XP gauge toward the
// next rank, health, quests, badges and a live streak. Every item is a
// button that runs the command behind it, and each is an effects anchor.
import { useEffect, useRef } from "react";

import { setUi, useUi } from "../chrome/ui-store";
import { game, useModel, type GameStore } from "../engine/game-store";
import { registerAnchor } from "../fx/anchors";
import { runCommand } from "../terminal/actions";
import { Gauge } from "./Gauge";
import { RollingNumber } from "./RollingNumber";

export function StatusStrip({ store = game }: { store?: GameStore }) {
    const st = useModel("statusModel", store);
    const { panelsOpen } = useUi();
    const xpRef = useRef<HTMLButtonElement>(null);
    const hpRef = useRef<HTMLButtonElement>(null);
    const rankRef = useRef<HTMLButtonElement>(null);
    const questRef = useRef<HTMLButtonElement>(null);
    useEffect(() => registerAnchor("xp", xpRef.current), []);
    useEffect(() => registerAnchor("hp", hpRef.current), []);
    useEffect(() => registerAnchor("rank", rankRef.current), []);
    useEffect(() => registerAnchor("quest-count", questRef.current), []);

    const next = st.nextRank ? `${st.nextRank.remaining} XP to ${st.nextRank.title}` : "highest rank reached";
    const hpLevel = st.hp <= 25 ? "low" : st.hp <= 50 ? "mid" : "high";
    return (
        <div className="bc-status-bar">
        <div className="bc-status" role="group" aria-label="Hero status">
            <button ref={rankRef} type="button" className="bc-status-item bc-status-rank" onClick={() => runCommand("profile", store)} title={`Rank · level ${st.level} — profile shows your character sheet`} aria-label={`Rank: ${st.rank}, level ${st.level}. Show the character sheet`}>
                <span aria-hidden="true">★</span>
                <span className="bc-status-rank-title">{st.rank}</span>
            </button>
            <button ref={xpRef} type="button" className="bc-status-item bc-status-xp" onClick={() => runCommand("xp", store)} title={next} aria-label={`${st.xp} XP, ${next}`}>
                <Gauge value={st.pct} max={100} label={`${st.pct}% of the way to the next rank`} tone="xp" />
                <span className="bc-status-num"><RollingNumber value={st.xp} /> XP</span>
                <span className="bc-status-sub">{next}</span>
            </button>
            <button ref={hpRef} type="button" className="bc-status-item bc-status-hp" data-level={hpLevel} onClick={() => runCommand("status", store)} title={`Health ${st.hp}/${st.hpMax}`} aria-label={`Health ${st.hp} of ${st.hpMax}. Show status`}>
                <Gauge value={st.hp} max={st.hpMax} label={`Health ${st.hp} of ${st.hpMax}`} tone="hp" />
                <span className="bc-status-num"><span aria-hidden="true">♥ </span><RollingNumber value={st.hp} /></span>
            </button>
            <button ref={questRef} type="button" className="bc-status-item" onClick={() => runCommand("quest", store)} title="Main quests complete — quest shows the objective" aria-label={`${st.questsDone} of ${st.questsTotal} quests complete. Show the quest`}>
                <span aria-hidden="true">⚑ </span>{st.questsDone}/{st.questsTotal}
            </button>
            <button type="button" className="bc-status-item" onClick={() => runCommand("achievements", store)} title="Badges earned — achievements lists them" aria-label={`${st.badges} of ${st.badgeTotal} badges earned. List achievements`}>
                <span aria-hidden="true">🏅 </span>{st.badges}/{st.badgeTotal}
            </button>
            {st.streak > 0 && (
                <button type="button" className="bc-status-item bc-status-streak" data-pending={!st.dailyDone || undefined} onClick={() => runCommand("daily", store)} title={st.dailyDone ? `Daily challenge done — ${st.streak}-day streak` : `Finish today's daily challenge to keep your ${st.streak}-day streak`} aria-label={`${st.streak} day streak${st.dailyDone ? "" : ", today's challenge still open"}. Show the daily challenge`}>
                    <span aria-hidden="true">🔥 </span>{st.streak}
                </button>
            )}
        </div>
            <button
                type="button"
                className="bc-btn bc-panels-toggle"
                aria-expanded={panelsOpen}
                aria-controls="bc-sidebar"
                onClick={() => setUi({ panelsOpen: !panelsOpen })}
            >
                {panelsOpen ? "✕ Close" : "☰ Panels"}
            </button>
        </div>
    );
}
