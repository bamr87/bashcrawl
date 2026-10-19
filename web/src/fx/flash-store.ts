// Full-viewport flashes (a golden bloom on rank-up, a red edge on damage…):
// a queue of sequenced items ScreenFlash renders and removes when their
// animation ends. Under reduced motion the CSS keeps them invisible, so
// nothing flashes.
import { createStore, useStore } from "../lib/store";

export type FlashKind = "levelup" | "damage" | "heal" | "unlock" | "magic" | "poweron";

export interface FlashItem {
    seq: number;
    kind: FlashKind;
}

const store = createStore<FlashItem[]>([]);
let seq = 0;

export function flash(kind: FlashKind): number {
    const item = { seq: ++seq, kind };
    store.set([...store.get().slice(-3), item]);
    setTimeout(() => endFlash(item.seq), 1100);
    return item.seq;
}

export function endFlash(id: number): void {
    if (!store.get().some((item) => item.seq === id)) return;
    store.set(store.get().filter((item) => item.seq !== id));
}

export function useFlashes(): FlashItem[] {
    return useStore(store);
}
