// "/entrance/cellar $" → "cellar $": the short prompt label narrow screens
// show so the input keeps its width. Labels without a path ("arcade ▸")
// are returned as they are.
export function shortLabel(label: string): string {
    return label.replace(/^\/(?:[^\s/]+\/)*([^\s/]+)(\s.*)$/, "$1$2");
}

export function labelPath(label: string): string | null {
    return /^\/\S*/.exec(label)?.[0] ?? null;
}

const HOME = "/entrance";
const MAX_SEGMENTS = 3;

// "/entrance/chapel/courtyard/aviary/hall/library/.study $" → "~/chapel/…/.study $":
// the label wide screens show, shortened from the left like bash's
// PROMPT_DIRTRIM so the room you are in is never the part that gets clipped.
// /entrance reads as ~; past three segments only the first and the last
// stay. Everything from the first whitespace on (" $", " ⚔") is kept, and
// labels without a path ("arcade ▸") are returned as they are.
export function compactLabel(label: string): string {
    const path = labelPath(label);
    if (!path) return label;
    const home = path === HOME || path.startsWith(`${HOME}/`);
    const segments = (home ? path.slice(HOME.length) : path).split("/").filter(Boolean);
    if (segments.length > MAX_SEGMENTS) segments.splice(1, segments.length - 2, "…");
    const rest = segments.length ? `/${segments.join("/")}` : home ? "" : "/";
    return `${home ? "~" : ""}${rest}${label.slice(path.length)}`;
}
