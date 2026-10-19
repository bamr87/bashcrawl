// The event → effect table. One subscriber on the FX bus turns what a
// command changed (Hud.diffEvents) into reactions: the hero's mood and the
// panel pulses here; the particle canvas, screen shake, flashes and sound
// join in the effects step and read the same table.
import { fxBus, type FxEvent } from "../engine/fx-bus";
import type { HudEvent } from "../engine/types";
import { anchorElement } from "./anchors";
import { bump } from "./bump";
import { setHeroMood, type HeroMood } from "./hero-mood";

export interface PaneReaction {
    pane: string;
    className: "fx-sparkle" | "fx-shake" | "fx-arrive" | "fx-pulse";
    ms: number;
}

export interface Reaction {
    mood: HeroMood | null;
    panes: PaneReaction[];
}

const SPARKLE = 1100;
const SHAKE = 360;

export function reactionFor(event: HudEvent): Reaction {
    switch (event.type) {
        case "quest": return { mood: "quest", panes: [{ pane: "quest", className: "fx-sparkle", ms: SPARKLE }] };
        case "damage": return { mood: "hurt", panes: [{ pane: "pack", className: "fx-shake", ms: SHAKE }, { pane: "hp", className: "fx-shake", ms: SHAKE }] };
        case "heal": return { mood: null, panes: [{ pane: "pack", className: "fx-sparkle", ms: SPARKLE }, { pane: "hp", className: "fx-pulse", ms: 700 }] };
        case "xp": return { mood: "xp", panes: [{ pane: "xp", className: "fx-pulse", ms: 700 }] };
        case "item": return { mood: "item", panes: [{ pane: "pack", className: "fx-sparkle", ms: SPARKLE }] };
        case "levelup": return { mood: "cast", panes: [{ pane: "rank", className: "fx-sparkle", ms: SPARKLE }] };
        case "move": return { mood: null, panes: [{ pane: "room", className: "fx-arrive", ms: 700 }, { pane: "map", className: "fx-arrive", ms: 700 }] };
        case "unlock": return { mood: "cast", panes: [{ pane: "map", className: "fx-sparkle", ms: SPARKLE }, { pane: "map", className: "fx-shake", ms: SHAKE }] };
        case "lesson": return { mood: "quest", panes: [{ pane: "lesson", className: "fx-sparkle", ms: SPARKLE }] };
        case "objective": return { mood: null, panes: [{ pane: "lesson", className: "fx-pulse", ms: 700 }] };
        case "skill": return { mood: null, panes: [{ pane: "skills", className: "fx-pulse", ms: 700 }] };
        default: return { mood: null, panes: [] };
    }
}

// Moods in priority order when one command raises several events.
const MOOD_RANK: HeroMood[] = ["hurt", "quest", "cast", "item", "xp", "idle"];

export function applyReactions(events: HudEvent[], error: boolean): void {
    let mood: HeroMood | null = null;
    for (const event of events) {
        const reaction = reactionFor(event);
        for (const pane of reaction.panes) bump(anchorElement(pane.pane), pane.className, pane.ms);
        if (reaction.mood && (!mood || MOOD_RANK.indexOf(reaction.mood) < MOOD_RANK.indexOf(mood))) mood = reaction.mood;
    }
    if (mood) setHeroMood(mood);
    if (error) bump(anchorElement("log"), "fx-error", 320);
}

function onEvent(event: FxEvent): void {
    if (event.type === "command") {
        bump(anchorElement("log"), "fx-fresh", 420);
        applyReactions(event.events, event.error);
    } else if (event.type === "award") {
        applyReactions(event.events, false);
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
