// Named points in the page that effects aim at: the XP gauge the orbs fly
// to, the HP gauge that shakes, the quest panel that sparkles. Components
// register their element under a name (and stamp data-fx-anchor for
// anything that queries the DOM instead); effects resolve a name to its
// viewport rectangle at the moment they fire.
const registry = new Map<string, HTMLElement>();

export type AnchorName = "xp" | "hp" | "rank" | "quest" | "map" | "pack" | "skills" | "lesson" | "room" | "hero" | "stage" | "log";

export function registerAnchor(name: AnchorName | string, element: HTMLElement | null): () => void {
    if (!element) return () => {};
    registry.set(name, element);
    element.setAttribute("data-fx-anchor", name);
    return () => {
        if (registry.get(name) === element) registry.delete(name);
    };
}

export function anchorElement(name: AnchorName | string): HTMLElement | null {
    const known = registry.get(name);
    if (known && known.isConnected) return known;
    return typeof document !== "undefined" ? document.querySelector<HTMLElement>(`[data-fx-anchor="${name}"]`) : null;
}

export interface Point {
    x: number;
    y: number;
}

export function anchorPoint(name: AnchorName | string): Point | null {
    const element = anchorElement(name);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** The last line of the log: where XP orbs are born. */
export function logTailPoint(): Point | null {
    const log = anchorElement("log");
    if (!log) return null;
    const last = log.lastElementChild as HTMLElement | null;
    const rect = (last ?? log).getBoundingClientRect();
    return last ? { x: rect.left + Math.min(rect.width, 160) / 2, y: rect.top + rect.height / 2 } : { x: rect.left + rect.width / 2, y: rect.bottom - 24 };
}
