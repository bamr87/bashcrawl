// The engine bridge: one place that reads the classic-script globals and
// hands them to the app typed. index.html loads web/assets/js ahead of the
// module entry, so by the time React runs these exist; a missing one means
// the page was built or served without the engine, and we say so.
import type {
    AmbientModule, ArcadeModule, CommandFxModule, HudModule, LearnModule,
    RuntimeModule, StorageModule, TermForgeGlobal,
} from "./types";

export interface Engine {
    TermForge: TermForgeGlobal;
    BashcrawlRuntime: RuntimeModule;
    BashcrawlHud: HudModule;
    BashcrawlStorage: StorageModule;
    BashcrawlLearn?: LearnModule;
    BashcrawlCommandFx?: CommandFxModule;
    BashcrawlAmbient?: AmbientModule;
    BashcrawlArcade?: ArcadeModule;
    BashcrawlArtClips?: Record<string, unknown>;
}

const REQUIRED = ["TermForge", "BashcrawlRuntime", "BashcrawlHud", "BashcrawlStorage"] as const;

export function engineLoaded(): boolean {
    return REQUIRED.every((key) => Boolean(window[key]));
}

export function requireEngine(): Engine {
    const missing = REQUIRED.filter((key) => !window[key]);
    if (missing.length) {
        throw new Error(
            `Bashcrawl engine not loaded (missing ${missing.join(", ")}). `
            + "web/index.html must load the scripts under web/assets/js before src/main.tsx; "
            + "run `make web-build` and serve the folder (the data files are fetched, so file:// will not do).",
        );
    }
    return {
        TermForge: window.TermForge as TermForgeGlobal,
        BashcrawlRuntime: window.BashcrawlRuntime as RuntimeModule,
        BashcrawlHud: window.BashcrawlHud as HudModule,
        BashcrawlStorage: window.BashcrawlStorage as StorageModule,
        BashcrawlLearn: window.BashcrawlLearn,
        BashcrawlCommandFx: window.BashcrawlCommandFx,
        BashcrawlAmbient: window.BashcrawlAmbient,
        BashcrawlArcade: window.BashcrawlArcade,
        BashcrawlArtClips: window.BashcrawlArtClips,
    };
}
