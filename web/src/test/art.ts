// Helpers for tests that check an <ArtClip>: the clip a name resolves to in
// the bundled art (art-clips.js, generated from src/help/data/motion.yaml),
// its frames as text, what the ambient player painted, and a
// prefers-reduced-motion switch. Needs loadEngine() first.
import { vi } from "vitest";

import { requireEngine } from "../engine";

// The ambient player paints the full canvas; compare without trailing blanks.
function tidy(text: string): string {
    return text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n+$/, "");
}

export function artClip(name: string): { frames: number; frameText(index: number): string } | null {
    const { BashcrawlArtClips: clips, TermForge } = requireEngine();
    const source = clips?.[name];
    if (!source) return null;
    const clip = TermForge.asciiMotion.parse(source);
    return {
        frames: (clip as { frames: unknown[] }).frames.length,
        frameText: (index: number) => tidy(TermForge.asciiMotion.renderFrame(clip, index).text),
    };
}

export function paintedText(node: Element | null): string {
    return tidy(node?.textContent ?? "");
}

export function isPlaying(node: Element | null): boolean {
    const ambient = requireEngine().BashcrawlAmbient;
    return Boolean(node && ambient?.isPlaying(node as HTMLElement));
}

// Makes the reduced-motion media query match until the returned restore runs.
export function preferReducedMotion(): () => void {
    const real = window.matchMedia.bind(window);
    const spy = vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
        const list = real(query);
        return /prefers-reduced-motion:\s*reduce/.test(query) ? { ...list, matches: true, media: query } : list;
    });
    return () => spy.mockRestore();
}
