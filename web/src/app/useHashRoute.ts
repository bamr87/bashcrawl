// Hash routing: #/story, #/learn, #/arcade, #/reference — the URLs the
// previous UI used, which also work from a GitHub Pages project path and
// a plain static file server. Mode switches replace the history entry (as
// before), so Back leaves the app rather than stepping through tabs.
import { createStore, useStore } from "../lib/store";
import { isMode, type Mode } from "./modes";

export type Route =
    | { kind: "mode"; mode: Mode }
    | { kind: "none" }
    | { kind: "notfound"; path: string };

export function parseHash(hash: string): Route {
    const trimmed = String(hash || "").replace(/^#/, "");
    if (trimmed === "" || trimmed === "/") return { kind: "none" };
    const match = /^\/([^/?#]+)/.exec(trimmed);
    const name = match ? match[1] : trimmed;
    if (isMode(name)) return { kind: "mode", mode: name };
    return { kind: "notfound", path: trimmed };
}

export function hrefFor(mode: Mode): string {
    return `#/${mode}`;
}

const store = createStore<Route>(typeof window === "undefined" ? { kind: "none" } : parseHash(window.location.hash));

let listening = false;
function listen(): void {
    if (listening || typeof window === "undefined") return;
    listening = true;
    window.addEventListener("hashchange", () => store.set(parseHash(window.location.hash)));
}

export function navigate(mode: Mode): void {
    listen();
    const next = hrefFor(mode);
    if (window.location.hash !== next) {
        try {
            window.history.replaceState(null, "", next);
        } catch {
            window.location.hash = next;
        }
    }
    store.set({ kind: "mode", mode });
}

export function currentRoute(): Route {
    return store.get();
}

export function useRoute(): Route {
    listen();
    return useStore(store);
}
