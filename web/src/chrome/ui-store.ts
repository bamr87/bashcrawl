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
    /** The privacy panel: what is measured, and the switch. */
    privacyOpen: boolean;
    overlay: Overlay;
    /** The guided tour's step while it runs, else null. */
    tour: number | null;
}

// No hero yet means a first visit. Arriving at the site's address shows the
// home page; arriving on a door's own link (#/story…) opens the title screen
// over it, which leads into creation.
function initialOverlay(): Overlay {
    if (typeof window === "undefined" || getHero()) return null;
    return /^#\/?(story|learn|arcade|reference)\b/.test(window.location.hash) ? "title" : null;
}

const store = createStore<UiState>({ helpOpen: false, docsOpen: false, hudOpen: false, panelsOpen: false, privacyOpen: false, overlay: initialOverlay(), tour: null });

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
    return ui.overlay === null && ui.tour === null && !ui.helpOpen && !ui.docsOpen && !ui.hudOpen && !ui.panelsOpen && !ui.privacyOpen;
}

export function startTour(): void {
    setUi({ tour: 0, overlay: null, helpOpen: false, docsOpen: false, hudOpen: false, panelsOpen: false });
}

export function endTour(): void {
    setUi({ tour: null });
}

export function subscribeUi(listener: () => void): () => void {
    return store.subscribe(listener);
}

export function getUi(): UiState {
    return store.get();
}

export function useUi(): UiState {
    return useStore(store);
}
