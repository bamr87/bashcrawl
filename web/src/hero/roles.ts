// The four paths a hero can take: a starting door and a kind of help.
import type { Mode } from "../app/modes";

export type HeroRole = "wanderer" | "scribe" | "rogue" | "sage";

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

export function roleMeta(role: HeroRole): RoleMeta {
    return ROLES.find((entry) => entry.id === role) ?? ROLES[0];
}

export function isRole(value: unknown): value is HeroRole {
    return ROLES.some((entry) => entry.id === value);
}
