// The hero as a CSS pixel sprite (no glyphs), in one of the LOOKS palettes
// (data-look), at a size (data-size), reacting through data-mood. Shared by
// the HUD's Hero pane, the title screen, the creation wizard and the
// profile; children go under the sprite (name plate, rank).
import type { ReactNode } from "react";

import type { HeroMood } from "../fx/hero-mood";

export interface HeroFigureProps {
    look?: number;
    mood?: HeroMood;
    /** Bumps to restart the mood animation. */
    nonce?: number;
    size?: "sm" | "md" | "lg";
    label?: string;
    className?: string;
    children?: ReactNode;
}

export function HeroFigure({ look = 0, mood = "idle", nonce = 0, size = "md", label, className, children }: HeroFigureProps) {
    return (
        <div className={`bc-hero ${className ?? ""}`} data-mood={mood} data-look={look} data-size={size} role="img" aria-label={label ?? `Pixel adventurer (${mood})`}>
            <div className="bc-hero-sprite" key={nonce}>
                <span className="bc-hero-shadow" />
                <span className="bc-hero-px bc-hero-helm" />
                <span className="bc-hero-px bc-hero-face" />
                <span className="bc-hero-px bc-hero-torso" />
                <span className="bc-hero-px bc-hero-arm bc-hero-arm-l" />
                <span className="bc-hero-px bc-hero-arm bc-hero-arm-r" />
                <span className="bc-hero-px bc-hero-legs" />
                <span className="bc-hero-px bc-hero-blade" />
                <span className="bc-hero-spark bc-hero-spark-1" />
                <span className="bc-hero-spark bc-hero-spark-2" />
                <span className="bc-hero-spark bc-hero-spark-3" />
            </div>
            {children}
        </div>
    );
}
