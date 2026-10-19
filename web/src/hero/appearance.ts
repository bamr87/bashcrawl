// What a hero looks like: the catalogue of parts and palettes the sprite is
// composed from, the role presets, a random roll, the sanitiser a saved
// appearance passes through, and the CSS variables that hand the palette
// picks to the sprite. Palette entries are indices into the --bc-hero-*
// tokens (styles/tokens.css), never colours.
import type { HeroRole } from "./roles";

export const HAIR_STYLES = ["short", "long", "braid", "mohawk", "curly", "bald"] as const;
export const HEADGEARS = ["none", "hood", "hat", "helm", "crown", "bandana", "circlet"] as const;
export const OUTFITS = ["tunic", "robe", "leather", "plate", "coat"] as const;
export const WEAPONS = ["sword", "staff", "dagger", "bow", "tome", "lantern", "none"] as const;
export const COMPANIONS = ["none", "cat", "bat", "slime", "owl", "frog"] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type Headgear = (typeof HEADGEARS)[number];
export type Outfit = (typeof OUTFITS)[number];
export type Weapon = (typeof WEAPONS)[number];
export type Companion = (typeof COMPANIONS)[number];

export const SKIN_NAMES = ["Porcelain", "Fair", "Tan", "Bronze", "Umber", "Ebony"] as const;
export const EYE_NAMES = ["Brown", "Blue", "Green", "Violet"] as const;
export const HAIR_COLOR_NAMES = ["Raven", "Chestnut", "Gold", "Copper", "Silver", "Sapphire", "Violet", "Moss"] as const;
export const DYE_NAMES = ["Forest", "Royal", "Crimson", "Violet", "Ochre", "Teal", "Slate", "Linen", "Rose", "Midnight"] as const;
export const TRIM_NAMES = ["Gold", "Silver", "Ivory", "Crimson", "Sapphire", "Obsidian"] as const;

export const HAIR_LABELS: Record<HairStyle, string> = { short: "Short", long: "Long", braid: "Braid", mohawk: "Mohawk", curly: "Curly", bald: "Bald" };
export const HEADGEAR_LABELS: Record<Headgear, string> = { none: "None", hood: "Hood", hat: "Wizard hat", helm: "Helm", crown: "Crown", bandana: "Bandana", circlet: "Circlet" };
export const OUTFIT_LABELS: Record<Outfit, string> = { tunic: "Tunic", robe: "Robe", leather: "Leathers", plate: "Plate", coat: "Coat" };
export const WEAPON_LABELS: Record<Weapon, string> = { sword: "Sword", staff: "Staff", dagger: "Dagger", bow: "Bow", tome: "Tome", lantern: "Lantern", none: "None" };
export const COMPANION_LABELS: Record<Companion, string> = { none: "None", cat: "Cat", bat: "Bat", slime: "Slime", owl: "Owl", frog: "Frog" };

export interface Appearance {
    /** Index into SKIN_NAMES / --bc-hero-skin-N. */
    skin: number;
    eyes: number;
    hair: HairStyle;
    hairColor: number;
    headgear: Headgear;
    outfit: Outfit;
    /** The outfit's cloth: index into DYE_NAMES. */
    dye: number;
    trim: number;
    weapon: Weapon;
    /** A cape in this dye, or none. */
    cape: number | null;
    companion: Companion;
}

export const DEFAULT_APPEARANCE: Appearance = {
    skin: 1,
    eyes: 0,
    hair: "short",
    hairColor: 1,
    headgear: "none",
    outfit: "tunic",
    dye: 0,
    trim: 0,
    weapon: "sword",
    cape: null,
    companion: "none",
};

/** What each path looks like until the player says otherwise. */
export const ROLE_PRESETS: Record<HeroRole, Appearance> = {
    wanderer: { ...DEFAULT_APPEARANCE },
    scribe: { ...DEFAULT_APPEARANCE, hair: "long", hairColor: 0, headgear: "circlet", outfit: "robe", dye: 1, trim: 0, weapon: "tome", companion: "owl" },
    rogue: { ...DEFAULT_APPEARANCE, hair: "short", hairColor: 0, headgear: "hood", outfit: "leather", dye: 6, trim: 5, weapon: "dagger", cape: 9, companion: "cat" },
    sage: { ...DEFAULT_APPEARANCE, hair: "long", hairColor: 4, headgear: "hat", outfit: "robe", dye: 3, trim: 0, weapon: "staff", companion: "bat" },
};

/** The four palettes the first heroes chose from, for a save written before appearances existed. */
const LEGACY_LOOK_DYES = [0, 4, 3, 2];

export function legacyLook(look: unknown): Appearance {
    const index = typeof look === "number" && Number.isInteger(look) ? look : 0;
    return { ...DEFAULT_APPEARANCE, dye: LEGACY_LOOK_DYES[index] ?? 0 };
}

function index(value: unknown, count: number, fallback: number): number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count ? value : fallback;
}

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
    return (list as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

export function sanitizeAppearance(raw: unknown, fallback: Appearance = DEFAULT_APPEARANCE): Appearance {
    const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Appearance, unknown>>;
    return {
        skin: index(r.skin, SKIN_NAMES.length, fallback.skin),
        eyes: index(r.eyes, EYE_NAMES.length, fallback.eyes),
        hair: oneOf(HAIR_STYLES, r.hair, fallback.hair),
        hairColor: index(r.hairColor, HAIR_COLOR_NAMES.length, fallback.hairColor),
        headgear: oneOf(HEADGEARS, r.headgear, fallback.headgear),
        outfit: oneOf(OUTFITS, r.outfit, fallback.outfit),
        dye: index(r.dye, DYE_NAMES.length, fallback.dye),
        trim: index(r.trim, TRIM_NAMES.length, fallback.trim),
        weapon: oneOf(WEAPONS, r.weapon, fallback.weapon),
        cape: r.cape === null ? null : typeof r.cape === "number" ? index(r.cape, DYE_NAMES.length, 0) : fallback.cape,
        companion: oneOf(COMPANIONS, r.companion, fallback.companion),
    };
}

export function randomAppearance(rng: () => number = Math.random): Appearance {
    const pick = <T,>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))] as T;
    const roll = (count: number) => Math.min(count - 1, Math.floor(rng() * count));
    return {
        skin: roll(SKIN_NAMES.length),
        eyes: roll(EYE_NAMES.length),
        hair: pick(HAIR_STYLES),
        hairColor: roll(HAIR_COLOR_NAMES.length),
        headgear: pick(HEADGEARS),
        outfit: pick(OUTFITS),
        dye: roll(DYE_NAMES.length),
        trim: roll(TRIM_NAMES.length),
        weapon: pick(WEAPONS),
        cape: rng() < 0.45 ? roll(DYE_NAMES.length) : null,
        companion: rng() < 0.5 ? pick(COMPANIONS) : "none",
    };
}

/** A sentence for the summary card: "a copper-haired Wanderer in a forest tunic, sword in hand". */
export function describeAppearance(a: Appearance): string {
    const hair = a.hair === "bald" ? "bald" : `${HAIR_COLOR_NAMES[a.hairColor]?.toLowerCase() ?? ""}-haired`;
    const outfit = `${DYE_NAMES[a.dye]?.toLowerCase() ?? ""} ${OUTFIT_LABELS[a.outfit].toLowerCase()}`;
    const weapon = a.weapon === "none" ? "empty-handed" : `${WEAPON_LABELS[a.weapon].toLowerCase()} in hand`;
    const pet = a.companion === "none" ? "" : `, a ${COMPANION_LABELS[a.companion].toLowerCase()} at heel`;
    return `${hair}, in a ${outfit}, ${weapon}${pet}`;
}

/** The palette picks as CSS variables for the figure's style attribute (shades are derived in CSS). */
export function paletteStyle(a: Appearance): Record<string, string> {
    return {
        "--hero-skin": `var(--bc-hero-skin-${a.skin + 1})`,
        "--hero-eye": `var(--bc-hero-eye-${a.eyes + 1})`,
        "--hero-hair": `var(--bc-hero-hair-${a.hairColor + 1})`,
        "--hero-cloth": `var(--bc-hero-dye-${a.dye + 1})`,
        "--hero-trim": `var(--bc-hero-trim-${a.trim + 1})`,
        "--hero-cape": `var(--bc-hero-dye-${(a.cape ?? a.dye) + 1})`,
        "--hero-pet": a.companion === "none" ? "var(--hero-skin)" : `var(--bc-hero-pet-${a.companion})`,
    };
}
