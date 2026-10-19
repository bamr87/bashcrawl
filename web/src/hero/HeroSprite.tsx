// The sprite as SVG: one <g> per layer so CSS can animate the eyes (blink),
// the weapon (thrust) and the companion (hop), one <rect> per horizontal
// run, each filled from the --hero-* slot variables the figure sets.
import { compose, OUT_H, OUT_W, SCALE, SLOT_VARS } from "./sprite";
import type { Appearance } from "./appearance";

export type SpriteCrop = "full" | "bust";

/** Head and shoulders (authored cells 2–14 × 0–13), for the header. */
const BUST_VIEWBOX = `${2 * SCALE} 0 ${12 * SCALE} ${13 * SCALE}`;

export function HeroSprite({ appearance, crop = "full" }: { appearance: Appearance; crop?: SpriteCrop }) {
    const layers = compose(appearance);
    return (
        <svg
            className="bc-hero-svg"
            viewBox={crop === "bust" ? BUST_VIEWBOX : `0 0 ${OUT_W} ${OUT_H}`}
            shapeRendering="crispEdges"
            aria-hidden="true"
            focusable="false"
        >
            {layers.map((layer) => layer.runs.length > 0 && (
                <g key={layer.name} className={`bc-hero-${layer.name}`}>
                    {layer.runs.map((run) => (
                        <rect key={`${run.x},${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={`var(--hero-${SLOT_VARS[run.slot]})`} />
                    ))}
                </g>
            ))}
        </svg>
    );
}
