import { beforeEach, describe, expect, it } from "vitest";

import { setUi } from "../chrome/ui-store";
import { GameStore } from "../engine/game-store";
import { clearHero, createHero } from "../hero/hero-store";
import { dataLoader, loadEngine } from "../test/engine";
import { CHAPTERS, chapterFor, renderChapter, ROAD_KEYS } from "./chronicle";
import { clearDialogues, getDialogue } from "./dialogue-store";
import { getJournal, markJournalRead, recordChapter, recordScroll, resetJournal, unreadCount } from "./journal-store";
import { installStory, scrollTitle, unlockChapter } from "./story";

loadEngine();

describe("the chronicle", () => {
    it("has a chapter for every main quest, the prologue, the epilogue and every hidden hall", async () => {
        const store = new GameStore();
        await store.boot(dataLoader);
        const quests = store.runtime?.quests ?? [];
        expect(quests.length).toBe(8);
        for (const quest of quests) expect(chapterFor(`quest:${quest.id}`)?.title, quest.title).toBeTruthy();
        expect(ROAD_KEYS).toEqual(["prologue", "quest:0", "quest:1", "quest:2", "quest:3", "quest:4", "quest:5", "quest:6", "quest:7", "epilogue"]);
        const rooms = Object.values(store.runtime?.world.rooms ?? {});
        for (const room of rooms.filter((meta) => meta.hidden)) expect(chapterFor(`room:${room.slug}`), room.slug).not.toBeNull();
        for (const chapter of CHAPTERS) expect(chapter.text.length).toBeGreaterThan(0);
        const hero = createHero({ name: "Mira", role: "sage" });
        const prologue = renderChapter(chapterFor("prologue") as NonNullable<ReturnType<typeof chapterFor>>, hero);
        expect(prologue.pages[0]).toContain("Mira");
        expect(prologue.pages[2]).toContain("A Sage walks");
    });
});

describe("the journal", () => {
    beforeEach(() => {
        window.localStorage.clear();
        resetJournal();
        clearDialogues();
    });

    it("records once, counts unread, persists and resets", () => {
        expect(recordChapter("quest:0", "Know Thy Place")).toBe(true);
        expect(recordChapter("quest:0", "Know Thy Place")).toBe(false);
        expect(recordScroll("/entrance/scroll", "Ancient Scroll of Sight", "THE ENTRANCE HALL")).toBe(true);
        expect(getJournal().entries.map((entry) => entry.kind)).toEqual(["chapter", "scroll"]);
        expect(getJournal().entries[1]?.command).toBe("cat /entrance/scroll");
        expect(unreadCount()).toBe(2);
        markJournalRead();
        expect(unreadCount()).toBe(0);
        expect(JSON.parse(window.localStorage.getItem("bashcrawl-web-journal-v1") ?? "{}").entries.length).toBe(2);
        resetJournal();
        expect(getJournal().entries).toEqual([]);
    });

    it("titles a scroll from its first wordy line", () => {
        expect(scrollTitle("\n=====\n   ANCIENT SCROLL OF SIGHT\n=====\nIt is dark.", "scroll")).toBe("ANCIENT SCROLL OF SIGHT");
        expect(scrollTitle("# 🚪 Welcome to the Entrance", "README.md")).toBe("🚪 Welcome to the Entrance");
        expect(scrollTitle("====\n----", "notes.txt")).toBe("notes.txt");
    });
});

describe("the story observer", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        createHero({ name: "Mira", role: "wanderer" });
        resetJournal();
        clearDialogues();
        setUi({ overlay: null, tour: null });
    });

    it("tells the prologue, then a chapter per quest, notes halls and scrolls, and queues dialogue", async () => {
        const store = new GameStore();
        await store.boot(dataLoader);
        const off = installStory(store);
        store.execute("pwd");
        const chapters = () => getJournal().entries.filter((entry) => entry.kind === "chapter").map((entry) => entry.ref);
        expect(chapters()).toEqual(["prologue", "quest:0"]);
        expect(getDialogue().current?.id).toBe("chapter:prologue");
        expect(getDialogue().queued).toBe(1);
        store.execute("cat scroll");
        const scroll = getJournal().entries.find((entry) => entry.kind === "scroll");
        expect(scroll).toMatchObject({ ref: "/entrance/scroll", title: "ANCIENT SCROLL OF SIGHT", room: "THE ENTRANCE HALL", command: "cat /entrance/scroll" });
        // The quests run in order: ls is chapter II, the cellar chapter III.
        store.execute("ls");
        expect(chapters()).toContain("quest:1");
        store.execute("cd cellar");
        expect(getJournal().entries.find((entry) => entry.kind === "room")).toMatchObject({ ref: "/entrance/cellar", title: "THE CELLAR", command: "cd /entrance/cellar" });
        expect(chapters()).toContain("quest:2");
        // Already visited: no second room entry; a quest chapter is never retold.
        store.execute("cd ..");
        store.execute("cd cellar");
        expect(getJournal().entries.filter((entry) => entry.ref === "/entrance/cellar").length).toBe(1);
        expect(unlockChapter("quest:0")).toBe(false);
        off();
    });
});
