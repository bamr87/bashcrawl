// A number that rolls to its new value (XP ticking up as the orbs land).
// The true value is always in data-value for assistive tech and tests;
// under reduced motion the roll is skipped.
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export interface RollingNumberProps {
    value: number;
    duration?: number;
    className?: string;
}

export function RollingNumber({ value, duration = 450, className }: RollingNumberProps) {
    const reduced = useReducedMotion() ?? false;
    const [state, setState] = useState({ target: value, shown: value });
    // Adjust during render when the target moves (no effect round-trip).
    if (state.target !== value) {
        setState({ target: value, shown: reduced ? value : state.shown });
    }
    useEffect(() => {
        if (reduced || state.shown === state.target) return;
        const from = state.shown;
        const to = state.target;
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const k = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - k, 3);
            const next = Math.round(from + (to - from) * eased);
            setState((prev) => (prev.target === to ? { target: to, shown: next } : prev));
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [state.target, state.shown, reduced, duration]);
    return <span className={className} data-value={value}>{state.shown}</span>;
}
