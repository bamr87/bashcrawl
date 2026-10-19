// The four doors. Story and Learn share the story runtime and prompt; the
// Arcade has its own scoped runtimes; Reference is a document.
export const MODES = ["story", "learn", "arcade", "reference"] as const;
export type Mode = (typeof MODES)[number];

export interface ModeMeta {
    label: string;
    icon: string;
    title: string;
    hint: string;
}

export const MODE_META: Record<Mode, ModeMeta> = {
    story: { label: "Story", icon: "⚔", title: "Story dungeon", hint: "Story: explore the dungeon with real commands" },
    learn: { label: "Learn", icon: "🎓", title: "Guided courses with a lab", hint: "Learn: read on the left, type on the right · lesson hint when stuck" },
    arcade: { label: "Arcade", icon: "🕹", title: "Practice Arcade", hint: "Arcade: quit abandons a trial · hint helps (score cost)" },
    reference: { label: "Reference", icon: "📖", title: "Cheatsheets", hint: "Reference: click a command to copy it · ▶ drops it into the Story prompt" },
};

export function isMode(value: unknown): value is Mode {
    return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

// Story and Learn own the shared prompt.
export function storyOwnsInput(mode: Mode | null): boolean {
    return mode === "story" || mode === "learn";
}
