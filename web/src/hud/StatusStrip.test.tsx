import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { StatusStrip } from "./StatusStrip";

loadEngine();

describe("StatusStrip", () => {
    it("shows rank, XP toward the next rank, health, quests and badges, and moves with the game", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        const ranks = store.runtime?.catalog.ranks ?? [];
        render(<StatusStrip store={store} />);

        expect(screen.getByRole("group", { name: "Hero status" })).toBeInTheDocument();
        expect(screen.getByText(ranks[0].title)).toBeInTheDocument();
        expect(screen.getByTitle(`${ranks[1].min} XP to ${ranks[1].title}`)).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Health 100 of 100" })).toHaveStyle({ "--fill": "100" });
        expect(screen.getByRole("img", { name: /0% of the way/ })).toHaveStyle({ "--fill": "0" });
        expect(screen.getByRole("button", { name: /0 of 8 quests/ })).toBeInTheDocument();

        await act(async () => { store.execute("pwd"); });
        const xp = store.model("statusModel").xp;
        expect(xp).toBeGreaterThan(0);
        expect(document.querySelector(".bc-status-xp [data-value]")).toHaveAttribute("data-value", String(xp));
        expect(screen.getByRole("button", { name: /1 of 8 quests/ })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: /% of the way/ })).toHaveAttribute("data-tone", "xp");
    });

    it("runs the command behind an item", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        render(<StatusStrip store={store} />);
        const lines = store.view?.lines.length ?? 0;
        await act(async () => { screen.getByRole("button", { name: /0 of 15 badges/ }).click(); });
        expect(store.view?.lines.length ?? 0).toBeGreaterThan(lines);
        expect(store.view?.lines.some((line) => /achievements|badge/i.test(line.text))).toBe(true);
    });
});
