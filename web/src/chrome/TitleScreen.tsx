// The title screen: the logo materialises out of static over a torch-lit
// wall, then the menu every game has — Continue (hero · rank · room), New
// game / New hero, How to play, Options. ↑/↓ move the cursor, Enter picks,
// Escape takes the first entry. Shown on a first visit (no hero yet) and
// from the brand button or the profile afterwards.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type KeyboardEvent } from "react";

import { navigate } from "../app/useHashRoute";
import { play } from "../audio/sfx";
import { game, useGame, type GameStore } from "../engine/game-store";
import { ArtClip } from "../fx/ArtClip";
import { HeroFigure } from "../hero/HeroFigure";
import { clearHero, createHero, DEFAULT_NAME, roleMeta, useHero, type Hero } from "../hero/hero-store";
import { readRaw } from "../lib/storage";
import { getPrefs, setPrefs } from "./prefs-store";
import { toast } from "./toast-store";
import { openOverlay, setUi, startTour, useUi } from "./ui-store";

const SAVE_KEY = "bashcrawl-web-state-v1";
export const VERSION = "3.2";

interface MenuItem {
    id: string;
    label: string;
    sub: string;
    danger?: boolean;
    run: () => void;
}

function leave(): void {
    setUi({ overlay: null });
}

/** Into the game: the last door, or the hero's own. */
function enterGame(hero: Hero | null): void {
    setPrefs({ onboarded: true });
    leave();
    navigate(getPrefs().mode ?? (hero ? roleMeta(hero.role).door : "story"));
}

function TitleMenu({ store, hero }: { store: GameStore; hero: Hero | null }) {
    const [confirming, setConfirming] = useState(false);
    const ready = store.snap.get().phase === "ready";
    const hasSave = Boolean(readRaw(SAVE_KEY));
    const status = ready ? store.model("statusModel") : null;
    const room = ready ? store.model("roomModel") : null;

    function continueGame() {
        // A save from before heroes existed continues as the default hero.
        const who = hero ?? createHero({ name: DEFAULT_NAME, role: "wanderer" });
        enterGame(who);
        toast(`Welcome back, ${who.name}.`, "magic");
    }
    function newGame() {
        if (hero || hasSave) {
            setConfirming(true);
            return;
        }
        openOverlay("create");
    }
    function confirmNew() {
        store.newRun();
        clearHero();
        openOverlay("create");
    }
    function dropIn() {
        const who = createHero({ name: DEFAULT_NAME, role: "wanderer" });
        enterGame(who);
        if (!getPrefs().introSeen) startTour();
    }

    const items: MenuItem[] = [];
    if (hero || hasSave) {
        items.push({
            id: "continue",
            label: "Continue",
            sub: hero ? [hero.name, status?.rank, room?.title].filter(Boolean).join(" · ") : "your saved progress, as Adventurer",
            run: continueGame,
        });
    }
    items.push({
        id: "new",
        label: hero || hasSave ? "New hero" : "New game",
        sub: hero || hasSave ? "start over with a new character" : "create your hero and begin the descent",
        danger: Boolean(hero || hasSave),
        run: newGame,
    });
    items.push({ id: "how", label: "How to play", sub: "a two-minute overview", run: () => openOverlay("intro") });
    items.push({ id: "options", label: "Options", sub: "theme · sound · effects · text", run: () => openOverlay("options") });

    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            if (event.key !== "Escape" || confirming) return;
            event.preventDefault();
            items[0]?.run();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    });

    function onMenuKey(event: KeyboardEvent<HTMLUListElement>) {
        const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
        play("tab");
    }

    if (confirming) {
        return (
            <div className="bc-confirm-box bc-frame" role="group" aria-label="Start over?">
                <p><strong>Start over?</strong> {hero?.name ?? "This run"}'s progress{status ? ` — ${status.xp} XP, ${status.questsDone}/${status.questsTotal} quests` : ""} — will be forgotten.</p>
                <p className="bc-doors">
                    <button type="button" className="bc-btn bc-btn-danger" onClick={confirmNew} autoFocus>Yes, new hero</button>
                    <button type="button" className="bc-btn" onClick={() => setConfirming(false)}>Keep playing</button>
                </p>
            </div>
        );
    }
    return (
        <>
            <ul className="bc-menu" role="menu" aria-label="Main menu" onKeyDown={onMenuKey}>
                {items.map((item, index) => (
                    <li key={item.id} role="none">
                        <button type="button" role="menuitem" className="bc-menu-item" data-danger={item.danger || undefined} onClick={item.run} autoFocus={index === 0}>
                            <span className="bc-menu-cursor" aria-hidden="true">▶</span>
                            <span className="bc-menu-text">
                                <strong>{item.label}</strong>
                                <small>{item.sub}</small>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {!hero && !hasSave && (
                <button type="button" className="bc-link" onClick={dropIn}>Skip — play as Adventurer</button>
            )}
            <p className="bc-title-foot">
                <kbd className="bc-kbd">↑</kbd><kbd className="bc-kbd">↓</kbd> choose · <kbd className="bc-kbd">Enter</kbd> select · <kbd className="bc-kbd">Esc</kbd> {items[0]?.label.toLowerCase()} · v{VERSION}
            </p>
        </>
    );
}

export function TitleScreen({ store = game }: { store?: GameStore }) {
    const { overlay } = useUi();
    const hero = useHero();
    useGame((snap) => snap.version, store);
    const open = overlay === "title";
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="bc-title"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Bashcrawl title screen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="bc-title-scene" aria-hidden="true">
                        <span className="bc-title-torch bc-title-torch-l" />
                        <span className="bc-title-torch bc-title-torch-r" />
                    </div>
                    <motion.div
                        className="bc-title-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
                    >
                        <ArtClip name="landing-brand" className="bc-title-logo" />
                        <p className="bc-title-tag bc-display">Terminal Dungeon</p>
                        <p className="bc-title-sub">Learn the terminal by playing. Real bash — in a dungeon that is the filesystem.</p>
                        <TitleMenu store={store} hero={hero} />
                    </motion.div>
                    {hero && (
                        <motion.div className="bc-title-hero" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
                            <HeroFigure appearance={hero.appearance} size="lg" label={`${hero.name}, your hero`}>
                                <p className="bc-hero-name bc-display">{hero.name}</p>
                                <p className="bc-muted bc-hero-path">{roleMeta(hero.role).icon} {roleMeta(hero.role).title}</p>
                            </HeroFigure>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
