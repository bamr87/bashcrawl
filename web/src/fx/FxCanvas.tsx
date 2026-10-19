// The effects canvas: one fixed, pointer-events-none layer over the page,
// handed to the fx engine for its lifetime.
import { useEffect, useRef } from "react";

import { mountCanvas } from "./fx-engine";

export function FxCanvas() {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => (ref.current ? mountCanvas(ref.current) : undefined), []);
    return <canvas ref={ref} className="bc-fx-canvas" aria-hidden="true" />;
}
