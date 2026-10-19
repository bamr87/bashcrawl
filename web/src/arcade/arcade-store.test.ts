import { beforeEach, describe, expect, it } from "vitest";

import { fxBus, type FxEvent } from "../engine/fx-bus";
import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { ArcadeStore, SCORES_KEY } from "./arcade-store";

loadEngine();

async function boot() {
    window.localStorage.clear();
    const story = new GameStore();
    await story.boot(dataLoader);
    return { story, arcade: new ArcadeStore(story) };
}

describe("the arcade store", () => {
    beforeEach(() => window.localStorage.clear());

    it("starts a trial on a scoped runtime, takes hints, quits home", async () => {
        const { arcade } = await boot();
        expect(arcade.snap.get().phase).toBe("home");
        expect(arcade.promptLabel()).toBe("arcade ▸");
        expect(arcade.start("pathnav")).toBe(true);
        expect(arcade.snap.get().phase).toBe("trial");
        expect(arcade.promptLabel()).toMatch(/⚔$/);
        expect(arcade.objective()?.title).toBe("Path Navigator");
        arcade.execute("hint");
        expect(arcade.stats()?.hints).toBe(1);
        expect(arcade.complete("cd ce")).toBe("cd cellar");
        arcade.execute("ls");
        expect(arcade.stats()?.moves).toBe(1);
        expect(arcade.historyStep(-1)).toBe("ls");
        arcade.execute("quit");
        expect(arcade.snap.get().phase).toBe("home");
        expect(window.localStorage.getItem(SCORES_KEY)).toBeNull();
    });

    it("a cleared trial records a best, awards XP to the story and celebrates", async () => {
        const { story, arcade } = await boot();
        const seen: FxEvent[] = [];
        const off = fxBus.subscribe((e) => { seen.push(e); });
        arcade.start("pathnav");
        const target = String(arcade.ctx?.target ?? "");
        expect(target.startsWith("/entrance/")).toBe(true);
        arcade.execute(`cd ${target}`);
        expect(arcade.snap.get().phase).toBe("finished");
        const saved = JSON.parse(window.localStorage.getItem(SCORES_KEY) ?? "{}") as { games: Record<string, { best: number; plays: number; seen: string[]; last: number }> };
        expect(saved.games.pathnav.plays).toBe(1);
        expect(saved.games.pathnav.best).toBeGreaterThan(0);
        expect(story.model("statusModel").xp).toBeGreaterThan(0);
        expect(seen.some((e) => e.type === "celebrate")).toBe(true);
        expect(seen.some((e) => e.type === "award")).toBe(true);
        arcade.execute("");
        expect(arcade.snap.get().phase).toBe("home");
        off();
    });

    it("the flash deck drills cards from a chosen deck and names a trial typed on the floor", async () => {
        const { story, arcade } = await boot();
        const deck = story.data?.arcade.flash_decks[0];
        expect(arcade.start("flash", deck?.id)).toBe(true);
        expect(arcade.promptLabel()).toBe("flash ⚔");
        arcade.execute("quit");
        arcade.execute("hunt");
        expect(arcade.snap.get().gameId).toBe("hunt");
        expect(arcade.promptLabel()).toBe("/hunt ⚔");
    });
});
