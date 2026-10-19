// The log: a <pre> that React renders empty and a TermForge DomSink paints.
// React never reconciles children it did not create, so the imperative
// painting and the component coexist; attaching repaints from the view's
// buffer, which also makes StrictMode's mount → unmount → mount harmless.
import { useEffect, useRef } from "react";

import { game, type GameStore } from "../engine/game-store";
import { registerAnchor } from "../fx/anchors";

export interface TerminalLogProps {
    store?: GameStore;
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
        />
    );
}
