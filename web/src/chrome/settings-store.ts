// Game options beyond theme, sound and CRT (which keep their own keys):
// how much the screen moves, how fast text arrives, how big it is. Applied
// as data attributes on <html> so CSS and the effects layer read one
// source; remembered under one key.
import { fx } from "../fx/fx-engine";
import { createStore, useStore } from "../lib/store";
import { readJson, writeJson } from "../lib/storage";

export const SETTINGS_KEY = "bashcrawl-web-settings-v1";

export type EffectsLevel = "full" | "light" | "off";
export type TextSpeed = "instant" | "normal" | "slow";
export type TextSize = "small" | "normal" | "large";

export interface Settings {
    /** full: particles, flashes, shake · light: particles only · off: none. */
    effects: EffectsLevel;
    shake: boolean;
    /** How fast a block of output cascades in. */
    textSpeed: TextSpeed;
    textSize: TextSize;
}

export const DEFAULT_SETTINGS: Settings = { effects: "full", shake: true, textSpeed: "normal", textSize: "normal" };

export const EFFECTS_LEVELS: readonly EffectsLevel[] = ["full", "light", "off"];
export const TEXT_SPEEDS: readonly TextSpeed[] = ["instant", "normal", "slow"];
export const TEXT_SIZES: readonly TextSize[] = ["small", "normal", "large"];

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
    return (list as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function sanitize(raw: Partial<Settings>): Settings {
    return {
        effects: oneOf(EFFECTS_LEVELS, raw.effects, DEFAULT_SETTINGS.effects),
        shake: raw.shake !== false,
        textSpeed: oneOf(TEXT_SPEEDS, raw.textSpeed, DEFAULT_SETTINGS.textSpeed),
        textSize: oneOf(TEXT_SIZES, raw.textSize, DEFAULT_SETTINGS.textSize),
    };
}

const store = createStore<Settings>(DEFAULT_SETTINGS);

function apply(settings: Settings): void {
    const root = document.documentElement;
    root.dataset.effects = settings.effects;
    root.dataset.shake = settings.shake ? "on" : "off";
    root.dataset.textSpeed = settings.textSpeed;
    root.dataset.textSize = settings.textSize;
    fx.setEnabled(settings.effects !== "off");
    store.set(settings);
}

let booted = false;
export function initSettings(): void {
    if (booted) return;
    booted = true;
    apply(sanitize(readJson<Partial<Settings>>(SETTINGS_KEY, {})));
}

export function setSettings(patch: Partial<Settings>): void {
    const next = sanitize({ ...store.get(), ...patch });
    writeJson(SETTINGS_KEY, next);
    apply(next);
}

export function getSettings(): Settings {
    return store.get();
}

export function useSettings(): Settings {
    return useStore(store);
}

/** What the effects layer may do right now. */
export function allowed(): { particles: boolean; flash: boolean; shake: boolean } {
    const s = store.get();
    return { particles: s.effects !== "off", flash: s.effects === "full", shake: s.shake && s.effects !== "off" };
}
