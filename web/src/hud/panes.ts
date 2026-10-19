// The web's panes (a subset of Hud.PANE_DEFS: `vitals` is terminal-only).
export interface PaneMeta {
    title: string;
    icon: string;
}

export const PANE_META: Record<string, PaneMeta> = {
    quest: { title: "Quest", icon: "◆" },
    room: { title: "Location", icon: "◈" },
    pack: { title: "Pack", icon: "▣" },
    lesson: { title: "Lesson", icon: "✎" },
    map: { title: "Map", icon: "☗" },
    skills: { title: "Skills", icon: "◎" },
    hero: { title: "Hero", icon: "⚔" },
    spotlight: { title: "This room teaches", icon: "✧" },
};
