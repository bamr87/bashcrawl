// The guided tour: coach marks over the live page. A spotlight cut around
// the prompt, the quest, the room, the status bar and the doors, each with
// a card; stops whose target is not on screen (the sidebar on a phone) are
// skipped. Enter/→ next, ← back, Esc skips; finishing types the first spell.
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

import { anchorElement } from "../fx/anchors";
import { DEFAULT_NAME, setHero, useHero } from "../hero/hero-store";
import { fillPrompt, focusPrompt } from "../terminal/prompt-store";
import { endTour, setUi, useUi } from "./ui-store";

interface Stop {
    anchor: string | null;
    title: string;
    body: ReactNode;
}

function stopsFor(name: string): Stop[] {
    return [
        {
            anchor: null,
            title: `Welcome, ${name}`,
            body: "The dungeon is a filesystem. Rooms are directories, scrolls are files, treasures are programs — and you explore it by typing real commands.",
        },
        {
            anchor: "prompt",
            title: "The prompt",
            body: <>Your spellbook. Type a command here and press <kbd className="bc-kbd">Enter</kbd>. <kbd className="bc-kbd">Tab</kbd> completes a name, <kbd className="bc-kbd">↑</kbd> recalls history, and the chips above suggest what to try next.</>,
        },
        {
            anchor: "quest",
            title: "The quest",
            body: "Each quest teaches one spell. Finish it and the next appears — the ◆ chip under the log is its command.",
        },
        {
            anchor: "room",
            title: "Where you stand",
            body: <>The room, its path, and what is in it: 📁 a door you can <code>cd</code> into, 📄 a scroll to <code>cat</code>, ⚡ an encounter to <code>./run</code>.</>,
        },
        {
            anchor: "xp",
            title: "Your hero",
            body: "Rank, experience toward the next rank, health, quests, badges. Every item up here is a button.",
        },
        {
            anchor: "tabs",
            title: "Four doors",
            body: <>Story is the dungeon. Learn walks you through courses in a lab. Arcade drills under the clock. Reference is the cheatsheet. <kbd className="bc-kbd">Alt</kbd>+<kbd className="bc-kbd">1–4</kbd> switches.</>,
        },
        {
            anchor: null,
            title: "Ready",
            body: <>Your first spell is <code>pwd</code> — it tells you where you are. Finish and I'll type it for you; then press <kbd className="bc-kbd">Enter</kbd> to cast it.</>,
        },
    ];
}

// The prompt and the tabs are not effects anchors; everything else is.
function targetFor(anchor: string): HTMLElement | null {
    if (anchor === "prompt") return document.querySelector<HTMLElement>(".bc-prompt");
    if (anchor === "tabs") return document.querySelector<HTMLElement>(".bc-modes");
    return anchorElement(anchor);
}

function visible(element: HTMLElement | null): element is HTMLElement {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

const PAD = 8;
const CARD_W = 360;
const CARD_H = 210;

interface Box {
    top: number;
    left: number;
    width: number;
    height: number;
}

function finish(fill: boolean): void {
    setHero({ tourDone: true });
    endTour();
    if (fill) fillPrompt("pwd");
    focusPrompt();
}

export function Tour() {
    const { tour } = useUi();
    const hero = useHero();
    const stops = stopsFor(hero?.name ?? DEFAULT_NAME);
    const [box, setBox] = useState<Box | null>(null);
    const step = tour;
    const stop = step == null ? undefined : stops[step];

    // Measure the target; skip a stop whose target is off screen; re-measure
    // on resize and scroll.
    useEffect(() => {
        if (step == null) return;
        const current = stops[step];
        if (!current) {
            finish(true);
            return;
        }
        const target = current.anchor ? targetFor(current.anchor) : null;
        if (current.anchor && !visible(target)) {
            setUi({ tour: step + 1 });
            return;
        }
        const measure = () => {
            if (!target) {
                setBox(null);
                return;
            }
            const rect = target.getBoundingClientRect();
            setBox({ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 });
        };
        const frame = requestAnimationFrame(measure);
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [step, stops.length]); // eslint-disable-line react-hooks/exhaustive-deps -- stops is rebuilt per render but only its length matters

    useEffect(() => {
        if (step == null) return;
        const onKey = (event: KeyboardEvent) => {
            const typing = event.target instanceof HTMLElement && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA");
            if (event.key === "Escape") {
                event.preventDefault();
                finish(false);
            } else if (!typing && (event.key === "ArrowRight" || event.key === "Enter")) {
                event.preventDefault();
                if (step >= stops.length - 1) finish(true);
                else setUi({ tour: step + 1 });
            } else if (!typing && event.key === "ArrowLeft") {
                event.preventDefault();
                setUi({ tour: Math.max(0, step - 1) });
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [step, stops.length]);

    if (step == null || !stop) return null;
    const last = step >= stops.length - 1;
    const centered = !stop.anchor || !box;
    const below = box ? box.top + box.height + CARD_H + 16 < window.innerHeight : true;
    const cardStyle = box && !centered
        ? {
            top: below ? box.top + box.height + 12 : Math.max(12, box.top - CARD_H - 12),
            left: Math.max(12, Math.min(box.left, window.innerWidth - CARD_W - 12)),
        }
        : undefined;

    return (
        <div className="bc-tour" role="dialog" aria-modal="true" aria-label="Guided tour">
            {centered ? <div className="bc-tour-dim" /> : <div className="bc-tour-spot" style={box ?? undefined} aria-hidden="true" />}
            {/* Keyed enter-only: a new card per stop, no exit to wait on. */}
            <motion.div
                key={step}
                className="bc-tour-card bc-frame"
                data-center={centered || undefined}
                style={cardStyle}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            >
                    <h3 className="bc-display">{stop.title}</h3>
                    <p>{stop.body}</p>
                    <div className="bc-tour-nav">
                        <span className="bc-tour-step">{step + 1} / {stops.length}</span>
                        <span className="bc-doors">
                            <button type="button" className="bc-link" onClick={() => finish(false)}>Skip tour</button>
                            {step > 0 && <button type="button" className="bc-btn" onClick={() => setUi({ tour: step - 1 })}>Back</button>}
                            <button type="button" className="bc-btn bc-btn-primary" autoFocus onClick={() => (last ? finish(true) : setUi({ tour: step + 1 }))}>
                                {last ? "Cast pwd" : "Next"}
                            </button>
                        </span>
                    </div>
            </motion.div>
        </div>
    );
}
