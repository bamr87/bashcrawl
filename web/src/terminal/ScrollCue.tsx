// "More below": a cue at the foot of the log while unread lines sit under
// the fold — after a long scroll opens at its title, or once the reader has
// scrolled up. Click pages down; it leaves when the end is in view.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { game, useGame, type GameStore } from "../engine/game-store";
import { anchorElement } from "../fx/anchors";
import { focusPrompt } from "./prompt-store";

const SLACK = 24;

function pageDown(): void {
    const log = anchorElement("log");
    if (!log) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = log.clientHeight * 0.85;
    if (typeof log.scrollBy === "function") log.scrollBy({ top, behavior: reduced ? "auto" : "smooth" });
    else log.scrollTop += top;
    focusPrompt();
}

export function ScrollCue({ store = game }: { store?: GameStore }) {
    const version = useGame((snap) => snap.version, store);
    const [below, setBelow] = useState(false);

    // Re-measure on scroll, on resize (the clip band), and after every
    // command (the version), a frame late so layout has settled.
    useEffect(() => {
        const log = anchorElement("log");
        if (!log) return;
        let frame = 0;
        const check = () => setBelow(log.scrollHeight - log.clientHeight - log.scrollTop > SLACK);
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(check);
        };
        log.addEventListener("scroll", schedule, { passive: true });
        const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
        observer?.observe(log);
        schedule();
        return () => {
            cancelAnimationFrame(frame);
            log.removeEventListener("scroll", schedule);
            observer?.disconnect();
        };
    }, [version, store]);

    return (
        <AnimatePresence>
            {below && (
                <motion.button
                    type="button"
                    className="bc-scroll-cue"
                    onClick={pageDown}
                    aria-label="Scroll down to read more"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                >
                    ▼ more
                </motion.button>
            )}
        </AnimatePresence>
    );
}
