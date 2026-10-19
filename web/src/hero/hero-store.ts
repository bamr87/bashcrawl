// The hero: who is playing. A name, a path (the door they start at and the
// kind of help they like), a look (the sprite's palette) and whether they
// have taken the tour — kept apart from the run (bashcrawl-web-state-v1)
// under its own key, so a new game can keep the hero and a new hero can
// keep the preferences. Nothing here reaches the engine: the save is the
// engine's and `whoami` still answers "adventurer".
import type { Mode } from "../app/modes";
import { createStore, useStore } from "../lib/store";
import { readJson, writeJson } from "../lib/storage";

export const HERO_KEY = "bashcrawl-web-hero-v1";
export const NAME_MAX = 16;
export const DEFAULT_NAME = "Adventurer";

export type HeroRole = "wanderer" | "scribe" | "rogue" | "sage";

export interface Hero {
    name: string;
    role: HeroRole;
    /** Index into LOOKS: the sprite's palette (data-look). */
    look: number;
    created: string;
    tourDone: boolean;
}

export interface RoleMeta {
    id: HeroRole;
    title: string;
    icon: string;
    blurb: string;
    trait: string;
    /** The door this path opens on. */
    door: Mode;
}

export const ROLES: readonly RoleMeta[] = [
    {
        id: "wanderer",
        title: "Wanderer",
        icon: "⚔",
        blurb: "Learns by walking. Starts in the Story dungeon and follows the quests room by room.",
        trait: "The quest panel always shows the next spell.",
        door: "story",
    },
    {
        id: "scribe",
        title: "Scribe",
        icon: "📜",
        blurb: "Learns by reading. Starts in the Learn door with a guided course and a practice lab.",
        trait: "Lessons tick off objectives as you type.",
        door: "learn",
    },
    {
        id: "rogue",
        title: "Rogue",
        icon: "🗡",
        blurb: "Learns by doing it fast. Starts in the Arcade's timed trials and comes back for the story.",
        trait: "Speed and streaks earn the XP.",
        door: "arcade",
    },
    {
        id: "sage",
        title: "Sage",
        icon: "🔮",
        blurb: "Learns by looking it up. Starts with the Reference open, then descends with the cheatsheet at hand.",
        trait: "Any reference command drops into the prompt.",
        door: "reference",
    },
];

export const LOOKS: readonly string[] = ["Verdant", "Gold", "Arcane", "Ember"];

const HEADS = ["Ael", "Bryn", "Cor", "Dag", "Eir", "Fen", "Gal", "Hal", "Isk", "Kael", "Lir", "Mor", "Nim", "Orr", "Pel", "Quin", "Ryn", "Sel", "Tam", "Ulf", "Vey", "Wyn", "Yor", "Zan"];
const TAILS = ["a", "ia", "on", "en", "is", "ric", "wyn", "dor", "ith", "ar", "ow", "ene"];

/** A fantasy name from a seedable source, for the ⚄ Roll button. */
export function rollName(rng: () => number = Math.random): string {
    const pick = (list: readonly string[]) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))] ?? "";
    const head = pick(HEADS);
    return rng() < 0.3 ? head : head + pick(TAILS);
}

/** Printable, single-spaced, at most NAME_MAX characters; empty falls back to the default. */
export function cleanName(raw: string): string {
    // eslint-disable-next-line no-control-regex
    const text = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
    return text || DEFAULT_NAME;
}

export function roleMeta(role: HeroRole): RoleMeta {
    return ROLES.find((entry) => entry.id === role) ?? ROLES[0];
}

function isRole(value: unknown): value is HeroRole {
    return ROLES.some((entry) => entry.id === value);
}

function sanitize(raw: unknown): Hero | null {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Partial<Hero>;
    if (typeof record.name !== "string") return null;
    const look = typeof record.look === "number" && Number.isInteger(record.look) && record.look >= 0 && record.look < LOOKS.length ? record.look : 0;
    return {
        name: cleanName(record.name),
        role: isRole(record.role) ? record.role : "wanderer",
        look,
        created: typeof record.created === "string" ? record.created : new Date().toISOString(),
        tourDone: record.tourDone === true,
    };
}

const store = createStore<Hero | null>(sanitize(readJson<unknown>(HERO_KEY, null)));

export function getHero(): Hero | null {
    return store.get();
}

export function createHero(input: { name: string; role: HeroRole; look: number }): Hero {
    const hero = sanitize({ ...input, created: new Date().toISOString(), tourDone: false }) as Hero;
    store.set(hero);
    writeJson(HERO_KEY, hero);
    return hero;
}

export function setHero(patch: Partial<Hero>): Hero | null {
    const current = store.get();
    if (!current) return null;
    const next = sanitize({ ...current, ...patch }) as Hero;
    store.set(next);
    writeJson(HERO_KEY, next);
    return next;
}

export function clearHero(): void {
    store.set(null);
    try {
        window.localStorage.removeItem(HERO_KEY);
    } catch {
        // storage blocked: the in-memory hero is gone, which is what matters
    }
}

export function useHero(): Hero | null {
    return useStore(store);
}
