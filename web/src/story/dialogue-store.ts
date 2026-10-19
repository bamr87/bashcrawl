// The dialogue queue: chapters waiting to be told in the box under the log,
// one at a time, page by page. Pushed by the story observer; advanced by
// the player.
import { createStore, useStore } from "../lib/store";

export interface Dialogue {
    id: string;
    kicker: string;
    title: string;
    pages: string[];
}

export interface DialogueState {
    current: Dialogue | null;
    page: number;
    queued: number;
}

const queue: Dialogue[] = [];
const store = createStore<DialogueState>({ current: null, page: 0, queued: 0 });

function next(): void {
    const upcoming = queue.shift() ?? null;
    store.set({ current: upcoming, page: 0, queued: queue.length });
}

export function pushDialogue(dialogue: Dialogue): void {
    if (store.get().current) {
        queue.push(dialogue);
        store.set({ ...store.get(), queued: queue.length });
    } else {
        store.set({ current: dialogue, page: 0, queued: 0 });
    }
}

/** The next page, or the next dialogue when the last page is done. */
export function advanceDialogue(): void {
    const state = store.get();
    if (!state.current) return;
    if (state.page + 1 < state.current.pages.length) store.set({ ...state, page: state.page + 1 });
    else next();
}

export function dismissDialogue(): void {
    if (store.get().current) next();
}

export function clearDialogues(): void {
    queue.length = 0;
    store.set({ current: null, page: 0, queued: 0 });
}

export function getDialogue(): DialogueState {
    return store.get();
}

export function useDialogue(): DialogueState {
    return useStore(store);
}
