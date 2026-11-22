// Hash routing: #/story, #/learn, #/arcade, #/reference — the URLs the
// previous UI used, which also work from a GitHub Pages project path and
// a plain static file server — plus #/home, the home page. No hash at all
// is "none": the home page for a newcomer, the last door for a returning
// hero (App decides). Mode switches replace the history entry (as before),
// so Back leaves the app rather than stepping through tabs.
import { createStore, useStore } from "../lib/store";
import { isMode, type Mode } from "./modes";

export type Route =
    | { kind: "mode"; mode: Mode }
    | { kind: "home" }
    | { kind: "none" }
    | { kind: "notfound"; path: string };

export function parseHash(hash: string): Route {
    const trimmed = String(hash || "").replace(/^#/, "");
    if (trimmed === "" || trimmed === "/") return { kind: "none" };
    const match = /^\/([^/?#]+)/.exec(trimmed);
    const name = match ? match[1] : trimmed;
    if (name === "home") return { kind: "home" };
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

export const HOME_HREF = "#/home";

function replaceHash(next: string): void {
    if (window.location.hash === next) return;
    try {
        window.history.replaceState(null, "", next);
    } catch {
        window.location.hash = next;
    }
}

export function navigate(mode: Mode): void {
    listen();
    replaceHash(hrefFor(mode));
    store.set({ kind: "mode", mode });
}

/** The home page, whoever is asking (a hero reaches it from the brand). */
export function navigateHome(): void {
    listen();
    replaceHash(HOME_HREF);
    store.set({ kind: "home" });
}

export function subscribeRoute(listener: () => void): () => void {
    listen();
    return store.subscribe(listener);
}

export function currentRoute(): Route {
    return store.get();
}

export function useRoute(): Route {
    listen();
    return useStore(store);
}
