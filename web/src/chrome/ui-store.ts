// Transient chrome state shared across components: which overlay is open.
import { createStore, useStore } from "../lib/store";

export interface UiState {
    helpOpen: boolean;
    docsOpen: boolean;
    hudOpen: boolean;
    /** Small screens: the sidebar shown as an overlay. */
    panelsOpen: boolean;
}

const store = createStore<UiState>({ helpOpen: false, docsOpen: false, hudOpen: false, panelsOpen: false });

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
