// The log: a <pre> that React renders empty and a TermForge DomSink paints.
// React never reconciles children it did not create, so the imperative
// painting and the component coexist; attaching repaints from the view's
// buffer, which also makes StrictMode's mount → unmount → mount harmless.
import { useEffect, useRef, type MouseEvent } from "react";

import { game } from "../engine/game-store";
import { registerAnchor } from "../fx/anchors";
import { fillPrompt } from "./prompt-store";

// A command in a scroll (log-decor stamps data-fill on it) types itself
// into the prompt on click — the same affordance as code in a lesson.
function onLogClick(event: MouseEvent<HTMLPreElement>): void {
    const hit = (event.target as HTMLElement).closest?.("[data-fill]");
    if (hit instanceof HTMLElement && hit.dataset.fill) fillPrompt(hit.dataset.fill);
}

/** Anything that paints into a log element: the story and arcade stores. */
export interface LogHost {
    attachLog(element: HTMLElement | null): void;
}

export interface TerminalLogProps {
    store?: LogHost;
    label: string;
    className?: string;
    /** The effects anchor name; the story log is "log". */
    anchor?: string;
}

export function TerminalLog({ store = game, label, className, anchor = "log" }: TerminalLogProps) {
    const ref = useRef<HTMLPreElement>(null);
    useEffect(() => {
        store.attachLog(ref.current);
        return () => store.attachLog(null);
    }, [store]);
    useEffect(() => registerAnchor(anchor, ref.current), [anchor]);
    return (
        <pre
            ref={ref}
            className={`bc-log ${className ?? ""}`}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={label}
            tabIndex={0}
            onClick={onLogClick}
        />
    );
}
