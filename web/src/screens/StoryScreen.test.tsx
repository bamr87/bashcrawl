import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { PromptDock } from "../terminal/PromptDock";
import { setPromptValue } from "../terminal/prompt-store";
import { StoryScreen } from "./StoryScreen";

loadEngine();

async function mount() {
    window.localStorage.clear();
    setPromptValue("");
    const store = new GameStore();
    await store.boot(dataLoader);
    const utils = render(
        <>
            <StoryScreen store={store} />
            <PromptDock store={store} />
        </>,
    );
    return { store, ...utils };
}

describe("StoryScreen", () => {
    it("lays out the panels in the web order with the companions folded", async () => {
        const { container } = await mount();
        const panes = Array.from(container.querySelectorAll("[data-hud-pane]")).map((el) => el.getAttribute("data-hud-pane"));
        expect(panes.slice(0, 2)).toEqual(["quest", "room"]);
        expect(panes).toContain("hero");
        const hero = container.querySelector('[data-hud-pane="hero"] .bc-panel-toggle');
        expect(hero).toHaveAttribute("aria-expanded", "false");
        const quest = container.querySelector('[data-hud-pane="quest"] .bc-panel-toggle');
        expect(quest).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("log", { name: "Dungeon log" })).toBeInTheDocument();
        expect(screen.getByRole("complementary", { name: "Game status panels" })).toBeInTheDocument();
    });

    it("a suggestion chip fills the prompt without running, and the quest panel follows play", async () => {
        const { store } = await mount();
        const chips = screen.getByRole("group", { name: "Suggested next commands" });
        const quest = within(chips).getByRole("button", { name: /pwd/ });
        await act(async () => { quest.click(); });
        expect(screen.getByRole("textbox", { name: "Command" })).toHaveValue("pwd");
        expect(store.model("statusModel").questsDone).toBe(0);

        await act(async () => { store.execute("pwd"); });
        expect(document.querySelector('[data-hud-pane="quest"]')).toHaveTextContent(/1\/8 complete/);
        expect(document.querySelector('[data-hud-pane="room"]')).toHaveTextContent("THE ENTRANCE HALL");

        await act(async () => { store.execute("cd cellar"); });
        expect(document.querySelector('[data-hud-pane="room"]')).toHaveTextContent("/entrance/cellar");
        expect(document.querySelector(".bc-map-here")).toHaveTextContent("cellar/");
    });

    it("folds a pane from its title and remembers it", async () => {
        const { store } = await mount();
        const toggle = document.querySelector<HTMLButtonElement>('[data-hud-pane="map"] .bc-panel-toggle');
        await act(async () => { toggle?.click(); });
        expect(store.layout().panes.find((p) => p.id === "map")?.collapsed).toBe(true);
        expect(document.querySelector('[data-hud-pane="map"] .bc-panel-body')).toHaveAttribute("aria-hidden", "true");
        expect(document.querySelector('[data-hud-pane="map"] .bc-panel-fold')).not.toHaveAttribute("data-open");
        expect(JSON.parse(window.localStorage.getItem("bashcrawl-hud-layout-v1") ?? "{}").panes.find((p: { id: string }) => p.id === "map").collapsed).toBe(true);
    });
});
