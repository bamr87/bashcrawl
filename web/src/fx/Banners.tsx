// Renders the title card queue: a letterboxed strip across the stage with a
// kicker, the big line and a sub-line. Enter/leave follows MotionConfig.
import { AnimatePresence, motion } from "motion/react";

import { BANNER_KICKER, dismissBanner, useBanner } from "./banner-store";

export function Banners() {
    const current = useBanner();
    return (
        <div className="bc-banners" aria-live="polite" aria-atomic="true">
            <AnimatePresence>
                {current && (
                    <motion.div
                        key={current.id}
                        className="bc-banner"
                        data-kind={current.kind}
                        role="status"
                        onClick={dismissBanner}
                        initial={{ opacity: 0, scale: 0.94, y: -12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                    >
                        <span className="bc-banner-kicker">{BANNER_KICKER[current.kind]}</span>
                        <strong className="bc-banner-title bc-display">{current.title}</strong>
                        {current.sub && <span className="bc-banner-sub">{current.sub}</span>}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
