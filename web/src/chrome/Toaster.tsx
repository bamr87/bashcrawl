// Renders the toast queue. One live region, newest at the bottom, each
// toast dismissable by its button; enter/leave motion follows MotionConfig.
import { AnimatePresence, motion } from "motion/react";

import { dismissToast, useToasts } from "./toast-store";

export function Toaster() {
    const items = useToasts();
    return (
        <div className="bc-toasts" role="status" aria-live="polite" aria-atomic="false">
            <AnimatePresence initial={false}>
                {items.map((item) => (
                    <motion.div
                        key={item.id}
                        className="bc-toast bc-frame"
                        data-variant={item.variant}
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    >
                        <span>{item.text}</span>
                        <button type="button" aria-label="Dismiss notification" onClick={() => dismissToast(item.id)}>×</button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
