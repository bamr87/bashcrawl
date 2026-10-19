import { beforeEach, describe, expect, it } from "vitest";

import { dataLoader, loadEngine } from "../test/engine";
import { fxBus, type FxEvent } from "./fx-bus";
import { GameStore } from "./game-store";

loadEngine();

async function booted(): Promise<GameStore> {
    const store = new GameStore();
    await store.boot(dataLoader);
    return store;
}

describe("game store", () => {
    beforeEach(() => window.localStorage.clear());

    it("boots the engine, executes commands, publishes HUD events and saves", async () => {
        const store = await booted();
        expect(store.snap.get().phase).toBe("ready");
        expect(store.model("statusModel").xp).toBe(0);
        const seen: FxEvent[] = [];
        const off = fxBus.subscribe((event) => { seen.push(event); });
        const v0 = store.snap.get().version;
        store.execute("pwd");
        expect(store.snap.get().version).toBeGreaterThan(v0);
        const types = seen.flatMap((e) => (e.type === "command" ? e.events.map((x) => x.type) : []));
        expect(types).toContain("xp");
        expect(store.model("statusModel").questsDone).toBe(1);
        store.execute("cd cellar");
        expect(seen.flatMap((e) => (e.type === "command" ? e.events.map((x) => x.type) : []))).toContain("move");
        expect(store.model("roomModel").path).toBe("/entrance/cellar");
        expect(store.promptLabel()).toBe("/entrance/cellar $");
        const saved = JSON.parse(window.localStorage.getItem("bashcrawl-web-state-v1") ?? "{}") as { cwd?: string; visited?: string[] };
        expect(saved.cwd).toBe("/entrance/cellar");
        expect(saved.visited).toContain("/entrance/cellar");
        off();
    });

    it("paints into an attached log, marks command blocks, and detaches cleanly", async () => {
        const store = await booted();
        const pre = document.createElement("pre");
        store.attachLog(pre);
        expect(pre.querySelectorAll("span").length).toBeGreaterThan(3);
        expect(pre.textContent).toContain("Welcome to Bashcrawl.");
        store.execute("ls");
        const echo = pre.querySelector("span.is-cmd");
        expect(echo?.textContent).toBe("/entrance $ ls");
        expect(echo?.querySelector(".cmd-prompt")?.textContent).toBe("/entrance $");
        store.attachLog(null);
        store.execute("pwd");
        expect(pre.textContent).not.toContain("/entrance $ pwd");
    });

    it("walks history, completes names, echoes candidate lists and clears", async () => {
        const store = await booted();
        store.execute("pwd");
        store.execute("ls");
        expect(store.historyStep(-1)).toBe("ls");
        expect(store.historyStep(-1)).toBe("pwd");
        expect(store.complete("cd ce")).toBe("cd cellar");
        const lines = store.view?.lines.length ?? 0;
        expect(store.complete("c")).toBeNull();
        expect(store.view?.lines.length ?? 0).toBeGreaterThan(lines);
        store.clearLog();
        expect(store.view?.lines).toEqual([]);
    });

    it("opens the pager for less and closes it", async () => {
        const store = await booted();
        store.execute("less scroll");
        expect(store.snap.get().page).toMatch(/ANCIENT SCROLL OF SIGHT/);
        store.closePage();
        expect(store.snap.get().page).toBeNull();
    });

    it("awards XP from outside the story through the runtime", async () => {
        const store = await booted();
        const seen: FxEvent[] = [];
        const off = fxBus.subscribe((event) => { seen.push(event); });
        store.awardXp(40, "Path Navigator");
        expect(store.model("statusModel").xp).toBe(40);
        expect(seen.some((e) => e.type === "award" && e.amount === 40)).toBe(true);
        off();
    });

    it("suggests what to type next and uses it as the placeholder", async () => {
        const store = await booted();
        expect(store.model("suggestionsModel")[0]).toMatchObject({ cmd: "pwd", kind: "quest" });
        expect(store.placeholder()).toBe("e.g. pwd");
    });

    it("applies HUD layout actions with the web defaults", async () => {
        const store = await booted();
        expect(store.layout().panes.map((p) => p.id).slice(0, 2)).toEqual(["quest", "room"]);
        expect(store.layout().panes.find((p) => p.id === "hero")?.collapsed).toBe(true);
        store.applyLayout({ op: "dock", side: "right" });
        expect(store.layout().dock).toBe("right");
        expect(JSON.parse(window.localStorage.getItem("bashcrawl-hud-layout-v1") ?? "{}")).toMatchObject({ dock: "right" });
    });
});
