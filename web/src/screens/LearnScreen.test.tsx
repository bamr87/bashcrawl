import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { LessonReader } from "../learn/LessonReader";
import { dataLoader, loadEngine } from "../test/engine";
import { setPromptValue } from "../terminal/prompt-store";

loadEngine();

async function mount() {
    window.localStorage.clear();
    setPromptValue("");
    const store = new GameStore();
    await store.boot(dataLoader);
    const utils = render(<LessonReader store={store} />);
    const run = async (line: string) => { await act(async () => { store.execute(line); }); };
    return { store, run, ...utils };
}

describe("the lesson reader", () => {
    it("shows the catalogue, then the lesson, then the next lesson as objectives are met", async () => {
        const { store, run, container } = await mount();
        const cards = container.querySelectorAll(".bc-course");
        expect(cards.length).toBe(store.runtime?.courses.length);
        expect(container.querySelector('[data-run="learn navigator"]')).toBeInTheDocument();
        expect(container.querySelector(".bc-level-beginner")).toHaveTextContent("beginner");
        expect(container).toHaveTextContent("best after Finding Your Way");

        await run("learn navigator");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Where am I?");
        expect(container).toHaveTextContent("Lesson 1 of 5");
        expect(container.querySelector(".bc-outline li.is-current")).toBeInTheDocument();
        expect(container.querySelector(".learn-body p strong")).toHaveTextContent("current working directory");
        expect(container.querySelector(".obj-open .obj-mark")).toHaveTextContent("○");
        expect(container.querySelector('[data-run="cd /lab/navigator"]')).toBeInTheDocument();
        expect(container.querySelector('[data-run="lesson hint"]')).toBeInTheDocument();

        await run("cd /lab/navigator");
        expect(container.querySelector(".obj-met.is-new .obj-mark")).toHaveTextContent("✔");
        expect(container.querySelector('[data-run="cd /lab/navigator"]')).toBeNull();
        expect(container.querySelector(".bc-objectives-count")).toHaveTextContent("1/2");

        await run("pwd");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Look around");
        expect(container.querySelector(".bc-outline li.is-done")).toBeInTheDocument();
    });

    it("a rendered code span fills the prompt; a chip runs; a finished course shows what is left", async () => {
        const { store, run, container } = await mount();
        await run("learn navigator");
        const code = container.querySelector<HTMLElement>(".learn-body code[data-fill]");
        expect(code).not.toBeNull();
        const { getPrompt } = await import("../terminal/prompt-store");
        await act(async () => { code?.click(); });
        expect(getPrompt().value).toBe(code?.dataset.fill);

        const quit = container.querySelector<HTMLButtonElement>('[data-run="learn quit"]');
        await act(async () => { quit?.click(); });
        expect(container).toHaveTextContent("Guided courses");

        await run("learn navigator");
        const state = store.runtime!.state;
        // A course counts as complete only with every lesson earned, so the
        // injected save lists the real lesson ids rather than a guess.
        const done = store.runtime!.courses.find((course) => course.id === "navigator")!.lessons.map((lesson) => lesson.id);
        store.runtime!.state = { ...state, learn: { ...state.learn, progress: { navigator: { lesson: 4, met: [], done, complete: true } } } };
        await run("pwd");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Finding Your Way complete");
        expect(container).toHaveTextContent("Keep going");
        expect(container.querySelector('[data-run="learn navigator"]')).toBeNull();
    });
});
