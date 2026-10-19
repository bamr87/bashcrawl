// Sound preference: off until the player turns it on (classrooms,
// libraries), remembered under its own key.
import { createStore, useStore } from "../lib/store";
import { readRaw, writeRaw } from "../lib/storage";

export const SOUND_KEY = "bashcrawl-web-sound-v1";

export interface SoundState {
    on: boolean;
}

const store = createStore<SoundState>({ on: readRaw(SOUND_KEY) === "on" });

export function soundOn(): boolean {
    return store.get().on;
}

export function setSound(on: boolean): void {
    store.set({ on });
    writeRaw(SOUND_KEY, on ? "on" : "off");
}

export function useSound(): SoundState {
    return useStore(store);
}
