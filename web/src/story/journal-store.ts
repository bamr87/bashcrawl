// The journal: what the hero has earned and seen — chapters unlocked,
// scrolls read (with the command that re-opens them), halls discovered,
// ranks gained — in the order it happened, with an unread mark. Persisted
// apart from the save under its own key; quests, bestiary and badges are
// read live from the engine instead.
import { createStore, useStore } from "../lib/store";
import { readJson, writeJson } from "../lib/storage";

export const JOURNAL_KEY = "bashcrawl-web-journal-v1";

export type EntryKind = "chapter" | "scroll" | "room" | "rank";

export interface JournalEntry {
    id: string;
    kind: EntryKind;
    title: string;
    /** Chapters: the chronicle key; scrolls: the file path; rooms: the path. */
    ref: string;
    body?: string;
    room?: string;
    /** A command that brings the thing back (`cat /entrance/scroll`, `cd /entrance/cellar`). */
    command?: string;
    when: string;
}

export interface JournalState {
    entries: JournalEntry[];
    /** Entries at or before this time have been seen. */
    readAt: string | null;
}

function sanitize(raw: Partial<JournalState> | null | undefined): JournalState {
    const entries = Array.isArray(raw?.entries)
        ? raw.entries.filter((entry): entry is JournalEntry => Boolean(entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.title === "string"))
        : [];
    return { entries, readAt: typeof raw?.readAt === "string" ? raw.readAt : null };
}

const store = createStore<JournalState>(sanitize(readJson<Partial<JournalState>>(JOURNAL_KEY, {})));

function save(next: JournalState): void {
    store.set(next);
    writeJson(JOURNAL_KEY, next);
}

export function getJournal(): JournalState {
    return store.get();
}

/** Add an entry once; returns true when it was new. */
export function recordEntry(entry: Omit<JournalEntry, "when">): boolean {
    const current = store.get();
    if (current.entries.some((existing) => existing.id === entry.id)) return false;
    save({ ...current, entries: [...current.entries, { ...entry, when: new Date().toISOString() }] });
    return true;
}

export function recordChapter(key: string, title: string): boolean {
    return recordEntry({ id: `chapter:${key}`, kind: "chapter", title, ref: key });
}

export function recordScroll(path: string, title: string, room: string): boolean {
    return recordEntry({ id: `scroll:${path}`, kind: "scroll", title, ref: path, room, command: `cat ${path}` });
}

export function recordRoom(path: string, title: string, body: string): boolean {
    return recordEntry({ id: `room:${path}`, kind: "room", title, ref: path, body, command: `cd ${path}` });
}

export function hasChapter(key: string): boolean {
    return store.get().entries.some((entry) => entry.id === `chapter:${key}`);
}

export function unreadCount(state: JournalState = store.get()): number {
    const since = state.readAt ? Date.parse(state.readAt) : 0;
    return state.entries.filter((entry) => Date.parse(entry.when) > since).length;
}

export function markJournalRead(): void {
    save({ ...store.get(), readAt: new Date().toISOString() });
}

/** A new game forgets the journal too. */
export function resetJournal(): void {
    save({ entries: [], readAt: null });
}

export function useJournal(): JournalState {
    return useStore(store);
}
