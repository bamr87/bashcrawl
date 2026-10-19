// The overview every first-timer sees once (and "How to play" afterwards):
// three pages — the dungeon is a filesystem; spells, quests and loot; the
// four doors — then through the hero's own door, with the tour. Enter/→
// next, ← back, Esc skips.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { MODE_META, MODES, type Mode } from "../app/modes";
import { navigate } from "../app/useHashRoute";
import { play } from "../audio/sfx";
import { ArtClip } from "../fx/ArtClip";
import { HeroFigure } from "../hero/HeroFigure";
import { roleMeta, useHero, type Hero } from "../hero/hero-store";
import { setPrefs } from "./prefs-store";
import { openOverlay, setUi, startTour, useUi } from "./ui-store";

const DOOR_BLURB: Record<Mode, string> = {
    story: "The dungeon. Quests teach pwd → ls → cd → pipes, room by room.",
    learn: "Guided courses with a practice lab. Objectives tick off as you type.",
    arcade: "Timed mini-games: navigation, grep/find, pipelines, flashcards.",
    reference: "Searchable cheatsheets for every command the dungeon teaches.",
};
const PAGES = 3;

function doorName(mode: Mode): string {
    return mode === "arcade" ? "Practice Arcade" : MODE_META[mode].label;
}

function finishIntro(hero: Hero | null): void {
    setPrefs({ introSeen: true });
    if (!hero) {
        openOverlay("create");
        return;
    }
    const door = roleMeta(hero.role).door;
    setUi({ overlay: null });
    navigate(door);
    if (!hero.tourDone && (door === "story" || door === "learn")) startTour();
}

function Pages({ hero }: { hero: Hero | null }) {
    const [page, setPage] = useState(0);
    const last = page === PAGES - 1;
    const door = hero ? roleMeta(hero.role).door : null;

    function next() {
        play("tab");
        if (last) finishIntro(hero);
        else setPage((current) => current + 1);
    }
    function back() {
        setPage((current) => Math.max(0, current - 1));
    }

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                finishIntro(hero);
            } else if (event.key === "ArrowRight" || (event.key === "Enter" && !(event.target instanceof HTMLButtonElement))) {
                event.preventDefault();
                if (last) finishIntro(hero);
                else setPage((current) => current + 1);
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                setPage((current) => Math.max(0, current - 1));
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [hero, last]);

    return (
        <div className="bc-intro-panel bc-frame">
            <section aria-live="polite">
                <p className="bc-step-kicker">How to play · {page + 1} / {PAGES}</p>
                <motion.div key={page} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
                    {page === 0 && (
                        <>
                            <h2 className="bc-display">The dungeon is a filesystem</h2>
                            <p>Every room is a directory, every scroll a file, every treasure a program you can run. <code>ls</code> looks around, <code>cd</code> walks through a door, <code>cat</code> reads a scroll, <code>./treasure</code> opens a chest.</p>
                            <p>Nothing is pretend: these are the real commands, on a real shell that lives in your browser. What you learn here works in any terminal.</p>
                        </>
                    )}
                    {page === 1 && (
                        <>
                            <h2 className="bc-display">Spells, quests and loot</h2>
                            <p>The prompt at the bottom is your spellbook — type and press <kbd className="bc-kbd">Enter</kbd> to cast. Quests teach one spell at a time and pay XP; treasures open hidden passages; your rank climbs as you learn.</p>
                            <p>Stuck? <code>hint</code>. Lost? <code>pwd</code>. Curious? <code>help</code>. Every scroll you <code>cat</code> is live: click a command in it and it types itself.</p>
                        </>
                    )}
                    {page === 2 && (
                        <>
                            <h2 className="bc-display">Four doors, one dungeon</h2>
                            <ul className="bc-intro-doors">
                                {MODES.map((mode) => (
                                    <li key={mode} data-mine={mode === door || undefined}>
                                        <span aria-hidden="true">{MODE_META[mode].icon}</span>
                                        <span>
                                            <strong>{doorName(mode)}</strong>
                                            <small>{DOOR_BLURB[mode]}</small>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {hero && door && (
                                <p>As a <strong>{roleMeta(hero.role).title}</strong> you start in the <strong>{doorName(door)}</strong>. The others are one click away; they share the same hero and the same prompt.</p>
                            )}
                        </>
                    )}
                </motion.div>
                <nav className="bc-wizard-nav" aria-label="Pages">
                    <button type="button" className="bc-btn" onClick={page === 0 ? () => finishIntro(hero) : back}>{page === 0 ? "Skip intro" : "Back"}</button>
                    <span className="bc-dots" aria-hidden="true">
                        {Array.from({ length: PAGES }, (_, index) => <span key={index} className="bc-dot" data-on={index <= page || undefined} />)}
                    </span>
                    <button type="button" className="bc-btn bc-btn-primary" onClick={next} autoFocus>
                        {last ? (hero ? "Begin" : "Create your hero") : "Next"}
                    </button>
                </nav>
            </section>
            <aside className="bc-intro-art" aria-hidden="true">
                {page === 0 && <ArtClip name="room-entrance" loop className="bc-intro-clip" />}
                {page === 1 && <ArtClip name="encounter-treasure" loop className="bc-intro-clip" />}
                {page === 2 && (hero ? (
                    <HeroFigure appearance={hero.appearance} size="lg">
                        <p className="bc-hero-name bc-display">{hero.name}</p>
                    </HeroFigure>
                ) : (
                    <ArtClip name="pathfind" className="bc-intro-clip" />
                ))}
            </aside>
        </div>
    );
}

export function Intro() {
    const { overlay } = useUi();
    const hero = useHero();
    return (
        <AnimatePresence>
            {overlay === "intro" && (
                <motion.div
                    className="bc-title bc-intro"
                    role="dialog"
                    aria-modal="true"
                    aria-label="How to play"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.26 }}
                >
                    <Pages hero={hero} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
