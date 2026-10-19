// Transient chrome state shared across components: which dialogs are open,
// which full-screen overlay is up (the title screen, hero creation, the
// intro, the pause menu, the journal, options, the profile), and the tour's
// step while it runs.
import { getHero } from "../hero/hero-store";
import { createStore, useStore } from "../lib/store";

export type Overlay = "title" | "create" | "intro" | "menu" | "journal" | "options" | "profile" | null;

export interface UiState {
    helpOpen: boolean;
    docsOpen: boolean;
    hudOpen: boolean;
    /** Small screens: the sidebar shown as an overlay. */
    panelsOpen: boolean;
    overlay: Overlay;
    /** The guided tour's step while it runs, else null. */
    tour: number | null;
}

// No hero yet means a first visit: the title screen leads into creation.
function initialOverlay(): Overlay {
    if (typeof window === "undefined") return null;
    return getHero() ? null : "title";
}

const store = createStore<UiState>({ helpOpen: false, docsOpen: false, hudOpen: false, panelsOpen: false, overlay: initialOverlay(), tour: null });

export function setUi(patch: Partial<UiState>): void {
    const current = store.get();
    // A no-op patch must not publish: a re-render during a keypress would
    // re-subscribe dialog listeners and lose that very keypress.
    if ((Object.keys(patch) as Array<keyof UiState>).every((key) => current[key] === patch[key])) return;
    store.set({ ...current, ...patch });
}

export function toggleHelp(): void {
    setUi({ helpOpen: !store.get().helpOpen });
}

export function toggleDocs(): void {
    setUi({ docsOpen: !store.get().docsOpen });
}

export function openOverlay(overlay: Exclude<Overlay, null>): void {
    setUi({ overlay, helpOpen: false, docsOpen: false, hudOpen: false, panelsOpen: false });
}

/** Open, or close when it is the one already up (the hotkeys toggle). */
export function toggleOverlay(overlay: Exclude<Overlay, null>): void {
    if (store.get().overlay === overlay) closeOverlay();
    else openOverlay(overlay);
}

export function closeOverlay(): void {
    setUi({ overlay: null });
}

/** Nothing is up: no overlay, no tour, no dialog, no side panels. */
export function isIdle(): boolean {
    const ui = store.get();
    return ui.overlay === null && ui.tour === null && !ui.helpOpen && !ui.docsOpen && !ui.hudOpen && !ui.panelsOpen;
}

export function startTour(): void {
    setUi({ tour: 0, overlay: null, helpOpen: false, docsOpen: false, hudOpen: false, panelsOpen: false });
}

export function endTour(): void {
    setUi({ tour: null });
}

export function getUi(): UiState {
    return store.get();
}

export function useUi(): UiState {
    return useStore(store);
}
