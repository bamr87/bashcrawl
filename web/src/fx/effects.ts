// The event → effect table. One subscriber on the FX bus turns what a
// command changed (Hud.diffEvents) into reactions: canvas particles, screen
// shake, a full-screen flash, panel pulses, the hero's mood and a sound.
// `effectFor` is pure data (tested); `applyReactions` performs it.
import { play, type SfxName } from "../audio/sfx";
import { fxBus, type FxEvent } from "../engine/fx-bus";
import { requireEngine } from "../engine/index";
import type { HudEvent } from "../engine/types";
import { anchorElement, anchorPoint, logTailPoint } from "./anchors";
import { bump } from "./bump";
import { flash, type FlashKind } from "./flash-store";
import { fx, type ColorRole } from "./fx-engine";
import { setHeroMood, type HeroMood } from "./hero-mood";
import { type ParticleKind } from "./particles";
import { addTrauma } from "./shake";

export interface PaneReaction {
    pane: string;
    className: "fx-sparkle" | "fx-shake" | "fx-arrive" | "fx-pulse";
    ms: number;
}

export interface CanvasBurst {
    kind: ParticleKind;
    /** Anchor name, or "log-tail". */
    from: string;
    to?: string;
    count: number;
    colors: ColorRole[];
    spread?: number;
    size?: number;
}

export interface Effect {
    mood: HeroMood | null;
    panes: PaneReaction[];
    canvas: CanvasBurst[];
    shake: number;
    flash: FlashKind | null;
    sfx: SfxName | null;
    /** Pixel-dissolve the stage (room change). */
    wipe: boolean;
}

const SPARKLE = 1100;
const SHAKE = 360;

function clamp(value: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, value));
}

export function effectFor(event: HudEvent): Effect {
    const none: Effect = { mood: null, panes: [], canvas: [], shake: 0, flash: null, sfx: null, wipe: false };
    switch (event.type) {
        case "xp":
            return {
                ...none,
                mood: "xp",
                sfx: "xp",
                panes: [{ pane: "xp", className: "fx-pulse", ms: 700 }],
                canvas: [{ kind: "orb", from: "log-tail", to: "xp", count: clamp(Math.round((event.amount ?? 5) / 5), 3, 14), colors: ["accent", "primary"] }],
            };
        case "quest":
            return {
                ...none,
                mood: "quest",
                sfx: "quest",
                shake: 0.15,
                panes: [{ pane: "quest", className: "fx-sparkle", ms: SPARKLE }],
                canvas: [
                    { kind: "spark", from: "quest", count: 24, colors: ["primary", "warning"] },
                    { kind: "ring", from: "quest", count: 1, colors: ["primary"], size: 80 },
                ],
            };
        case "levelup":
            return {
                ...none,
                mood: "cast",
                sfx: "levelup",
                shake: 0.2,
                flash: "levelup",
                panes: [{ pane: "rank", className: "fx-sparkle", ms: SPARKLE }],
                canvas: [
                    { kind: "confetti", from: "top", count: 90, colors: ["primary", "accent", "success", "info", "warning"], spread: 900 },
                    { kind: "glint", from: "rank", count: 5, colors: ["primary"], spread: 120 },
                ],
            };
        case "damage":
            return {
                ...none,
                mood: "hurt",
                sfx: "damage",
                shake: clamp(0.35 + (event.amount ?? 0) / 100, 0.35, 0.9),
                flash: "damage",
                panes: [{ pane: "pack", className: "fx-shake", ms: SHAKE }, { pane: "hp", className: "fx-shake", ms: SHAKE }],
                canvas: [{ kind: "spark", from: "hp", count: 10, colors: ["danger", "secondary"] }],
            };
        case "heal":
            return {
                ...none,
                sfx: "heal",
                flash: "heal",
                panes: [{ pane: "pack", className: "fx-sparkle", ms: SPARKLE }, { pane: "hp", className: "fx-pulse", ms: 700 }],
                canvas: [{ kind: "ember", from: "hp", count: 12, colors: ["success"], spread: 80 }],
            };
        case "item":
            return {
                ...none,
                mood: "item",
                sfx: "item",
                panes: [{ pane: "pack", className: "fx-sparkle", ms: SPARKLE }],
                canvas: [{ kind: "glint", from: "pack", count: 4 + (event.items?.length ?? 1) * 2, colors: ["warning", "primary"], spread: 160 }],
            };
        case "move":
            return {
                ...none,
                sfx: "warp",
                wipe: true,
                panes: [{ pane: "room", className: "fx-arrive", ms: 700 }, { pane: "map", className: "fx-arrive", ms: 700 }],
            };
        case "unlock":
            return {
                ...none,
                mood: "cast",
                sfx: "unlock",
                shake: 0.2,
                flash: "unlock",
                panes: [{ pane: "map", className: "fx-sparkle", ms: SPARKLE }, { pane: "map", className: "fx-shake", ms: SHAKE }],
                canvas: [{ kind: "spark", from: "map", count: 30, colors: ["warning", "primary"] }],
            };
        case "lesson":
            return {
                ...none,
                mood: "quest",
                sfx: "lesson",
                flash: "magic",
                panes: [{ pane: "lesson", className: "fx-sparkle", ms: SPARKLE }],
                canvas: [{ kind: "confetti", from: "lesson", count: 40, colors: ["info", "accent", "primary"], spread: 300 }],
            };
        case "objective":
            return {
                ...none,
                sfx: "objective",
                panes: [{ pane: "lesson", className: "fx-pulse", ms: 700 }],
                canvas: [{ kind: "ring", from: "lesson", count: 1, colors: ["info"], size: 60 }],
            };
        case "skill":
            return {
                ...none,
                sfx: "skill",
                panes: [{ pane: "skills", className: "fx-pulse", ms: 700 }],
                canvas: [{ kind: "ember", from: "skills", count: 6, colors: ["info", "accent"], spread: 60 }],
            };
        default:
            return none;
    }
}

// Moods in priority order when one command raises several events.
const MOOD_RANK: HeroMood[] = ["hurt", "quest", "cast", "item", "xp", "idle"];
// Sounds in priority order: one phrase per command, the loudest moment wins.
const SFX_RANK: SfxName[] = ["levelup", "damage", "quest", "lesson", "unlock", "heal", "item", "objective", "skill", "xp", "warp"];

function topPoint() {
    return { x: window.innerWidth / 2, y: -10 };
}

function stageRect() {
    const stage = anchorElement("stage");
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

export function applyReactions(events: HudEvent[], error: boolean, moveSfx?: SfxName | null): void {
    let mood: HeroMood | null = null;
    let sfx: SfxName | null = null;
    let shake = 0;
    for (const event of events) {
        const effect = effectFor(event);
        for (const pane of effect.panes) bump(anchorElement(pane.pane), pane.className, pane.ms);
        for (const burst of effect.canvas) {
            const from = burst.from === "log-tail" ? logTailPoint() : burst.from === "top" ? topPoint() : anchorPoint(burst.from) ?? logTailPoint();
            fx.emit(burst.kind, {
                from,
                to: burst.to ?? null,
                count: burst.count,
                colors: burst.colors,
                spread: burst.spread,
                size: burst.size,
                onArrive: burst.kind === "orb" ? () => bump(anchorElement("xp"), "fx-pulse", 300) : undefined,
            });
        }
        if (effect.flash) flash(effect.flash);
        if (effect.wipe) {
            const rect = stageRect();
            if (rect) fx.wipe({ rect, color: "bg", onSwap: () => bump(anchorElement("log"), "fx-arrive", 600) });
        }
        shake = Math.max(shake, effect.shake);
        if (effect.mood && (!mood || MOOD_RANK.indexOf(effect.mood) < MOOD_RANK.indexOf(mood))) mood = effect.mood;
        const candidate = effect.sfx === "warp" && moveSfx ? moveSfx : effect.sfx;
        if (candidate && (!sfx || SFX_RANK.indexOf(candidate) < SFX_RANK.indexOf(sfx))) sfx = candidate;
    }
    if (mood) setHeroMood(mood);
    if (shake) addTrauma(shake);
    if (error) {
        bump(anchorElement("log"), "fx-error", 320);
        addTrauma(0.08);
        play("error");
    } else if (sfx) {
        play(sfx);
    }
}

// Command clips and the per-command tint: the engine's own catalogue
// (web/assets/js/fx.js) paints the ASCII Motion stage into the .px-am band
// and stamps data-fx-* on the stage; the prompt and form get their pulses.
function applyCommandFx(line: string, error: boolean, events: HudEvent[]): SfxName | null {
    const catalog = requireEngine().BashcrawlCommandFx;
    if (!catalog) return null;
    const log = anchorElement("log");
    const stage = anchorElement("stage");
    const form = document.querySelector<HTMLElement>(".bc-prompt");
    const prompt = document.querySelector<HTMLElement>(".bc-prompt-label");
    // The clip band opening or closing resizes the log over the next frames
    // (its grid track animates). Hold the bottom only when the reader was
    // there: a long scroll the store opened at its title keeps its place.
    const atBottom = !log || log.scrollHeight - log.clientHeight - log.scrollTop <= 4;
    const spec = catalog.apply(line, { log, root: stage, form, prompt, error, events });
    if (log && atBottom) holdBottom(log, 360);
    if (spec.motion === "climb") return "climb";
    if (spec.motion === "rewind") return "rewind";
    return null;
}

/** Keep a scroller pinned to its end while its height is animating. */
function holdBottom(log: HTMLElement, ms: number): void {
    const until = performance.now() + ms;
    const tick = () => {
        log.scrollTop = log.scrollHeight;
        if (performance.now() < until && typeof requestAnimationFrame === "function") requestAnimationFrame(tick);
    };
    tick();
}

function onEvent(event: FxEvent): void {
    switch (event.type) {
        case "command": {
            bump(anchorElement("log"), "fx-fresh", 420);
            play("key");
            const moveSfx = applyCommandFx(event.line, event.error, event.events);
            applyReactions(event.events, event.error, moveSfx);
            break;
        }
        case "award":
            applyReactions(event.events, false);
            break;
        case "celebrate":
            flash("magic");
            addTrauma(0.1);
            fx.emit("confetti", { from: topPoint(), count: 60, colors: ["primary", "accent", "success", "info"], spread: 900 });
            play("celebrate");
            break;
        case "boot":
            flash("poweron");
            fx.emit("ember", { from: anchorPoint("stage") ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }, count: 20, colors: ["secondary", "warning"], spread: 400 });
            play("poweron");
            break;
        case "mode":
            play("tab");
            break;
    }
}

let installed: (() => void) | null = null;

/** Subscribe once; returns the unsubscribe (tests use it). */
export function installEffects(): () => void {
    if (installed) return installed;
    const off = fxBus.subscribe(onEvent);
    installed = () => {
        off();
        installed = null;
    };
    return installed;
}
