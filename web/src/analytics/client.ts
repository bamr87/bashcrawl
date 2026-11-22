// The one place PostHog is touched. Nothing here runs, and the library is
// not downloaded, until consent is granted: `start()` imports posthog-js as
// its own chunk, with session replay, surveys, error tracking and feature
// flags bundled in (no script is fetched from a third party at run time).
// Before that, `track()` drops what it is given; between the grant and the
// library arriving it holds a short queue. Withdrawing consent opts out,
// stops the replay and deletes what PostHog stored in this browser.
import { analyticsAllowed } from "./consent-store";
import { buildInfo, type AnalyticsConfig } from "./config";
import type { EventName, EventProps } from "./events";

/** The slice of posthog-js this app uses (what the tests stand in for). */
export interface AnalyticsClient {
    capture(event: string, properties?: Record<string, unknown>): unknown;
    captureException(error: unknown, properties?: Record<string, unknown>): unknown;
    register(properties: Record<string, unknown>): void;
    set_config(config: { disable_persistence: boolean }): void;
    opt_in_capturing(): void;
    opt_out_capturing(): void;
    reset(): void;
    startSessionRecording(): void;
    stopSessionRecording(): void;
    getFeatureFlag(key: string): boolean | string | undefined;
    onFeatureFlags(callback: () => void): (() => void) | void;
}

export type ClientLoader = (config: AnalyticsConfig) => Promise<AnalyticsClient>;

/** A pinned snapshot of PostHog's defaults, so a library update cannot change behaviour silently. */
const POSTHOG_DEFAULTS = "2026-08-30";
const QUEUE_CAP = 100;

async function loadPostHog(config: AnalyticsConfig): Promise<AnalyticsClient> {
    const { default: posthog } = await import("posthog-js/dist/module.full.no-external");
    posthog.init(config.key, {
        api_host: config.host,
        ui_host: config.uiHost,
        defaults: POSTHOG_DEFAULTS,
        // No cookies: the visitor id lives in localStorage, on this origin only.
        persistence: "localStorage",
        // Never build a person profile: there is no sign-in and identify() is never called.
        person_profiles: "identified_only",
        // The app's routes are hash routes and it reports them itself (install.ts).
        capture_pageview: false,
        capture_pageleave: true,
        // Clicks are counted by element, without the text on it: a button's
        // label can hold the hero's name and a log line holds what was typed.
        autocapture: true,
        mask_all_text: true,
        capture_exceptions: true,
        disable_surveys: false,
        disable_session_recording: false,
        session_recording: { maskAllInputs: true },
        // Consent is this app's to manage (consent-store.ts): PostHog is only
        // ever initialised after an explicit yes, which outranks the header.
        respect_dnt: false,
        opt_out_capturing_by_default: false,
    });
    return posthog as unknown as AnalyticsClient;
}

let loader: ClientLoader = loadPostHog;
let client: AnalyticsClient | null = null;
let starting: Promise<void> | null = null;
let active = false;
let queue: Array<[string, Record<string, unknown>]> = [];
const flagListeners = new Set<() => void>();

function notifyFlags(): void {
    for (const listener of Array.from(flagListeners)) listener();
}

/** Every event says which build sent it (a reset() forgets this, so it is set on each start). */
function identifyBuild(target: AnalyticsClient): void {
    const build = buildInfo();
    target.register({ app_version: build.version, app_commit: build.commit, app_env: build.env });
}

/** Begin measuring. Safe to call again; resolves once the library is ready. */
export function start(config: AnalyticsConfig): Promise<void> {
    active = true;
    if (client) {
        client.set_config({ disable_persistence: false });
        client.opt_in_capturing();
        identifyBuild(client);
        client.startSessionRecording();
        return Promise.resolve();
    }
    if (starting) return starting;
    starting = loader(config)
        .then((loaded) => {
            // Consent may have been withdrawn while the chunk was downloading.
            if (!active) {
                client = loaded;
                silence(loaded);
                return;
            }
            identifyBuild(loaded);
            loaded.onFeatureFlags(notifyFlags);
            client = loaded;
            const held = queue;
            queue = [];
            for (const [event, properties] of held) loaded.capture(event, properties);
            notifyFlags();
        })
        .catch((err: unknown) => {
            // A blocked or failed download must never break the game.
            console.warn("Bashcrawl analytics did not start:", err);
            active = false;
            queue = [];
        })
        .finally(() => {
            starting = null;
        });
    return starting;
}

/**
 * Opt the library out and make it forget this browser. `reset()` would
 * otherwise write a fresh visitor id straight back, so persistence is
 * switched off as well (which also deletes what PostHog had stored), and
 * its keys are swept once more for good measure.
 */
function silence(loaded: AnalyticsClient): void {
    loaded.stopSessionRecording();
    loaded.opt_out_capturing();
    loaded.reset();
    loaded.set_config({ disable_persistence: true });
    forgetStorage();
}

/** Stop measuring and forget this browser. */
export function stop(): void {
    active = false;
    queue = [];
    if (client) silence(client);
    else forgetStorage();
    notifyFlags();
}

/** Delete PostHog's own keys (`ph_…`), leaving the game's saves alone. */
function forgetStorage(): void {
    for (const area of [window.localStorage, window.sessionStorage]) {
        try {
            for (let index = area.length - 1; index >= 0; index -= 1) {
                const key = area.key(index);
                if (key && /^(ph_|__ph_)/.test(key)) area.removeItem(key);
            }
        } catch {
            // Storage blocked: there is nothing of PostHog's to forget.
        }
    }
}

/** Send one event from the catalogue. A no-op unless consent has been granted. */
export function track<K extends EventName>(event: K, properties: EventProps[K]): void {
    if (!active || !analyticsAllowed()) return;
    const payload = properties as Record<string, unknown>;
    if (client) client.capture(event, payload);
    else if (queue.length < QUEUE_CAP) queue.push([event, payload]);
}

/** Report an error the page caught itself (the error boundary, a failed boot). */
export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
    if (!active || !client || !analyticsAllowed()) return;
    client.captureException(error, context);
}

/** A feature flag's value, or undefined until flags have loaded (or without consent). */
export function featureFlag(key: string): boolean | string | undefined {
    if (!active || !client) return undefined;
    return client.getFeatureFlag(key);
}

export function subscribeFlags(listener: () => void): () => void {
    flagListeners.add(listener);
    return () => { flagListeners.delete(listener); };
}

export function isActive(): boolean {
    return active;
}

/** Tests only: replace the PostHog loader and return to the unstarted state. */
export function resetClientForTest(next: ClientLoader = loadPostHog): void {
    loader = next;
    client = null;
    starting = null;
    active = false;
    queue = [];
    flagListeners.clear();
}
