// The prompt's text lives outside the input so chips, the reference's ▶
// buttons and the lesson reader can fill it from anywhere; a focus nonce
// asks the mounted PromptBar to take focus with the caret at the end.
import { createStore, useStore } from "../lib/store";

export interface PromptState {
    value: string;
    focusNonce: number;
}

const store = createStore<PromptState>({ value: "", focusNonce: 0 });

export function setPromptValue(value: string): void {
    store.set({ ...store.get(), value });
}

export function fillPrompt(value: string): void {
    store.set({ value, focusNonce: store.get().focusNonce + 1 });
}

export function focusPrompt(): void {
    store.set({ ...store.get(), focusNonce: store.get().focusNonce + 1 });
}

export function getPrompt(): PromptState {
    return store.get();
}

export function usePrompt(): PromptState {
    return useStore(store);
}
