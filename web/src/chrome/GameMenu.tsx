// The pause menu (Escape with nothing else open, Alt+M, `menu`): Continue,
// Journal, Hero, Options, How to play, Title screen — the same menu cursor
// as the title. Escape or Continue returns to the game.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, type KeyboardEvent } from "react";

import { play } from "../audio/sfx";
import { focusPrompt } from "../terminal/prompt-store";
import { closeOverlay, getUi, openOverlay, useUi, type Overlay } from "./ui-store";

interface Item {
    id: string;
    label: string;
    sub: string;
    run: () => void;
}

function resume(): void {
    closeOverlay();
    focusPrompt();
}

function to(overlay: Exclude<Overlay, null>): () => void {
    return () => openOverlay(overlay);
}

const ITEMS: Item[] = [
    { id: "continue", label: "Continue", sub: "back to the dungeon", run: resume },
    { id: "journal", label: "Journal", sub: "chronicle · quests · lore · bestiary · badges", run: to("journal") },
    { id: "hero", label: "Hero", sub: "profile and wardrobe", run: to("profile") },
    { id: "options", label: "Options", sub: "theme · sound · effects · text", run: to("options") },
    { id: "how", label: "How to play", sub: "the overview again", run: to("intro") },
    { id: "title", label: "Title screen", sub: "continue, new hero, or start over", run: to("title") },
];

export function GameMenu() {
    const { overlay } = useUi();
    const open = overlay === "menu";

    useEffect(() => {
        if (!open) return;
        const onKey = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape" && getUi().overlay === "menu") {
                event.preventDefault();
                resume();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    function onMenuKey(event: KeyboardEvent<HTMLUListElement>) {
        const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
        play("tab");
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="bc-gamemenu"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Game menu"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onMouseDown={(event) => { if (event.target === event.currentTarget) resume(); }}
                >
                    <motion.div className="bc-gamemenu-panel bc-frame" initial={{ y: 10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
                        <h2 className="bc-display">Paused</h2>
                        <ul className="bc-menu" role="menu" aria-label="Game menu" onKeyDown={onMenuKey}>
                            {ITEMS.map((item, index) => (
                                <li key={item.id} role="none">
                                    <button type="button" role="menuitem" className="bc-menu-item" onClick={item.run} autoFocus={index === 0}>
                                        <span className="bc-menu-cursor" aria-hidden="true">▶</span>
                                        <span className="bc-menu-text">
                                            <strong>{item.label}</strong>
                                            <small>{item.sub}</small>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <p className="bc-title-foot"><kbd className="bc-kbd">Esc</kbd> continue · <kbd className="bc-kbd">Alt</kbd>+<kbd className="bc-kbd">J</kbd> journal · <kbd className="bc-kbd">Alt</kbd>+<kbd className="bc-kbd">H</kbd> hero · <kbd className="bc-kbd">Alt</kbd>+<kbd className="bc-kbd">O</kbd> options</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
