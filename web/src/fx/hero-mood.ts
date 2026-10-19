// The hero portrait's mood: set by the effects layer when something
// happens, back to idle after the reaction. One timer, cleared before it
// is re-armed, so repeats restart the animation instead of stacking.
import { createStore, useStore } from "../lib/store";

export type HeroMood = "idle" | "hurt" | "quest" | "item" | "xp" | "cast";

export const HERO_MOOD_MS: Record<HeroMood, number> = { idle: 0, hurt: 600, quest: 1500, item: 700, xp: 900, cast: 800 };
export const HERO_MOOD_LABELS: Record<HeroMood, string> = {
    idle: "Catching their breath.",
    hurt: "Ow! That stung.",
    quest: "Quest cleared! Huzzah!",
    item: "Ooh, shiny loot!",
    xp: "Growing stronger…",
    cast: "Magick crackles…",
};

export interface HeroMoodState {
    mood: HeroMood;
    /** Bumps on every set so the same mood twice still restarts the animation. */
    nonce: number;
}

const store = createStore<HeroMoodState>({ mood: "idle", nonce: 0 });
let timer: ReturnType<typeof setTimeout> | null = null;

export function setHeroMood(mood: HeroMood): void {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    store.set({ mood, nonce: store.get().nonce + 1 });
    if (mood !== "idle") {
        timer = setTimeout(() => {
            store.set({ mood: "idle", nonce: store.get().nonce + 1 });
            timer = null;
        }, HERO_MOOD_MS[mood]);
    }
}

export function useHeroMood(): HeroMoodState {
    return useStore(store);
}
