// The engine globals index.html installs before the app module runs.
import type {
    AmbientModule, ArcadeModule, CommandFxModule, HudModule, LearnModule,
    RuntimeModule, StorageModule, TermForgeGlobal,
} from "./types";

declare global {
    interface Window {
        TermForge?: TermForgeGlobal;
        BashcrawlRuntime?: RuntimeModule;
        BashcrawlHud?: HudModule;
        BashcrawlStorage?: StorageModule;
        BashcrawlLearn?: LearnModule;
        BashcrawlCommandFx?: CommandFxModule;
        BashcrawlAmbient?: AmbientModule;
        BashcrawlArcade?: ArcadeModule;
        BashcrawlArtClips?: Record<string, unknown>;
    }
}

export {};
