// The hero's profile: the figure, a rename, the look and the path, the
// sheet (rank, XP, health, quests, badges, rooms, spells cast, pack), and
// the game's own menu — title screen, options, the tour, a new game.
import { useState, type FormEvent } from "react";

import { navigate } from "../app/useHashRoute";
import { Dialog } from "../chrome/Dialog";
import { closeOverlay, openOverlay, startTour, useUi } from "../chrome/ui-store";
import { game, useGame, type GameStore } from "../engine/game-store";
import { Gauge } from "../hud/Gauge";
import { HeroFigure } from "./HeroFigure";
import { clearHero, LOOKS, NAME_MAX, ROLES, roleMeta, setHero, useHero, type Hero, type HeroRole } from "./hero-store";

function spellsCast(store: GameStore): number {
    const stats = (store.runtime?.state.stats ?? {}) as { commands?: Record<string, number> };
    return Object.values(stats.commands ?? {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

function ProfileBody({ store, hero }: { store: GameStore; hero: Hero }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(hero.name);
    const [confirming, setConfirming] = useState(false);
    const status = store.model("statusModel");
    const meta = roleMeta(hero.role);
    const next = status.nextRank ? `${status.nextRank.remaining} XP to ${status.nextRank.title}` : "highest rank reached";

    function save(event: FormEvent) {
        event.preventDefault();
        setHero({ name: draft });
        setEditing(false);
    }
    function newGame() {
        store.newRun();
        clearHero();
        openOverlay("create");
    }

    return (
        <div className="bc-profile">
            <div className="bc-profile-card bc-frame-sunken">
                <HeroFigure look={hero.look} size="lg" label={`${hero.name}, ${meta.title}`} />
                <div className="bc-profile-id">
                    {editing ? (
                        <form className="bc-name-row" onSubmit={save}>
                            <label className="bc-visually-hidden" htmlFor="hero-rename">New name</label>
                            <input id="hero-rename" value={draft} maxLength={NAME_MAX} autoFocus onChange={(event) => setDraft(event.target.value)} />
                            <button type="submit" className="bc-btn bc-btn-primary">Save</button>
                            <button type="button" className="bc-btn" onClick={() => setEditing(false)}>Cancel</button>
                        </form>
                    ) : (
                        <div className="bc-profile-row">
                            <h3 className="bc-display">{hero.name}</h3>
                            <button type="button" className="bc-btn" onClick={() => { setDraft(hero.name); setEditing(true); }}>Rename</button>
                        </div>
                    )}
                    <p className="bc-muted"><span aria-hidden="true">{meta.icon} </span>{meta.title} — {meta.trait}</p>
                    <div className="bc-profile-row" role="radiogroup" aria-label="Look">
                        <span className="bc-opt-label">Look</span>
                        {LOOKS.map((label, index) => (
                            <button key={label} type="button" role="radio" aria-checked={index === hero.look} className="bc-swatch" data-look={index} onClick={() => setHero({ look: index })}>{label}</button>
                        ))}
                    </div>
                    <div className="bc-profile-row">
                        <label className="bc-opt-label" htmlFor="hero-path">Path</label>
                        <select id="hero-path" value={hero.role} onChange={(event) => setHero({ role: event.target.value as HeroRole })}>
                            {ROLES.map((entry) => <option key={entry.id} value={entry.id}>{entry.icon} {entry.title}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <dl className="bc-profile-stats">
                <div><dt>Rank</dt><dd>{status.rank} · Lv {status.level}</dd></div>
                <div><dt>Experience</dt><dd><Gauge value={status.pct} max={100} label={`${status.pct}% of the way to the next rank`} tone="xp" className="bc-gauge-wide" /><span>{status.xp} XP · {next}</span></dd></div>
                <div><dt>Health</dt><dd><Gauge value={status.hp} max={status.hpMax} label={`Health ${status.hp} of ${status.hpMax}`} tone="hp" className="bc-gauge-wide" /><span>{status.hp} / {status.hpMax}</span></dd></div>
                <div><dt>Quests</dt><dd>{status.questsDone} / {status.questsTotal}</dd></div>
                <div><dt>Badges</dt><dd>{status.badges} / {status.badgeTotal}</dd></div>
                <div><dt>Rooms found</dt><dd>{store.runtime?.state.visited.length ?? 0}</dd></div>
                <div><dt>Spells cast</dt><dd>{spellsCast(store)}</dd></div>
                <div><dt>Pack</dt><dd>{store.runtime?.state.inventory.join(", ") || "empty"}</dd></div>
                <div><dt>Hero since</dt><dd>{new Date(hero.created).toLocaleDateString()}</dd></div>
            </dl>

            <div className="bc-opt-actions" role="group" aria-label="Game">
                <button type="button" className="bc-btn" onClick={() => openOverlay("title")}>Title screen</button>
                <button type="button" className="bc-btn" onClick={() => openOverlay("options")}>Options</button>
                <button type="button" className="bc-btn" onClick={() => { closeOverlay(); navigate("story"); startTour(); }}>Take the tour</button>
                {confirming ? (
                    <span className="bc-confirm" role="group" aria-label="Confirm new game">
                        <span>Forget {hero.name}'s progress?</span>
                        <button type="button" className="bc-btn bc-btn-danger" onClick={newGame}>Yes, start over</button>
                        <button type="button" className="bc-btn" onClick={() => setConfirming(false)}>Keep playing</button>
                    </span>
                ) : (
                    <button type="button" className="bc-btn bc-btn-danger" onClick={() => setConfirming(true)}>New game…</button>
                )}
            </div>
            <p className="bc-muted bc-profile-save">Carry progress to another browser: <code>save export</code> prints a token, <code>save import TOKEN</code> restores it.</p>
        </div>
    );
}

export function ProfileDialog({ store = game }: { store?: GameStore }) {
    const { overlay } = useUi();
    const hero = useHero();
    const phase = useGame((snap) => snap.phase, store);
    useGame((snap) => snap.version, store);
    const open = overlay === "profile" && hero != null && phase === "ready";
    return (
        <Dialog open={open} title="Hero" onClose={closeOverlay} className="bc-profile-dialog">
            {hero && <ProfileBody store={store} hero={hero} />}
        </Dialog>
    );
}
