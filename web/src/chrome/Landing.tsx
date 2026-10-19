// The title screen on a first visit: the logo materialises out of static,
// then four doors. Choosing one is remembered; Escape takes the Story door.
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import { MODES, MODE_META, type Mode } from "../app/modes";
import { navigate } from "../app/useHashRoute";
import { ArtClip } from "../fx/ArtClip";
import { setPrefs } from "./prefs-store";
import { setUi, useUi } from "./ui-store";

const DOOR_BLURB: Record<Mode, string> = {
    learn: "Guided courses with a practice lab. Start here if the terminal is new to you.",
    story: "Descend the dungeon — quests teach you pwd → ls → cd → pipes.",
    arcade: "Timed mini-games: navigation, grep/find, pipelines, flashcards.",
    reference: "Searchable cheatsheets for every command the dungeon teaches.",
};
const DOOR_ORDER: Mode[] = ["learn", "story", "arcade", "reference"];

function chooseDoor(mode: Mode): void {
    setPrefs({ onboarded: true });
    setUi({ landingOpen: false });
    navigate(mode);
}

export function Landing() {
    const { landingOpen } = useUi();
    useEffect(() => {
        if (!landingOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                chooseDoor("story");
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [landingOpen]);
    return (
        <AnimatePresence>
            {landingOpen && (
                <motion.div
                    className="bc-landing"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Welcome to Bashcrawl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.26 }}
                >
                    <motion.div
                        className="bc-landing-card bc-frame"
                        initial={{ opacity: 0, y: 18, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                    >
                        <ArtClip name="landing-brand" className="bc-landing-brand" />
                        <h1 className="bc-display">Learn the terminal by playing.</h1>
                        <p className="bc-muted">Real bash commands. A dungeon that is the filesystem. Free, in your browser.</p>
                        <div className="bc-landing-doors">
                            {DOOR_ORDER.map((mode, i) => (
                                <motion.button
                                    key={mode}
                                    type="button"
                                    className={`bc-door bc-frame bc-door-${mode}`}
                                    onClick={() => chooseDoor(mode)}
                                    autoFocus={i === 0}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.25 + i * 0.08, duration: 0.3, ease: [0.2, 0, 0, 1] }}
                                    whileHover={{ y: -3 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="bc-door-icon" aria-hidden="true">{MODE_META[mode].icon}</span>
                                    <strong className="bc-display">{mode === "arcade" ? "Practice Arcade" : MODE_META[mode].label}</strong>
                                    <span className="bc-door-blurb">{DOOR_BLURB[mode]}</span>
                                </motion.button>
                            ))}
                        </div>
                        <p className="bc-muted bc-landing-tip">
                            Tip: every door shares one prompt. Type <code>pwd</code> anywhere to begin. {MODES.length} doors, one dungeon.
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
