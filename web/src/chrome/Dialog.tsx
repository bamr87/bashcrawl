// A modal dialog without <dialog>: a backdrop on the modal layer, focus
// moved in on open and restored on close, Escape and backdrop-click close.
// Used by the shortcuts help, the pager and the HUD menu.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    /** Element to focus on open; defaults to the close button. */
    initialFocus?: () => HTMLElement | null;
}

export function Dialog({ open, title, onClose, children, className, initialFocus }: DialogProps) {
    const titleId = useId();
    const closeRef = useRef<HTMLButtonElement>(null);
    const restoreRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;
        restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const target = (initialFocus && initialFocus()) || closeRef.current;
        target?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            restoreRef.current?.focus();
        };
    }, [open, onClose, initialFocus]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="bc-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        className={`bc-dialog bc-frame ${className ?? ""}`}
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    >
                        <div className="bc-dialog-head">
                            <h2 id={titleId} className="bc-display">{title}</h2>
                            <button ref={closeRef} type="button" className="bc-btn" onClick={onClose} aria-label={`Close ${title}`}>
                                Close
                            </button>
                        </div>
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
