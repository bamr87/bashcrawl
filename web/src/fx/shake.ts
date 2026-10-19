// Screen shake on the trauma model: hits add trauma, the offset is
// trauma² times a little noise, decaying in under half a second. Written as
// CSS variables on #stage (the inner wrapper — never the shell, whose
// transform would re-parent the fixed overlays). `tick` is exported for tests.
const MAX_X = 10;
const MAX_Y = 10;
const MAX_ROT = 0.6;
const DECAY_S = 0.45;

let trauma = 0;
let raf = 0;
let last = 0;

function stage(): HTMLElement | null {
    return typeof document !== "undefined" ? document.getElementById("stage") : null;
}

function reducedMotion(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function noise(t: number): number {
    return Math.sin(t * 12.9898) * 0.5 + Math.sin(t * 7.233 + 1.3) * 0.35 + Math.sin(t * 3.1 + 2.1) * 0.15;
}

export function getTrauma(): number {
    return trauma;
}

export function addTrauma(amount: number): void {
    if (reducedMotion() || amount <= 0) return;
    trauma = Math.min(1, trauma + amount);
    if (!raf && typeof requestAnimationFrame === "function") {
        last = performance.now();
        raf = requestAnimationFrame(tick);
    }
}

/** One frame at `now` (ms). Returns true while shaking. */
export function tick(now: number): boolean {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    trauma = Math.max(0, trauma - dt / DECAY_S);
    const el = stage();
    if (trauma <= 0) {
        if (el) {
            el.style.removeProperty("--shake-x");
            el.style.removeProperty("--shake-y");
            el.style.removeProperty("--shake-rot");
        }
        return false;
    }
    const s = trauma * trauma;
    const t = now / 1000;
    if (el) {
        el.style.setProperty("--shake-x", `${(MAX_X * s * noise(t * 25)).toFixed(2)}px`);
        el.style.setProperty("--shake-y", `${(MAX_Y * s * noise(t * 25 + 11)).toFixed(2)}px`);
        el.style.setProperty("--shake-rot", `${(MAX_ROT * s * noise(t * 25 + 23)).toFixed(3)}deg`);
    }
    if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(tick);
    return true;
}

export function resetShake(): void {
    trauma = 0;
    if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    raf = 0;
    const el = stage();
    if (el) {
        el.style.removeProperty("--shake-x");
        el.style.removeProperty("--shake-y");
        el.style.removeProperty("--shake-rot");
    }
}
