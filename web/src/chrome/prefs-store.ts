// Shell preferences — the last mode and whether the landing screen has been
// seen — under the key and shape the previous UI wrote.
import { createStore, useStore } from "../lib/store";
import { readJson, writeJson } from "../lib/storage";
import { MODES, type Mode } from "../app/modes";

export const PREFS_KEY = "bashcrawl-web-shell-v1";

export interface Prefs {
    mode: Mode | null;
    onboarded: boolean;
}

function sanitize(raw: Prefs): Prefs {
    return {
        mode: raw.mode && (MODES as readonly string[]).includes(raw.mode) ? raw.mode : null,
        onboarded: raw.onboarded === true,
    };
}

const store = createStore<Prefs>(sanitize(readJson<Prefs>(PREFS_KEY, { mode: null, onboarded: false })));

export function getPrefs(): Prefs {
    return store.get();
}

export function setPrefs(patch: Partial<Prefs>): void {
    const next = sanitize({ ...store.get(), ...patch });
    store.set(next);
    writeJson(PREFS_KEY, next);
}

export function usePrefs(): Prefs {
    return useStore(store);
}
