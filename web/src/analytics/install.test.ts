import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { navigate } from "../app/useHashRoute";
import { setSettings, DEFAULT_SETTINGS } from "../chrome/settings-store";
import { setUi } from "../chrome/ui-store";
import { GameStore } from "../engine/game-store";
import { clearHero, createHero } from "../hero/hero-store";
import { dataLoader, loadEngine } from "../test/engine";
import { resetClientForTest, type AnalyticsClient } from "./client";
import { setAnalyticsConfigForTest } from "./config";
import { reloadConsent, setConsent } from "./consent-store";
import { EVENT_NAMES } from "./events";
import { commandName, FAILED_COMMAND_CAP, installAnalytics } from "./install";

loadEngine();

function fakeClient() {
    return {
        capture: vi.fn(),
        captureException: vi.fn(),
        register: vi.fn(),
        set_config: vi.fn(),
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        reset: vi.fn(),
        startSessionRecording: vi.fn(),
        stopSessionRecording: vi.fn(),
        getFeatureFlag: vi.fn(() => undefined),
        onFeatureFlags: vi.fn(),
    } satisfies AnalyticsClient;
}

type Fake = ReturnType<typeof fakeClient>;
const events = (client: Fake) => client.capture.mock.calls.map((call) => call[0] as string);
const propsOf = (client: Fake, name: string) => client.capture.mock.calls.filter((call) => call[0] === name).map((call) => call[1] as Record<string, unknown>);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("analytics wiring", () => {
    let off = () => {};

    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        reloadConsent();
        setUi({ overlay: null, tour: null, docsOpen: false, helpOpen: false, privacyOpen: false });
        setSettings(DEFAULT_SETTINGS);
        navigate("story");
        setAnalyticsConfigForTest({ key: "phc_test", host: "https://us.i.posthog.com", uiHost: null });
    });

    afterEach(() => {
        off();
        off = () => {};
        setAnalyticsConfigForTest(undefined);
        resetClientForTest();
    });

    it("installs nothing in a build without a key", async () => {
        const client = fakeClient();
        const loader = vi.fn(async () => client);
        resetClientForTest(loader);
        setAnalyticsConfigForTest(null);
        setConsent("granted");
        const store = new GameStore();
        await store.boot(dataLoader);
        off = installAnalytics(store);
        store.execute("pwd");
        await settle();
        expect(loader).not.toHaveBeenCalled();
    });

    it("stays silent until consent, then reports the visit so far", async () => {
        const client = fakeClient();
        const loader = vi.fn(async () => client);
        resetClientForTest(loader);
        const store = new GameStore();
        await store.boot(dataLoader);
        off = installAnalytics(store);

        store.execute("pwd");
        navigate("learn");
        await settle();
        expect(loader).not.toHaveBeenCalled();
        expect(client.capture).not.toHaveBeenCalled();

        setConsent("granted");
        await settle();
        expect(loader).toHaveBeenCalledTimes(1);
        expect(events(client)).toEqual(["consent_updated", "app_loaded", "$pageview"]);
        expect(propsOf(client, "$pageview")).toEqual([{ surface: "learn" }]);

        setConsent("denied");
        await settle();
        expect(client.opt_out_capturing).toHaveBeenCalled();
        client.capture.mockClear();
        store.execute("ls");
        navigate("arcade");
        expect(client.capture).not.toHaveBeenCalled();
    });

    it("reports doors, commands by name only, quests and discoveries", async () => {
        const client = fakeClient();
        resetClientForTest(async () => client);
        setConsent("granted");
        const store = new GameStore();
        await store.boot(dataLoader);
        off = installAnalytics(store);
        await settle();
        client.capture.mockClear();

        store.execute("pwd");
        expect(propsOf(client, "command_first_used")).toEqual([{ command: "pwd", surface: "story" }]);
        expect(propsOf(client, "quest_completed")).toEqual([{ quest_id: 0, quests_done: 1 }]);

        store.execute("pwd");
        expect(propsOf(client, "command_first_used")).toHaveLength(1);

        store.execute("cat my-secret-notes.txt");
        store.execute("definitely-not-a-command --with private stuff");
        const failed = propsOf(client, "command_failed");
        expect(failed.map((props) => props.command)).toEqual(["cat", "unknown"]);
        expect(failed[1]).toMatchObject({ surface: "story", streak: 2 });

        store.execute("cd cellar");
        expect(propsOf(client, "room_discovered")).toEqual([{ room: "/entrance/cellar" }]);

        store.execute("hint");
        expect(propsOf(client, "hint_used")).toHaveLength(1);

        navigate("reference");
        expect(propsOf(client, "$pageview")).toEqual([{ surface: "reference" }]);

        // Nothing a person typed beyond a known command's name ever leaves.
        const sent = JSON.stringify(client.capture.mock.calls);
        expect(sent).not.toContain("my-secret-notes");
        expect(sent).not.toContain("private stuff");
        // And every event sent is one the catalogue documents.
        for (const name of events(client)) expect(EVENT_NAMES).toContain(name);
    });

    it("does not count a returning hero's redirect from the bare address as a home page view", async () => {
        const client = fakeClient();
        resetClientForTest(async () => client);
        createHero({ name: "Mira", role: "wanderer" });
        window.history.replaceState(null, "", "#");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        setConsent("granted");
        const store = new GameStore();
        await store.boot(dataLoader);
        off = installAnalytics(store);
        await settle();
        expect(propsOf(client, "$pageview")).toEqual([]);
        navigate("story");
        expect(propsOf(client, "$pageview")).toEqual([{ surface: "story" }]);
    });

    it("caps failed-command reports per visit", async () => {
        const client = fakeClient();
        resetClientForTest(async () => client);
        setConsent("granted");
        const store = new GameStore();
        await store.boot(dataLoader);
        off = installAnalytics(store);
        await settle();
        for (let index = 0; index < FAILED_COMMAND_CAP + 10; index += 1) store.execute("nope");
        expect(propsOf(client, "command_failed")).toHaveLength(FAILED_COMMAND_CAP);
    });

    it("reports panels opening and options changing", async () => {
        const client = fakeClient();
        resetClientForTest(async () => client);
        setConsent("granted");
        const store = new GameStore();
        await store.boot(dataLoader);
        off = installAnalytics(store);
        await settle();
        client.capture.mockClear();

        setUi({ privacyOpen: true });
        setUi({ privacyOpen: false });
        setUi({ docsOpen: true });
        expect(propsOf(client, "overlay_opened").map((props) => props.overlay)).toEqual(["privacy", "docs"]);

        setSettings({ textSize: "large" });
        expect(propsOf(client, "setting_changed")).toEqual([{ setting: "textSize", value: "large" }]);
    });
});

describe("commandName", () => {
    const known = (name: string) => ["ls", "cd", "grep"].includes(name);
    it("keeps a known command's name and nothing after it", () => {
        expect(commandName("  ls -la /home/me/private ", known)).toBe("ls");
        expect(commandName("grep password secrets.txt", known)).toBe("grep");
    });
    it("reports anything else as unknown", () => {
        expect(commandName("my-password-123", known)).toBe("unknown");
        expect(commandName("", known)).toBe("unknown");
    });
});
