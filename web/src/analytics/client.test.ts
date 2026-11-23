import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureError, featureFlag, resetClientForTest, start, stop, subscribeFlags, track, type AnalyticsClient } from "./client";
import type { AnalyticsConfig } from "./config";
import { reloadConsent, setConsent } from "./consent-store";

const CONFIG: AnalyticsConfig = { key: "phc_test", host: "https://us.i.posthog.com", uiHost: null };

function fakeClient() {
    const flagCallbacks: Array<() => void> = [];
    const client = {
        capture: vi.fn(),
        captureException: vi.fn(),
        register: vi.fn(),
        set_config: vi.fn(),
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        reset: vi.fn(),
        startSessionRecording: vi.fn(),
        stopSessionRecording: vi.fn(),
        getFeatureFlag: vi.fn((key: string) => (key === "known" ? "variant-b" : undefined)),
        onFeatureFlags: vi.fn((callback: () => void) => { flagCallbacks.push(callback); }),
    } satisfies AnalyticsClient;
    return { client, flagCallbacks };
}

describe("analytics client", () => {
    beforeEach(() => {
        window.localStorage.clear();
        reloadConsent();
        resetClientForTest();
    });

    it("sends nothing and loads nothing before consent", async () => {
        const { client } = fakeClient();
        const loader = vi.fn(async () => client);
        resetClientForTest(loader);

        track("$pageview", { surface: "home" });
        captureError(new Error("boom"));
        expect(loader).not.toHaveBeenCalled();
        expect(client.capture).not.toHaveBeenCalled();
        expect(featureFlag("known")).toBeUndefined();
    });

    it("drops events when started without a stored yes", async () => {
        const { client } = fakeClient();
        resetClientForTest(async () => client);
        await start(CONFIG);
        track("$pageview", { surface: "home" });
        expect(client.capture).not.toHaveBeenCalled();
    });

    it("holds events while the library loads, then sends them in order with the build's identity", async () => {
        const { client } = fakeClient();
        let release: (value: AnalyticsClient) => void = () => {};
        resetClientForTest(() => new Promise<AnalyticsClient>((resolve) => { release = resolve; }));
        setConsent("granted");

        const ready = start(CONFIG);
        track("app_loaded", { returning: false, has_hero: false, theme: "dark", viewport: "desktop" });
        track("$pageview", { surface: "story" });
        expect(client.capture).not.toHaveBeenCalled();

        release(client);
        await ready;
        expect(client.register).toHaveBeenCalledWith(expect.objectContaining({ app_version: expect.any(String), app_commit: expect.any(String), app_env: "test" }));
        expect(client.capture.mock.calls.map((call) => call[0])).toEqual(["app_loaded", "$pageview"]);

        track("quest_completed", { quest_id: 1, quests_done: 1 });
        expect(client.capture).toHaveBeenLastCalledWith("quest_completed", { quest_id: 1, quests_done: 1 });
    });

    it("stops, opts out and forgets PostHog's storage when consent is withdrawn", async () => {
        const { client } = fakeClient();
        resetClientForTest(async () => client);
        setConsent("granted");
        await start(CONFIG);
        window.localStorage.setItem("ph_phc_test_posthog", "{}");
        window.localStorage.setItem("bashcrawl-web-state-v1", "{\"keep\":true}");

        setConsent("denied");
        stop();
        expect(client.opt_out_capturing).toHaveBeenCalled();
        expect(client.stopSessionRecording).toHaveBeenCalled();
        expect(client.reset).toHaveBeenCalled();
        // Persistence goes off last, so the reset cannot write a new id back.
        expect(client.set_config).toHaveBeenLastCalledWith({ disable_persistence: true });
        expect(client.set_config.mock.invocationCallOrder[0]).toBeGreaterThan(client.reset.mock.invocationCallOrder[0] ?? 0);
        expect(window.localStorage.getItem("ph_phc_test_posthog")).toBeNull();
        expect(window.localStorage.getItem("bashcrawl-web-state-v1")).toBe("{\"keep\":true}");

        client.capture.mockClear();
        track("$pageview", { surface: "home" });
        expect(client.capture).not.toHaveBeenCalled();

        // Allowed again in the same visit: persistence comes back before capture does.
        setConsent("granted");
        await start(CONFIG);
        expect(client.set_config).toHaveBeenLastCalledWith({ disable_persistence: false });
        expect(client.opt_in_capturing).toHaveBeenCalled();
        // reset() forgot the build's identity: it is registered again.
        expect(client.register).toHaveBeenCalledTimes(2);
        track("$pageview", { surface: "home" });
        expect(client.capture).toHaveBeenCalledTimes(1);
    });

    it("opts out a library that arrives after consent was withdrawn", async () => {
        const { client } = fakeClient();
        let release: (value: AnalyticsClient) => void = () => {};
        resetClientForTest(() => new Promise<AnalyticsClient>((resolve) => { release = resolve; }));
        setConsent("granted");
        const ready = start(CONFIG);
        track("$pageview", { surface: "home" });
        setConsent("denied");
        stop();
        release(client);
        await ready;
        expect(client.opt_out_capturing).toHaveBeenCalled();
        expect(client.capture).not.toHaveBeenCalled();
    });

    it("survives a library that fails to load", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        resetClientForTest(async () => { throw new Error("blocked"); });
        setConsent("granted");
        await expect(start(CONFIG)).resolves.toBeUndefined();
        expect(() => track("$pageview", { surface: "home" })).not.toThrow();
        warn.mockRestore();
    });

    it("reports caught errors and feature flags once running", async () => {
        const { client, flagCallbacks } = fakeClient();
        resetClientForTest(async () => client);
        setConsent("granted");
        const seen = vi.fn();
        subscribeFlags(seen);
        await start(CONFIG);

        const error = new Error("render failed");
        captureError(error, { boundary: "app" });
        expect(client.captureException).toHaveBeenCalledWith(error, { boundary: "app" });

        expect(featureFlag("known")).toBe("variant-b");
        seen.mockClear();
        flagCallbacks.forEach((callback) => callback());
        expect(seen).toHaveBeenCalled();
    });
});
