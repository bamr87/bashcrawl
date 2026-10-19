// Next-step chips (Hud.suggestionsModel): the quest's own command when it
// can run from here, the room's encounters and essentials, a lesson's
// hint. A chip fills the prompt — the learner still presses Enter.
import { AnimatePresence, motion } from "motion/react";

import { game, useModel, type GameStore } from "../engine/game-store";
import { fillPrompt } from "./prompt-store";

export function SuggestionChips({ store = game }: { store?: GameStore }) {
    const rows = useModel("suggestionsModel", store);
    if (!rows.length) return null;
    return (
        <div className="bc-suggest" role="group" aria-label="Suggested next commands">
            <span className="bc-suggest-label">Try</span>
            <AnimatePresence initial={false} mode="popLayout">
                {rows.map((row) => (
                    <motion.button
                        key={row.cmd}
                        type="button"
                        className={`bc-chip bc-chip-${row.kind}`}
                        title={row.why}
                        onClick={() => fillPrompt(row.cmd)}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    >
                        {row.kind === "quest" && <span aria-hidden="true">◆ </span>}
                        {row.cmd}
                    </motion.button>
                ))}
            </AnimatePresence>
        </div>
    );
}
