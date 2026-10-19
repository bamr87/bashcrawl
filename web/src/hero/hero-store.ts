// The hero: who is playing. A name, a path (the door they start at and the
// kind of help they like), an appearance (what the sprite is made of) and
// whether they have taken the tour — kept apart from the run
// (bashcrawl-web-state-v1) under its own key, so a new game can keep the
// hero and a new hero can keep the preferences. Nothing here reaches the
// engine: the save is the engine's and `whoami` still answers "adventurer".
import { createStore, useStore } from "../lib/store";
import { readJson, writeJson } from "../lib/storage";
import { legacyLook, sanitizeAppearance, type Appearance } from "./appearance";
import { isRole, type HeroRole } from "./roles";

export { ROLES, roleMeta, type HeroRole, type RoleMeta } from "./roles";

export const HERO_KEY = "bashcrawl-web-hero-v1";
export const NAME_MAX = 16;
export const DEFAULT_NAME = "Adventurer";

export interface Hero {
    name: string;
    role: HeroRole;
    appearance: Appearance;
    created: string;
    tourDone: boolean;
}

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

function sanitize(raw: unknown): Hero | null {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Partial<Hero> & { look?: unknown };
    if (typeof record.name !== "string") return null;
    // A hero saved before appearances existed carried one of four palettes.
    const appearance = sanitizeAppearance(record.appearance, legacyLook(record.look));
    return {
        name: cleanName(record.name),
        role: isRole(record.role) ? record.role : "wanderer",
        appearance,
        created: typeof record.created === "string" ? record.created : new Date().toISOString(),
        tourDone: record.tourDone === true,
    };
}

const store = createStore<Hero | null>(sanitize(readJson<unknown>(HERO_KEY, null)));

export function getHero(): Hero | null {
    return store.get();
}

export function createHero(input: { name: string; role: HeroRole; appearance?: Appearance }): Hero {
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
