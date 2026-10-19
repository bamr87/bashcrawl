// Plays an ASCII Motion clip inside a ref'd element through the engine's
// ambient player (web/assets/js/ambient.js): room vignettes loop, the
// landing logo plays once. The player pauses on a hidden tab and paints a
// still under prefers-reduced-motion; this hook only owns the lifecycle.
import { useEffect, type RefObject } from "react";

import { requireEngine } from "../engine";
import type { AsciiClip } from "../engine/types";

export function useAmbientClip(ref: RefObject<HTMLElement | null>, clip: AsciiClip | null, loop = true): void {
    useEffect(() => {
        const node = ref.current;
        const ambient = requireEngine().BashcrawlAmbient;
        if (!node || !clip || !ambient) return;
        if (loop) ambient.loop(node, clip);
        else ambient.once(node, clip);
        return () => ambient.stop(node);
    }, [ref, clip, loop]);
}
