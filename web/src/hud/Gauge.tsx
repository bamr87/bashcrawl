// A segmented RPG gauge. The fill width is a CSS variable so the bar
// animates with the token's motion duration; the tone picks the colour.
import type { CSSProperties } from "react";

export interface GaugeProps {
    value: number;
    max: number;
    label: string;
    tone?: "xp" | "hp" | "skill" | "quest";
    segments?: number;
    className?: string;
}

export function Gauge({ value, max, label, tone = "xp", segments = 10, className }: GaugeProps) {
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
    const level = pct <= 25 ? "low" : pct <= 50 ? "mid" : "high";
    const style = { "--fill": pct, "--segments": segments } as CSSProperties;
    return (
        <span className={`bc-gauge ${className ?? ""}`} role="img" aria-label={label} data-tone={tone} data-level={level} style={style}>
            <span className="bc-gauge-fill" />
            <span className="bc-gauge-segs" aria-hidden="true" />
        </span>
    );
}
