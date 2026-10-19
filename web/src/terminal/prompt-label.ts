// "/entrance/cellar $" → "cellar $": the short prompt label narrow screens
// show so the input keeps its width. Labels without a path ("arcade ▸")
// are returned as they are.
export function shortLabel(label: string): string {
    return label.replace(/^\/(?:[^\s/]+\/)*([^\s/]+)(\s.*)$/, "$1$2");
}

export function labelPath(label: string): string | null {
    return /^\/\S*/.exec(label)?.[0] ?? null;
}
