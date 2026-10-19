// Vitals and the pack: the HP gauge and the treasures carried, each new
// one sliding in.
import { AnimatePresence, motion } from "motion/react";

import { game, useModel, type GameStore } from "../engine/game-store";
import { Gauge } from "./Gauge";

export function InventoryPanelBody({ store = game }: { store?: GameStore }) {
    const inv = useModel("inventoryModel", store);
    return (
        <>
            <p className="bc-inv-hp">
                <span className="bc-group-label">HP</span>
                <Gauge value={inv.hp} max={inv.hpMax} label={`Health ${inv.hp} of ${inv.hpMax}`} tone="hp" className="bc-gauge-wide" />
                <span className="bc-inv-hp-num">{inv.hp}/{inv.hpMax}</span>
            </p>
            <p className="bc-group-label">Items carried ({inv.items.length})</p>
            {inv.items.length ? (
                <ul className="bc-list bc-inv-items">
                    <AnimatePresence initial={false}>
                        {inv.items.map((item) => (
                            <motion.li
                                key={item}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                            >
                                <span aria-hidden="true">💰 </span>{item}
                            </motion.li>
                        ))}
                    </AnimatePresence>
                </ul>
            ) : (
                <p className="bc-muted bc-inv-empty">No treasures yet — explore rooms and grab the loot.</p>
            )}
        </>
    );
}
