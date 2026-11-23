// Where the app is measured: one subscriber on each thing that already
// announces what happened (the route, the FX bus, the small stores), so the
// screens themselves stay free of analytics calls. The few moments no store
// announces (a hero created, the tour ended, an arcade game) call `track()`
// where they happen. Everything here is inert until consent is granted, and
// is not installed at all in a build without a PostHog key.
import { currentRoute, subscribeRoute, type Route } from "../app/useHashRoute";
import { soundOn, subscribeSound } from "../audio/sound-store";
import { crtOn, subscribeCrt } from "../chrome/crt-store";
import { getSettings, subscribeSettings, type Settings } from "../chrome/settings-store";
import { getUi, subscribeUi, type UiState } from "../chrome/ui-store";
import { fxBus, type FxEvent } from "../engine/fx-bus";
import { game, type GameStore } from "../engine/game-store";
import { getHero } from "../hero/hero-store";
import { getTheme, subscribeTheme } from "../theme/theme-store";
import { start, stop, track } from "./client";
import { analyticsConfig } from "./config";
import { analyticsAllowed, subscribeConsent } from "./consent-store";
import type { Surface } from "./events";

/** A visit that keeps failing must not flood the event stream. */
export const FAILED_COMMAND_CAP = 30;

export function surfaceOf(route: Route = currentRoute()): Surface {
    if (route.kind === "mode") return route.mode;
    return route.kind === "notfound" ? "notfound" : "home";
}

function viewport(): "mobile" | "tablet" | "desktop" {
    const width = window.innerWidth;
    return width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

/** The command's own name, and only when the game knows it: never what followed it. */
export function commandName(line: string, known: (name: string) => boolean): string {
    const word = line.trim().split(/\s+/, 1)[0] ?? "";
    return word && known(word) ? word : "unknown";
}

function diff<T extends object>(prev: T, next: T, report: (key: string, value: string) => void): void {
    for (const key of Object.keys(next) as Array<keyof T>) {
        if (prev[key] !== next[key]) report(String(key), String(next[key]));
    }
}

export function installAnalytics(store: GameStore = game): () => void {
    const config = analyticsConfig();
    if (!config) return () => {};

    const offs: Array<() => void> = [];
    const used = new Set<string>();
    let failures = 0;
    let streak = 0;
    let loadedSent = false;
    let course: string | null = null;
    let coursesDone = 0;

    // A returning hero who opens the bare address is redirected to their last
    // door at once (App.tsx): the page they see is that door, not the home page.
    const pageview = () => {
        if (currentRoute().kind === "none" && getHero() !== null) return;
        track("$pageview", { surface: surfaceOf() });
    };

    const appLoaded = () => {
        if (loadedSent || store.snap.get().phase !== "ready") return;
        loadedSent = true;
        const state = store.runtime?.state;
        track("app_loaded", {
            returning: Boolean(state && (state.history.length > 0 || state.completedQuestIds.length > 0)),
            has_hero: getHero() !== null,
            theme: getTheme().pref,
            viewport: viewport(),
        });
    };

    // Consent: start on a yes (now or restored), stop and forget on a no.
    let running = false;
    const sync = (fresh: boolean) => {
        const allowed = analyticsAllowed();
        if (allowed === running) return;
        running = allowed;
        if (!allowed) {
            stop();
            return;
        }
        void start(config);
        if (fresh) track("consent_updated", { analytics: "granted" });
        loadedSent = false;
        appLoaded();
        pageview();
    };
    sync(false);
    offs.push(subscribeConsent(() => sync(true)));

    offs.push(subscribeRoute(pageview));

    const onFx = (event: FxEvent) => {
        if (event.type === "boot") {
            appLoaded();
            return;
        }
        if (event.type !== "command") return;
        const runtime = store.runtime;
        const surface = surfaceOf();
        const name = commandName(event.line, (word) => Boolean(runtime && Object.prototype.hasOwnProperty.call(runtime.handlers, word)));
        const state = runtime?.state;
        const questId = state && surface === "story" ? state.currentQuestId : null;

        if (event.error) {
            streak += 1;
            if (failures < FAILED_COMMAND_CAP) {
                failures += 1;
                track("command_failed", { command: name, surface, quest_id: questId, streak });
            }
        } else {
            streak = 0;
            if (name !== "unknown" && !used.has(name)) {
                used.add(name);
                track("command_first_used", { command: name, surface });
            }
        }
        if (name === "hint") track("hint_used", { surface, quest_id: questId });
        if (!state || !runtime) return;

        const questsDone = state.completedQuestIds.length;
        if (event.discovered) track("room_discovered", { room: state.cwd });
        for (const hud of event.events) {
            if (hud.type === "quest" && event.questId != null) {
                track("quest_completed", { quest_id: event.questId, quests_done: questsDone });
                if (questsDone >= runtime.quests.length) track("story_completed", { quests_done: questsDone });
            } else if (hud.type === "levelup") {
                track("rank_reached", { rank: runtime.catalog.ranks[state.rankIndex]?.title ?? "", rank_index: state.rankIndex });
            } else if (hud.type === "unlock") {
                track("passage_unlocked", { quests_done: questsDone });
            } else if (hud.type === "objective" && state.learn.active) {
                track("objective_met", { course_id: state.learn.active, lesson_index: state.learn.progress[state.learn.active]?.lesson ?? 0 });
            } else if (hud.type === "lesson" && state.learn.active) {
                track("lesson_completed", { course_id: state.learn.active, lesson_index: state.learn.progress[state.learn.active]?.lesson ?? 0 });
            }
        }
        if (state.learn.active && state.learn.active !== course) track("course_started", { course_id: state.learn.active });
        course = state.learn.active;
        if (state.learn.completed.length > coursesDone) {
            const done = state.learn.completed[state.learn.completed.length - 1];
            if (done) track("course_completed", { course_id: done });
        }
        coursesDone = state.learn.completed.length;
    };
    const learn = store.runtime?.state.learn;
    course = learn?.active ?? null;
    coursesDone = learn?.completed.length ?? 0;
    offs.push(fxBus.subscribe(onFx));

    // Panels: report an opening, not a closing.
    let ui: UiState = getUi();
    offs.push(subscribeUi(() => {
        const next = getUi();
        const surface = surfaceOf();
        const opened = (overlay: string) => track("overlay_opened", { overlay, surface });
        if (next.overlay !== ui.overlay && next.overlay !== null) opened(next.overlay);
        if (next.docsOpen && !ui.docsOpen) opened("docs");
        if (next.helpOpen && !ui.helpOpen) opened("shortcuts");
        if (next.privacyOpen && !ui.privacyOpen) opened("privacy");
        ui = next;
    }));

    // Options: one event per option that changed.
    const changed = (setting: string, value: string) => track("setting_changed", { setting, value });
    let settings: Settings = getSettings();
    offs.push(subscribeSettings(() => {
        const next = getSettings();
        diff(settings, next, changed);
        settings = next;
    }));
    let theme = getTheme().pref;
    offs.push(subscribeTheme(() => {
        const next = getTheme().pref;
        if (next !== theme) changed("theme", next);
        theme = next;
    }));
    offs.push(subscribeSound(() => changed("sound", soundOn() ? "on" : "off")));
    offs.push(subscribeCrt(() => changed("crt", crtOn() ? "on" : "off")));

    // The feedback widget is the fleet kit's and announces nothing: a click
    // that lands on it while it is closed is the form being opened.
    let lastFeedback = 0;
    const onClick = (event: MouseEvent) => {
        if (!(event.target instanceof Element) || !event.target.closest("fleet-feedback")) return;
        const now = Date.now();
        if (now - lastFeedback < 30_000) return;
        lastFeedback = now;
        track("feedback_opened", { surface: surfaceOf() });
    };
    document.addEventListener("click", onClick, true);
    offs.push(() => document.removeEventListener("click", onClick, true));

    return () => {
        for (const off of offs) off();
    };
}
