// The hero in the page: the pixel sprite in their own palette, at a size
// (data-size), reacting through data-mood, with children under it (name
// plate, rank). Shared by the HUD's Hero pane, the title screen, creation,
// the profile and the header (crop="bust"). The palette picks travel as
// CSS variables; hud.css derives the shades and animates the layers.
import type { CSSProperties, ReactNode } from "react";

import type { HeroMood } from "../fx/hero-mood";
import { DEFAULT_APPEARANCE, paletteStyle, type Appearance } from "./appearance";
import { HeroSprite, type SpriteCrop } from "./HeroSprite";

export interface HeroFigureProps {
    appearance?: Appearance;
    mood?: HeroMood;
    /** Bumps to restart the mood animation. */
    nonce?: number;
    size?: "sm" | "md" | "lg";
    crop?: SpriteCrop;
    label?: string;
    className?: string;
    children?: ReactNode;
}

export function HeroFigure({ appearance = DEFAULT_APPEARANCE, mood = "idle", nonce = 0, size = "md", crop = "full", label, className, children }: HeroFigureProps) {
    return (
        <div
            className={`bc-hero ${className ?? ""}`}
            data-mood={mood}
            data-size={size}
            data-crop={crop}
            style={paletteStyle(appearance) as CSSProperties}
            role="img"
            aria-label={label ?? `Pixel adventurer (${mood})`}
        >
            <div className="bc-hero-sprite" key={nonce}>
                <span className="bc-hero-shadow" />
                <HeroSprite appearance={appearance} crop={crop} />
                <span className="bc-hero-spark bc-hero-spark-1" />
                <span className="bc-hero-spark bc-hero-spark-2" />
                <span className="bc-hero-spark bc-hero-spark-3" />
            </div>
            {children}
        </div>
    );
}
