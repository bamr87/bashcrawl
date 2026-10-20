// The Vim Catacombs through the arcade store: keys arrive through the
// prompt's keystroke hook, `:` and `/` lines through execute(), a cleared
// level is recorded and the next one is chosen, and the effects bus hears
// every key. The game's own rules (levels, spikes, the spellbook) are the
// engine suite's (termforge/test/arcade-vim.test.js); this is the wiring.
import { beforeEach, describe, expect, it } from "vitest";

import { fxBus, type FxEvent } from "../engine/fx-bus";
import { GameStore } from "../engine/game-store";
import { getPrompt, setPromptValue } from "../terminal/prompt-store";
import { dataLoader, loadEngine } from "../test/engine";
import { ArcadeStore, SCORES_KEY } from "./arcade-store";

loadEngine();

async function boot() {
    window.localStorage.clear();
    const story = new GameStore();
    await story.boot(dataLoader);
    return { story, arcade: new ArcadeStore(story) };
}

describe("the Vim Catacombs trial", () => {
    beforeEach(() => {
        window.localStorage.clear();
        setPromptValue("");
    });

    it("starts on the first level, reads keys from the prompt, and leaves : and / to it", async () => {
        const { arcade } = await boot();
        const before = getPrompt().focusNonce;
        expect(arcade.start("vim")).toBe(true);
        expect(arcade.snap.get().gameId).toBe("vim");
        expect(arcade.ctx?.level?.id).toBe("first-steps");
        expect(getPrompt().focusNonce).toBeGreaterThan(before);
        expect(arcade.placeholder()).toMatch(/vim keys/);
        expect(arcade.promptLabel()).toBe("vim ⚔");
        expect(arcade.keystroke(":", "")).toBe(false);
        expect(arcade.keystroke("/", "")).toBe(false);
        expect(arcade.keystroke("Shift", "")).toBe(false);
        expect(arcade.keystroke("l", "")).toBe(true);
        expect(arcade.ctx?.vim?.col).toBe(1);
        expect(arcade.stats()).toMatchObject({ keys: 1, par: 22, moves: 0 });
        expect(arcade.keystroke("l", ":q")).toBe(false);
        setPromptValue(":q");
        expect(arcade.keystroke("Escape", ":q")).toBe(true);
        expect(getPrompt().value).toBe("");
        expect(arcade.cheats()[0][0]).toBe("h · j · k · l");
        expect(arcade.cheats().some(([syntax]) => syntax.startsWith("w"))).toBe(false);
    });

    it("answers :help with a hint, :q with the floor, and anything else with E492", async () => {
        const { arcade } = await boot();
        arcade.start("vim");
        arcade.execute(":help");
        expect(arcade.stats()?.hints).toBe(1);
        arcade.execute(":nope");
        expect(arcade.snap.get().phase).toBe("trial");
        expect(arcade.stats()?.hints).toBe(1);
        arcade.execute(":q");
        expect(arcade.snap.get().phase).toBe("home");
        expect(window.localStorage.getItem(SCORES_KEY)).toBeNull();
    });

    it("a typed run moves too, a cleared level is recorded, XP flows, and the next level follows", async () => {
        const { story, arcade } = await boot();
        const seen: FxEvent[] = [];
        const off = fxBus.subscribe((e) => { seen.push(e); });
        arcade.start("vim", "first-steps");
        const solution = arcade.ctx?.level?.solution ?? [];
        for (const run of solution) arcade.execute(run);
        expect(arcade.snap.get().phase).toBe("finished");
        expect(arcade.stats()?.keys).toBe(22);
        const saved = JSON.parse(window.localStorage.getItem(SCORES_KEY) ?? "{}") as { games: Record<string, { best: number; cleared?: string[] }> };
        expect(saved.games.vim.cleared).toEqual(["first-steps"]);
        expect(saved.games.vim.best).toBeGreaterThanOrEqual(100);
        expect(story.model("statusModel").xp).toBeGreaterThan(0);
        expect(seen.some((e) => e.type === "celebrate")).toBe(true);
        expect(seen.some((e) => e.type === "command" && e.events.some((ev) => ev.type === "item"))).toBe(true);
        arcade.execute("");
        expect(arcade.snap.get().phase).toBe("home");
        arcade.start("vim");
        expect(arcade.ctx?.level?.id).toBe("word-leaps");
        expect(arcade.ctx?.allowed).toEqual(["h", "j", "k", "l", "w", "b", "e"]);
        off();
    });

    it("publishes a key event per keystroke, with the spike's damage and an error for a locked key", async () => {
        const { arcade } = await boot();
        const seen: FxEvent[] = [];
        const off = fxBus.subscribe((e) => { seen.push(e); });
        arcade.start("vim", "first-steps");
        for (const key of "jjllll") arcade.keystroke(key, "");
        const keys = seen.filter((e): e is Extract<FxEvent, { type: "key" }> => e.type === "key");
        expect(keys).toHaveLength(6);
        expect(keys[5].events.some((ev) => ev.type === "damage")).toBe(true);
        expect(arcade.ctx?.hp).toBe(2);
        arcade.keystroke("G", "");
        expect(seen[seen.length - 1]).toMatchObject({ type: "key", key: "G", error: true });
        off();
    });

    it("/ searches from the prompt and a lost trial records no clear", async () => {
        const { arcade } = await boot();
        arcade.start("vim", "seek");
        arcade.execute("/*");
        expect(arcade.ctx?.taken).toBe(1);
        expect(arcade.stats()?.keys).toBe(3);
        arcade.execute(":q");
        arcade.start("vim", "first-steps");
        for (const key of "jjllllhlhl") arcade.keystroke(key, "");
        expect(arcade.snap.get().phase).toBe("finished");
        expect(arcade.ctx?.hp).toBe(0);
        const saved = JSON.parse(window.localStorage.getItem(SCORES_KEY) ?? "{}") as { games: Record<string, { plays: number; cleared?: string[] }> };
        expect(saved.games.vim.plays).toBe(1);
        expect(saved.games.vim.cleared ?? []).toEqual([]);
        expect(arcade.keystroke("l", "")).toBe(false);
    });
});
