// The effects engine behind <FxCanvas>: a particle pool and the room wipes
// painted by a requestAnimationFrame loop that runs only while something is
// alive and pauses on a hidden tab. `fx` is the API the effects table calls;
// colours are token roles resolved from the live theme. Everything here is
// a no-op until a canvas is mounted and while the user prefers reduced motion.
import { getTheme } from "../theme/theme-store";
import { anchorPoint, type Point } from "./anchors";
import { ParticleSystem, Wipe, type EmitOptions, type ParticleKind, type WipeOptions } from "./particles";

export type ColorRole = "primary" | "secondary" | "accent" | "success" | "info" | "warning" | "danger" | "ink" | "ink-muted" | "bg" | "bg-elevated";

const system = new ParticleSystem(768);
const wipes: Wipe[] = [];
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let hidden = false;
let enabled = true;
const colorCache = new Map<string, string>();
let cacheTheme = "";

function reducedMotion(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A `--fleet-color-<role>` value, cached per theme. */
export function colorOf(role: ColorRole | string): string {
    const theme = `${getTheme().pref}/${getTheme().resolved}`;
    if (theme !== cacheTheme) {
        colorCache.clear();
        cacheTheme = theme;
    }
    const cached = colorCache.get(role);
    if (cached) return cached;
    const value = typeof getComputedStyle === "function"
        ? getComputedStyle(document.documentElement).getPropertyValue(`--fleet-color-${role}`).trim()
        : "";
    const resolved = value || "currentColor";
    colorCache.set(role, resolved);
    return resolved;
}

function resize(): void {
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(now: number): void {
    raf = 0;
    if (!ctx || !canvas) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    system.step(dt);
    for (const wipe of wipes) wipe.step(dt);
    for (let i = wipes.length - 1; i >= 0; i--) if (wipes[i].done) wipes.splice(i, 1);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    system.render(ctx);
    for (const wipe of wipes) wipe.render(ctx);
    if ((system.count || wipes.length) && !hidden) raf = requestAnimationFrame(frame);
}

function ensureLoop(): void {
    if (raf || hidden || !ctx) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
}

function onResize(): void {
    resize();
}

function onVisibility(): void {
    hidden = document.hidden;
    if (hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
    } else if (!hidden) {
        ensureLoop();
    }
}

/** Called by <FxCanvas> on mount; returns the teardown. */
export function mountCanvas(element: HTMLCanvasElement): () => void {
    canvas = element;
    ctx = element.getContext("2d");
    resize();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        canvas = null;
        ctx = null;
    };
}

export interface FxEmit extends Omit<EmitOptions, "colors" | "from" | "to"> {
    from: Point | string | null;
    to?: Point | string | null;
    /** Colour roles; resolved from the theme at emit time. */
    colors: Array<ColorRole | string>;
}

function resolvePoint(value: Point | string | null | undefined): Point | null {
    if (!value) return null;
    return typeof value === "string" ? anchorPoint(value) : value;
}

export const fx = {
    get enabled(): boolean {
        return enabled && !reducedMotion();
    },
    setEnabled(value: boolean): void {
        enabled = value;
        if (!value) fx.clear();
    },
    get active(): number {
        return system.count + wipes.length;
    },
    emit(kind: ParticleKind, options: FxEmit): number {
        if (!fx.enabled || !ctx) return 0;
        const from = resolvePoint(options.from);
        if (!from) return 0;
        const to = resolvePoint(options.to) ?? undefined;
        const colors = options.colors.map((role) => colorOf(role));
        const n = system.emit(kind, { ...options, from, to, colors });
        ensureLoop();
        return n;
    },
    /** Pixel-dissolve a rectangle; onSwap fires at the darkest moment. */
    wipe(options: Omit<WipeOptions, "color"> & { color?: ColorRole | string }): void {
        if (!fx.enabled || !ctx) {
            options.onSwap?.();
            return;
        }
        wipes.push(new Wipe({ ...options, color: colorOf(options.color ?? "bg") }));
        ensureLoop();
    },
    clear(): void {
        system.clear();
        wipes.length = 0;
        if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    },
};
