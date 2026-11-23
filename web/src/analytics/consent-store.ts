// Consent for usage analytics (UPS-FE-24): nothing is measured, and the
// analytics library is not even downloaded, until the visitor says yes. The
// answer is kept for 365 days under its own key, then asked again. A browser
// that sends Global Privacy Control or Do Not Track has already answered no:
// it is never shown the banner, though the visitor can still switch
// analytics on by hand in Options. Only "essential" storage (the game's own
// saves and preferences) is used without this consent, and there is no
// marketing category: the site carries no ads and no third-party pixels.
import { createStore, useStore } from "../lib/store";
import { readJson, writeJson } from "../lib/storage";

export const CONSENT_KEY = "bashcrawl-web-consent-v1";
export const CONSENT_DAYS = 365;

export type ConsentChoice = "granted" | "denied";
export type ConsentStatus = ConsentChoice | "unset";

export interface ConsentState {
    status: ConsentStatus;
    /** When the choice was made (ISO), for the 365-day expiry. */
    at: string | null;
}

interface Stored {
    analytics?: unknown;
    at?: unknown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function read(now: number): ConsentState {
    const raw = readJson<Stored>(CONSENT_KEY, {});
    const choice = raw.analytics === "granted" || raw.analytics === "denied" ? raw.analytics : null;
    const at = typeof raw.at === "string" ? raw.at : null;
    const when = at ? Date.parse(at) : NaN;
    if (!choice || !at || Number.isNaN(when) || now - when > CONSENT_DAYS * DAY_MS || when > now + DAY_MS) return { status: "unset", at: null };
    return { status: choice, at };
}

const store = createStore<ConsentState>(typeof window === "undefined" ? { status: "unset", at: null } : read(Date.now()));

/** The browser itself says "do not track me" (GPC, or the older DNT header). */
export function privacySignal(nav: Pick<Navigator, "doNotTrack"> & { globalPrivacyControl?: unknown } = navigator): boolean {
    return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

export function getConsent(): ConsentState {
    return store.get();
}

export function useConsent(): ConsentState {
    return useStore(store);
}

export function subscribeConsent(listener: () => void): () => void {
    return store.subscribe(listener);
}

export function setConsent(choice: ConsentChoice, now: Date = new Date()): void {
    const next: ConsentState = { status: choice, at: now.toISOString() };
    writeJson(CONSENT_KEY, { analytics: choice, at: next.at });
    store.set(next);
}

/** Tests only: read the stored answer again as of `now`. */
export function reloadConsent(now: number = Date.now()): void {
    store.set(read(now));
}

/** Only an explicit, unexpired yes counts. */
export function analyticsAllowed(): boolean {
    return store.get().status === "granted";
}

/** Ask only someone who has not answered and whose browser has not answered for them. */
export function shouldAsk(configured: boolean): boolean {
    return configured && store.get().status === "unset" && !privacySignal();
}
