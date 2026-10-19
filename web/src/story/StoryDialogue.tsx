// The dialogue box: a chapter told under the log, RPG style — the hero's
// portrait, a kicker, the title, and the page typed out letter by letter at
// the Options' text speed. Click or Enter completes the page, then turns
// it; Escape closes. It waits while a full-screen overlay or the tour is up.
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSettings } from "../chrome/settings-store";
import { useUi } from "../chrome/ui-store";
import { HeroFigure } from "../hero/HeroFigure";
import { useHero } from "../hero/hero-store";
import { focusPrompt } from "../terminal/prompt-store";
import { advanceDialogue, dismissDialogue, useDialogue } from "./dialogue-store";

const SPEED_MS = { instant: 0, normal: 16, slow: 32 } as const;

function reducedMotion(): boolean {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Page({ text, speed, onDone }: { text: string; speed: number; onDone: () => void }) {
    const [shown, setShown] = useState(speed ? 0 : text.length);
    const done = shown >= text.length;

    useEffect(() => {
        if (!speed || shown >= text.length) return;
        const timer = setTimeout(() => setShown((count) => Math.min(text.length, count + 1)), speed);
        return () => clearTimeout(timer);
    }, [shown, speed, text.length]);

    useEffect(() => {
        if (done) onDone();
    }, [done, onDone]);

    return (
        <p className={done ? "bc-dialogue-text" : "bc-dialogue-text bc-dialogue-caret"} data-done={done || undefined}>
            {text.slice(0, shown)}
        </p>
    );
}

export function StoryDialogue() {
    const { current, page, queued } = useDialogue();
    const { overlay, tour } = useUi();
    const hero = useHero();
    const settings = useSettings();
    const [typed, setTyped] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const visible = current != null && overlay === null && tour === null;
    const speed = reducedMotion() ? 0 : SPEED_MS[settings.textSpeed];
    const text = current?.pages[page] ?? "";
    const last = current ? page >= current.pages.length - 1 : true;
    const onTyped = useCallback(() => setTyped(true), []);

    // Enter/Space on the box advance; Escape closes and hands focus back.
    useEffect(() => {
        if (!visible) return;
        buttonRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                dismissDialogue();
                focusPrompt();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [visible, current?.id, page]);

    function step() {
        if (!typed && speed) {
            // Finish the page at once: remount the Page with speed 0.
            setTyped(true);
            return;
        }
        setTyped(false);
        advanceDialogue();
        if (last && queued === 0) focusPrompt();
    }

    if (!visible || !current) return null;
    // Enter-only motion: a new box per chapter, nothing to wait on when it goes.
    return (
        <motion.div
            key={current.id}
            className="bc-dialogue bc-frame"
            role="dialog"
            aria-label={`${current.kicker}: ${current.title}`}
            aria-live="polite"
            onClick={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
        >
                    <div className="bc-dialogue-portrait" aria-hidden="true">
                        <HeroFigure appearance={hero?.appearance} crop="bust" size="md" className="bc-hero-mini" />
                    </div>
                    <div className="bc-dialogue-body">
                        <p className="bc-dialogue-kicker">{current.kicker}</p>
                        <h3 className="bc-display">{current.title}</h3>
                        <Page key={`${current.id}:${page}:${typed ? "full" : "type"}`} text={text} speed={typed ? 0 : speed} onDone={onTyped} />
                        <div className="bc-dialogue-foot">
                            <span>{current.pages.length > 1 ? `${page + 1} / ${current.pages.length}` : ""}{queued ? ` · ${queued} more` : ""}</span>
                            <button ref={buttonRef} type="button" className="bc-link bc-dialogue-next" onClick={(event) => { event.stopPropagation(); step(); }}>
                                {!typed && speed ? "Skip ▸" : last ? "Close" : "Continue ▸"}
                            </button>
                        </div>
                    </div>
        </motion.div>
    );
}
