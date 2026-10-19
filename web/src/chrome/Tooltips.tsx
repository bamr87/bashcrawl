// One tooltip for the whole page. Anything with a `title` (or `data-tip`)
// gets a styled bubble after a short hover delay — immediately while moving
// between tipped controls — and on keyboard focus; the browser's slow native
// bubble is suppressed by moving the title to data-tip (and aria-description,
// so assistive tech still gets the text). Escape, a click, scrolling or
// leaving hides it.
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DELAY_MS = 380;
const WARM_MS = 450;
const GAP = 8;

interface Tip {
    text: string;
    x: number;
    y: number;
    below: boolean;
}

function tipOf(el: HTMLElement): string {
    const title = el.getAttribute("title");
    if (title) {
        el.dataset.tip = title;
        el.removeAttribute("title");
        if (!el.hasAttribute("aria-description")) el.setAttribute("aria-description", title);
    }
    return el.dataset.tip ?? "";
}

function tipFor(el: HTMLElement): Tip | null {
    const text = tipOf(el);
    if (!text) return null;
    const rect = el.getBoundingClientRect();
    const below = rect.top < 64;
    const x = Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2));
    return { text, x, y: below ? rect.bottom + GAP : rect.top - GAP, below };
}

export function Tooltips() {
    const [tip, setTip] = useState<Tip | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    // Keep the bubble inside the viewport: its width is known only once painted.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || !tip) return;
        const half = el.offsetWidth / 2;
        const left = Math.max(12 + half, Math.min(window.innerWidth - 12 - half, tip.x));
        el.style.left = `${left}px`;
    }, [tip]);

    useEffect(() => {
        let current: HTMLElement | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let cooling: ReturnType<typeof setTimeout> | null = null;
        let warm = false;

        const clearTimer = () => {
            if (timer) clearTimeout(timer);
            timer = null;
        };
        const show = (el: HTMLElement) => {
            clearTimer();
            const next = tipFor(el);
            if (!next) return;
            if (cooling) clearTimeout(cooling);
            cooling = null;
            warm = true;
            setTip(next);
        };
        const hide = () => {
            clearTimer();
            if (!current) return;
            current = null;
            setTip(null);
            if (cooling) clearTimeout(cooling);
            cooling = setTimeout(() => { warm = false; }, WARM_MS);
        };
        const target = (event: Event): HTMLElement | null => {
            const node = event.target;
            return node instanceof Element ? node.closest<HTMLElement>("[title],[data-tip]") : null;
        };
        const onOver = (event: Event) => {
            const el = target(event);
            if (!el) return;
            if (el === current) return;
            if (current) hide();
            current = el;
            // Take the title now, before the browser's own bubble could show.
            tipOf(el);
            if (warm) show(el);
            else timer = setTimeout(() => { if (current === el) show(el); }, DELAY_MS);
        };
        const onOut = (event: PointerEvent) => {
            if (!current) return;
            const to = event.relatedTarget;
            if (to instanceof Node && current.contains(to)) return;
            hide();
        };
        const onFocus = (event: Event) => {
            const el = target(event);
            if (!el) return;
            current = el;
            show(el);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") hide();
        };
        document.addEventListener("pointerover", onOver);
        document.addEventListener("pointerout", onOut);
        document.addEventListener("focusin", onFocus);
        document.addEventListener("focusout", hide);
        document.addEventListener("pointerdown", hide);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", hide, true);
        return () => {
            clearTimer();
            if (cooling) clearTimeout(cooling);
            document.removeEventListener("pointerover", onOver);
            document.removeEventListener("pointerout", onOut);
            document.removeEventListener("focusin", onFocus);
            document.removeEventListener("focusout", hide);
            document.removeEventListener("pointerdown", hide);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", hide, true);
        };
    }, []);

    if (!tip) return null;
    return (
        <motion.div
            ref={ref}
            key={`${tip.x},${tip.y}`}
            role="tooltip"
            className="bc-tooltip"
            data-below={tip.below || undefined}
            style={{ left: tip.x, top: tip.y }}
            initial={{ opacity: 0, y: tip.below ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
        >
            {tip.text}
        </motion.div>
    );
}
