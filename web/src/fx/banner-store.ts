// Title cards: the big centred moments — a room entered for the first
// time, a quest cleared, a rank gained, a passage opened, a lesson done.
// One at a time from a queue, each held for its own dwell; a click skips.
import { createStore, useStore } from "../lib/store";

export type BannerKind = "room" | "quest" | "rank" | "unlock" | "lesson";

export interface Banner {
    id: number;
    kind: BannerKind;
    title: string;
    sub?: string;
}

export const BANNER_KICKER: Record<BannerKind, string> = {
    room: "You enter",
    quest: "Quest complete",
    rank: "Rank up!",
    unlock: "Passage opened",
    lesson: "Lesson complete",
};

const DWELL: Record<BannerKind, number> = { room: 1500, quest: 1900, rank: 2500, unlock: 1700, lesson: 1900 };

const store = createStore<Banner | null>(null);
const queue: Banner[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;

function show(next: Banner | null): void {
    if (timer) clearTimeout(timer);
    timer = null;
    store.set(next);
    if (next) timer = setTimeout(advance, DWELL[next.kind]);
}

function advance(): void {
    show(queue.shift() ?? null);
}

export function banner(kind: BannerKind, title: string, sub?: string): void {
    const item: Banner = { id: nextId++, kind, title, sub };
    if (store.get()) queue.push(item);
    else show(item);
}

export function dismissBanner(): void {
    if (store.get()) advance();
}

export function clearBanners(): void {
    queue.length = 0;
    show(null);
}

export function getBanner(): Banner | null {
    return store.get();
}

export function useBanner(): Banner | null {
    return useStore(store);
}
