// Art in the page is drawn from the same ASCII Motion clips as the game
// (motion/art/, bundled in art-clips.js), never from string literals. A
// multi-frame clip plays once (or loops); a still is painted as is.
import { useEffect, useRef } from "react";

import { requireEngine } from "../engine";

export interface ArtClipProps {
    name: string;
    loop?: boolean;
    className?: string;
}

export function ArtClip({ name, loop = false, className }: ArtClipProps) {
    const ref = useRef<HTMLPreElement>(null);
    useEffect(() => {
        const node = ref.current;
        const { BashcrawlAmbient: ambient, BashcrawlArtClips: clips, TermForge } = requireEngine();
        const source = clips?.[name];
        if (!node || !source) return;
        if (ambient) {
            if (loop) ambient.loop(node, source);
            else ambient.once(node, source);
            return () => ambient.stop(node);
        }
        try {
            node.textContent = TermForge.asciiMotion.renderFrame(TermForge.asciiMotion.parse(source), 0).text;
        } catch {
            node.textContent = "";
        }
    }, [name, loop]);
    return <pre ref={ref} className={className} data-art={name} aria-hidden="true" />;
}
