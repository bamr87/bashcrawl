import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { QuestTracker } from "./QuestTracker";

loadEngine();

describe("the objective tracker", () => {
    it("stands in for the Quest panel: absent while the panel is open, present once it is folded or hidden", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        store.applyLayout({ op: "reset" });
        render(<QuestTracker store={store} />);
        // The panel is open in the sidebar by default: the tracker would repeat it over the log.
        expect(screen.queryByRole("complementary", { name: "Current objective" })).toBeNull();

        await act(async () => { store.applyLayout({ op: "toggle", id: "quest", field: "collapsed" }); });
        const tracker = screen.getByRole("complementary", { name: "Current objective" });
        expect(tracker).toHaveTextContent("Quest 1 of 8");
        expect(tracker).toHaveTextContent("pwd");

        await act(async () => { store.applyLayout({ op: "toggle", id: "quest", field: "collapsed" }); });
        expect(screen.queryByRole("complementary", { name: "Current objective" })).toBeNull();
    });
});
