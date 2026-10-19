// Transient chrome state shared across components: which overlay is open.
import { createStore, useStore } from "../lib/store";
import { getPrefs } from "./prefs-store";

export interface UiState {
    helpOpen: boolean;
    docsOpen: boolean;
    hudOpen: boolean;
    /** Small screens: the sidebar shown as an overlay. */
    panelsOpen: boolean;
    /** The first-visit title screen (not when a door is linked to directly). */
    landingOpen: boolean;
}

function firstVisit(): boolean {
    if (typeof window === "undefined") return false;
    return !getPrefs().onboarded && !/^#\/\w+/.test(window.location.hash);
}

const store = createStore<UiState>({ helpOpen: false, docsOpen: false, hudOpen: false, panelsOpen: false, landingOpen: firstVisit() });

export function setUi(patch: Partial<UiState>): void {
    store.set({ ...store.get(), ...patch });
}

export function toggleHelp(): void {
    setUi({ helpOpen: !store.get().helpOpen });
}

export function toggleDocs(): void {
    setUi({ docsOpen: !store.get().docsOpen });
}

export function getUi(): UiState {
    return store.get();
}

export function useUi(): UiState {
    return useStore(store);
}
