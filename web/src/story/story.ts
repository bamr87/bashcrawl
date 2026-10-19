// The story observer: turns what the engine reports into chronicle
// chapters, journal entries and dialogue. A quest completed unlocks its
// chapter; a hall entered for the first time unlocks its chapter (and is
// noted either way); a scroll read is kept with the command that re-opens
// it; a rank gained is noted; the main road walked unlocks the epilogue.
import { fxBus } from "../engine/fx-bus";
import { game, type GameStore } from "../engine/game-store";
import { getHero } from "../hero/hero-store";
import { commandOf, FILE_VIEWERS } from "../terminal/prose";
import { chapterFor, renderChapter } from "./chronicle";
import { pushDialogue } from "./dialogue-store";
import { getJournal, recordChapter, recordEntry, recordRoom, recordScroll } from "./journal-store";

/** Unlock a chapter: into the journal, then told in the dialogue box. Returns true when it was new. */
export function unlockChapter(key: string): boolean {
    const chapter = chapterFor(key);
    if (!chapter) return false;
    const { title, pages } = renderChapter(chapter, getHero());
    if (!recordChapter(key, title)) return false;
    const kicker = chapter.numeral ? (chapter.numeral.length > 2 ? chapter.numeral : `Chapter ${chapter.numeral}`) : "The Chronicle";
    // The road ahead rides on the last page.
    const told = chapter.next && pages.length ? [...pages.slice(0, -1), `${pages[pages.length - 1]}\n\n${chapter.next}`] : pages;
    pushDialogue({ id: `chapter:${key}`, kicker, title, pages: told });
    return true;
}

/** The first line that reads as a title: the first wordy line, stripped of rule characters. */
export function scrollTitle(text: string, fallback: string): string {
    for (const raw of text.split("\n")) {
        const line = raw.replace(/^[#=\-~*\s]+|[#=\-~*\s]+$/g, "").trim();
        if (/[A-Za-z]{3,}/.test(line) && line.length <= 72) return line;
    }
    return fallback;
}

function discover(path: string, store: GameStore): void {
    const runtime = store.runtime;
    if (!runtime) return;
    const meta = runtime.world.rooms[path];
    const title = meta?.title ?? path;
    recordRoom(path, title, meta?.description ?? "");
    const slug = meta?.slug ?? path.split("/").pop() ?? "";
    unlockChapter(`room:${slug}`);
}

function noteScroll(line: string, outputs: Array<{ kind: string; text?: string }>, store: GameStore): void {
    const runtime = store.runtime;
    if (!runtime) return;
    const tokens = line.trim().split(/\s+/);
    const arg = tokens.slice(1).find((token) => !token.startsWith("-"));
    if (!arg || !FILE_VIEWERS.has(commandOf(line))) return;
    const path = runtime.resolve(arg);
    const text = outputs.filter((out) => out.kind === "output").map((out) => out.text ?? "").join("\n");
    if (!text.trim()) return;
    recordScroll(path, scrollTitle(text, runtime.basename(path)), runtime.currentRoomMeta().title ?? runtime.state.cwd);
}

export function installStory(store: GameStore = game): () => void {
    return fxBus.subscribe((event) => {
        if (event.type !== "command" || !store.runtime) return;
        // A hero from before the chronicle existed starts it on their next command.
        if (!getJournal().entries.some((entry) => entry.kind === "chapter")) unlockChapter("prologue");
        for (const change of event.events) {
            if (change.type === "quest" && event.questId != null) unlockChapter(`quest:${event.questId}`);
            if (change.type === "move" && event.discovered && change.to) discover(change.to, store);
            if (change.type === "levelup") {
                const title = change.text.replace(/^★\s*/, "");
                recordEntry({ id: `rank:${title}`, kind: "rank", title, ref: title, body: "A new rank on the ladder." });
            }
        }
        if (!event.error) noteScroll(event.line, event.outputs, store);
        const status = store.model("statusModel");
        if (status.questsTotal > 0 && status.questsDone >= status.questsTotal) unlockChapter("epilogue");
    });
}
