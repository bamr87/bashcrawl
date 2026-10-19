// localStorage with the failure modes handled: private windows, blocked site
// data and quota errors all throw, so every access is guarded and a missing
// or corrupt value falls back. Keys are the same ones the previous UI used,
// so saves and preferences survive the rewrite.
export function readRaw(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeRaw(key: string, value: string): boolean {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function readJson<T>(key: string, fallback: T): T {
    const raw = readRaw(key);
    if (raw == null) return fallback;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && fallback && typeof fallback === "object") {
            return { ...(fallback as object), ...(parsed as object) } as T;
        }
        return parsed as T;
    } catch {
        return fallback;
    }
}

export function writeJson(key: string, value: unknown): boolean {
    return writeRaw(key, JSON.stringify(value));
}
