import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fxBus, type FxEvent } from "../engine/fx-bus";
import { GameStore } from "../engine/game-store";
import { QuestTracker } from "../story/QuestTracker";
import { dataLoader, loadEngine } from "../test/engine";
import { QuestPanelBody } from "./QuestPanel";

loadEngine();

// Quests 0-6 with the amulet; the coins come next (#113's road to the study).
const PREP = [
    "pwd", "ls", "cd cellar", "cat scroll", "./treasure", "cd armoury", "./treasure",
    "cd /entrance", "mkdir workshop", "cd workshop", "touch notes.txt",
    "cd /entrance/cellar", "grep catacombs scroll",
    "cd /entrance/cellar/armoury/chamber", "./treasure",
];
const LIBRARY = "cd /entrance/chapel/courtyard/aviary/hall/library";

function doneLabels(list: HTMLElement): string[] {
    return within(list).getAllByRole("listitem").filter((li) => li.hasAttribute("data-done")).map((li) => li.textContent?.replace(/^☑\s*/, "").replace(/ \(done\)$/, "") ?? "");
}

describe("quest steps", () => {
    it("draws no checklist for a quest without steps", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        render(<><QuestPanelBody store={store} /><QuestTracker store={store} /></>);
        expect(screen.queryAllByRole("list", { name: /Quest steps/ })).toHaveLength(0);
    });

    it("ticks quest 7's steps in the panel and the tracker, with one quest-step event per tick", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        await act(async () => { for (const line of PREP) store.execute(line); });
        render(<><QuestPanelBody store={store} /><QuestTracker store={store} /></>);

        const lists = screen.getAllByRole("list", { name: /Quest steps, 1 of 6 done/ });
        expect(lists).toHaveLength(2);
        expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(6);
        expect(doneLabels(lists[0])).toEqual(["Carry the amulet and coins"]);

        const seen: FxEvent[] = [];
        const off = fxBus.subscribe((event) => { seen.push(event); });
        await act(async () => { store.execute(LIBRARY); });
        await act(async () => { store.execute("./tome"); });
        off();

        const steps = seen.flatMap((event) => (event.type === "command" ? event.events.filter((e) => e.type === "quest-step") : []));
        expect(steps.map((e) => e.label)).toEqual(["Find the chapel library", "Read the tome: ./tome"]);
        for (const list of screen.getAllByRole("list", { name: /Quest steps, 3 of 6 done/ })) {
            expect(doneLabels(list)).toEqual(["Carry the amulet and coins", "Find the chapel library", "Read the tome: ./tome"]);
        }
    });
});
