// The Journal (Alt+J, `journal`, the header): the chronicle so far, the
// quests, the scrolls read, the bestiary and the badges — one dialog, five
// tabs. Chapters render for the hero as they are now; anything with a
// command (a scroll, a hall) can be brought back from here.
import { useCallback, useState } from "react";

import { Dialog } from "../chrome/Dialog";
import { closeOverlay, useUi } from "../chrome/ui-store";
import { game, useGame, type GameStore } from "../engine/game-store";
import { useHero } from "../hero/hero-store";
import { tryCommand } from "../terminal/actions";
import { CHAPTERS, chapterFor, renderChapter, ROAD_KEYS } from "./chronicle";
import { markJournalRead, useJournal, type JournalEntry } from "./journal-store";

const TABS = ["chronicle", "quests", "lore", "bestiary", "badges"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { chronicle: "Chronicle", quests: "Quests", lore: "Lore", bestiary: "Bestiary", badges: "Badges" };

function when(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function retrieve(command: string): void {
    closeOverlay();
    tryCommand(command);
}

function Chronicle({ entries, readAt }: { entries: JournalEntry[]; readAt: string | null }) {
    const hero = useHero();
    const since = readAt ? Date.parse(readAt) : 0;
    const unlocked = new Map(entries.filter((entry) => entry.kind === "chapter").map((entry) => [entry.ref, entry]));
    const halls = CHAPTERS.filter((chapter) => chapter.key.startsWith("room:") && unlocked.has(chapter.key));
    const road = ROAD_KEYS.map((key) => chapterFor(key)).filter((chapter) => chapter != null);
    return (
        <>
            <p className="bc-muted">The main road, chapter by chapter; the halls as you found them. Locked chapters wait for their quest.</p>
            {road.map((chapter) => {
                const entry = unlocked.get(chapter.key);
                const rendered = entry ? renderChapter(chapter, hero) : null;
                return (
                    <article key={chapter.key} className="bc-chapter" data-locked={!entry || undefined} data-unread={entry && Date.parse(entry.when) > since ? true : undefined}>
                        <p className="bc-chapter-kicker">{chapter.numeral.length > 2 ? chapter.numeral : `Chapter ${chapter.numeral}`}{entry ? ` · ${when(entry.when)}` : ""}</p>
                        <h3 className="bc-display">{rendered ? rendered.title : "???"}</h3>
                        {rendered ? rendered.pages.map((page, i) => <p key={i}>{page}</p>) : <p className="bc-muted">Not yet written.</p>}
                        {rendered && chapter.next && <p className="bc-chapter-next">{chapter.next}</p>}
                    </article>
                );
            })}
            {halls.length > 0 && <p className="bc-group-label">Halls</p>}
            {halls.map((chapter) => {
                const entry = unlocked.get(chapter.key);
                const rendered = renderChapter(chapter, hero);
                return (
                    <article key={chapter.key} className="bc-chapter" data-unread={entry && Date.parse(entry.when) > since ? true : undefined}>
                        <p className="bc-chapter-kicker">A hall{entry ? ` · ${when(entry.when)}` : ""}</p>
                        <h3 className="bc-display">{rendered.title}</h3>
                        {rendered.pages.map((page, i) => <p key={i}>{page}</p>)}
                    </article>
                );
            })}
        </>
    );
}

function Quests({ store }: { store: GameStore }) {
    const quest = store.model("questModel");
    const all = store.runtime?.quests ?? [];
    return (
        <>
            <p className="bc-muted">{quest.mainDone}/{quest.mainTotal} main quests · {quest.sideDone}/{quest.side.length} side quests · {quest.xp} XP earned</p>
            {quest.rows.map((row, index) => {
                const detail = all[index];
                return (
                    <div key={row.title} className="bc-journal-row" data-status={row.status}>
                        <span aria-hidden="true">{row.icon}</span>
                        <div>
                            <span className="bc-journal-title">{row.title}</span>
                            {detail && row.status !== "locked" && <small>{detail.objective}</small>}
                            {detail && row.status === "active" && <small>Hint: {detail.hint}</small>}
                        </div>
                        <span className="bc-muted">{detail ? `${detail.xp} XP` : ""}</span>
                    </div>
                );
            })}
            <p className="bc-group-label">Side quests</p>
            {quest.side.map((side) => (
                <div key={side.key} className="bc-journal-row" data-status={side.done ? "done" : "active"}>
                    <span aria-hidden="true">{side.icon}</span>
                    <div>
                        <span className="bc-journal-title">{side.name}</span>
                        <small>{side.hint}</small>
                    </div>
                    <span />
                </div>
            ))}
        </>
    );
}

function Lore({ entries }: { entries: JournalEntry[] }) {
    const scrolls = entries.filter((entry) => entry.kind === "scroll");
    const rooms = entries.filter((entry) => entry.kind === "room");
    return (
        <>
            <p className="bc-muted">Every scroll you have read and every hall you have found. Read again or go back from here.</p>
            {scrolls.length === 0 && <p className="bc-muted">No scrolls read yet — <code>cat scroll</code> in any room.</p>}
            {[...scrolls].reverse().map((entry) => (
                <div key={entry.id} className="bc-journal-row">
                    <span aria-hidden="true">📜</span>
                    <div>
                        <span className="bc-journal-title">{entry.title}</span>
                        <small>{entry.room} · {when(entry.when)}</small>
                    </div>
                    {entry.command && <button type="button" className="bc-btn" onClick={() => retrieve(entry.command ?? "")}>Read again</button>}
                </div>
            ))}
            {rooms.length > 0 && <p className="bc-group-label">Halls found</p>}
            {[...rooms].reverse().map((entry) => (
                <div key={entry.id} className="bc-journal-row">
                    <span aria-hidden="true">◈</span>
                    <div>
                        <span className="bc-journal-title">{entry.title}</span>
                        <small>{entry.body || entry.ref} · {when(entry.when)}</small>
                    </div>
                    {entry.command && <button type="button" className="bc-btn" onClick={() => retrieve(entry.command ?? "")}>Go there</button>}
                </div>
            ))}
        </>
    );
}

function Bestiary({ store }: { store: GameStore }) {
    const runtime = store.runtime;
    const met = new Set(runtime?.state.bestiary ?? []);
    const catalog = runtime?.catalog.bestiary ?? [];
    return (
        <>
            <p className="bc-muted">{met.size}/{catalog.length} encounters catalogued. <code>bestiary</code> in the prompt lists them too.</p>
            {catalog.map((creature) => (
                <div key={creature.key} className="bc-journal-row" data-status={met.has(creature.key) ? "done" : "locked"}>
                    <span aria-hidden="true">{met.has(creature.key) ? "◆" : "◇"}</span>
                    <div>
                        <span className="bc-journal-title">{met.has(creature.key) ? creature.name : "???"}</span>
                        <small>{met.has(creature.key) ? creature.blurb : "Not yet met."}</small>
                    </div>
                    <span />
                </div>
            ))}
        </>
    );
}

function Badges({ store }: { store: GameStore }) {
    const runtime = store.runtime;
    const earned = new Set(runtime?.state.achievements ?? []);
    const catalog = runtime?.catalog.achievements ?? [];
    return (
        <>
            <p className="bc-muted">{earned.size}/{catalog.length} badges.</p>
            {catalog.map((badge) => (
                <div key={badge.id} className="bc-journal-row" data-status={earned.has(badge.id) ? "done" : "locked"}>
                    <span aria-hidden="true">{badge.icon}</span>
                    <div>
                        <span className="bc-journal-title">{badge.title}</span>
                        <small>{badge.desc}</small>
                    </div>
                    <span className="bc-muted">+{badge.xp} XP</span>
                </div>
            ))}
        </>
    );
}

export function Journal({ store = game }: { store?: GameStore }) {
    const { overlay } = useUi();
    const journal = useJournal();
    useGame((snap) => snap.version, store);
    const phase = useGame((snap) => snap.phase, store);
    const [tab, setTab] = useState<Tab>("chronicle");
    const open = overlay === "journal" && phase === "ready";

    // Stable: the Dialog re-subscribes its Escape listener when onClose changes.
    const close = useCallback(() => {
        markJournalRead();
        closeOverlay();
    }, []);

    return (
        <Dialog open={open} title="Journal" onClose={close} className="bc-journal">
            <div className="bc-tabs" role="tablist" aria-label="Journal sections">
                {TABS.map((id) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} aria-controls={`bc-journal-${id}`} onClick={() => setTab(id)}>
                        {TAB_LABELS[id]}
                    </button>
                ))}
            </div>
            <div id={`bc-journal-${tab}`} role="tabpanel" className="bc-journal-body">
                {tab === "chronicle" && <Chronicle entries={journal.entries} readAt={journal.readAt} />}
                {tab === "quests" && <Quests store={store} />}
                {tab === "lore" && <Lore entries={journal.entries} />}
                {tab === "bestiary" && <Bestiary store={store} />}
                {tab === "badges" && <Badges store={store} />}
            </div>
        </Dialog>
    );
}
