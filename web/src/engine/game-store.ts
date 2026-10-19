// The story's state, outside React: the Runtime, the TerminalView that
// paints into the log, the SessionController that runs lines and persists,
// and the HUD presenter's models memoised per version. Components read it
// through useSyncExternalStore; the only thing that changes the snapshot is
// a published version bump, so eight panels asking for the same model share
// one computation. A module singleton (`game`) is the app's store; tests
// build their own.
import { createStore, useStore, type Store } from "../lib/store";
import type { InputTarget } from "../terminal/input-target";
import { loadGameData } from "./data";
import { fxBus } from "./fx-bus";
import { requireEngine } from "./index";
import type {
    Capabilities, GameData, HudAction, HudLayout, HudModelName, HudModels, HudSnapshot,
    Line, Runtime, RuntimeState, SessionController, SessionSpec, TerminalView,
} from "./types";

export type GamePhase = "idle" | "loading" | "ready" | "error";

export interface GameSnap {
    phase: GamePhase;
    version: number;
    error: string | null;
    /** Text the pager is showing (`less`), or null. */
    page: string | null;
}

// The web sidebar leads with the quest (what to do) and the room (where you
// are); the companion panes start folded. Saved layouts keep their flags.
export const WEB_PANE_ORDER = ["quest", "room", "pack", "lesson", "map", "skills", "hero", "spotlight"];
export const WEB_PANES_FOLDED = ["skills", "hero", "spotlight"];

const CAPABILITIES: Capabilities = { surface: "web", pager: true, compactEvents: true };
const LOG_CAP = 600;

// The session echoes each command as a dim "/path $ cmd" line; marking those
// lets CSS draw a rule above every command block. Idempotent, so a full
// repaint (scrollback cap) is simply marked again.
const CMD_ECHO = /^(\/\S*\s\$)\s(.*)$/s;
export function markCommandBlocks(log: HTMLElement, escapeHtml: (value: unknown) => string): void {
    log.querySelectorAll("span.kind-dim:not(.is-cmd)").forEach((span) => {
        const match = CMD_ECHO.exec(span.textContent || "");
        if (!match) return;
        span.classList.add("is-cmd");
        span.innerHTML = `<span class="cmd-prompt">${escapeHtml(match[1])}</span> <span class="cmd-text">${escapeHtml(match[2])}</span>`;
    });
}

export class GameStore implements InputTarget {
    readonly id = "story";
    readonly snap: Store<GameSnap> = createStore<GameSnap>({ phase: "idle", version: 0, error: null, page: null });
    data: GameData | null = null;
    runtime: Runtime | null = null;
    view: TerminalView | null = null;
    controller: SessionController | null = null;
    saveError = "";

    private bootPromise: Promise<void> | null = null;
    private cache = new Map<string, unknown>();
    private prev: HudSnapshot | null = null;
    private logEl: HTMLElement | null = null;

    // ── lifecycle ──────────────────────────────────────────────────────
    boot(loader: () => Promise<GameData> = loadGameData): Promise<void> {
        if (this.bootPromise) return this.bootPromise;
        this.snap.set({ ...this.snap.get(), phase: "loading" });
        this.bootPromise = (async () => {
            try {
                const data = await loader();
                this.start(data);
            } catch (err) {
                console.error("Bashcrawl failed to boot:", err);
                this.snap.set({ ...this.snap.get(), phase: "error", error: err instanceof Error ? err.message : String(err) });
            }
        })();
        return this.bootPromise;
    }

    private start(data: GameData): void {
        const { TermForge, BashcrawlRuntime: RT, BashcrawlStorage: Storage, BashcrawlHud: Hud } = requireEngine();
        this.data = data;
        Hud.attachStore(
            { load: () => Storage.loadKey(Hud.LAYOUT_KEY, {}), save: (value) => Storage.saveKey(Hud.LAYOUT_KEY, value) },
            { dock: "left", order: WEB_PANE_ORDER, collapsed: WEB_PANES_FOLDED },
        );

        // Restore the save: a shape the storage layer accepts, then the
        // runtime's stricter check; a broken save is backed up, not lost.
        let initial: RuntimeState | undefined = Storage.load(() => RT.defaultState(data.world.root));
        this.saveError = Storage.lastError ? `Could not restore progress: ${Storage.lastError}` : "";
        try {
            initial = RT.loadState(data.world, initial, data.progression);
        } catch (err) {
            Storage.backup();
            this.saveError = `Could not restore progress: ${err instanceof Error ? err.message : String(err)}`;
            initial = undefined;
        }
        this.runtime = new RT.Runtime(data, initial);

        this.view = new TermForge.view.TerminalView({
            sink: null,
            cap: LOG_CAP,
            onControl: (action) => {
                if (action === "reset") {
                    this.runtime = new RT.Runtime(data);
                    Storage.clear();
                    return true;
                }
                return false;
            },
        });
        // The controller reads the runtime through a getter so a `reset`
        // (which replaces it) is picked up without rewiring.
        const session: SessionSpec = Object.defineProperty(
            { maxLine: RT.lineLimit, commandLabel: RT.commandLabel } as SessionSpec,
            "runtime",
            { get: () => this.runtime as Runtime, enumerable: true },
        );
        this.controller = new TermForge.session.SessionController(
            session,
            {
                view: this.view,
                persistence: { description: "Progress is saved in this browser.", save: (state) => Storage.save(state) },
                capabilities: CAPABILITIES,
                onPage: (text) => this.openPage(text),
            },
        );
        this.welcome();
        Hud.ensureVisited(this.runtime);
        this.prev = Hud.snapshot(this.runtime);
        this.publish({ phase: "ready", error: null });
        fxBus.publish({ type: "boot" });
    }

    private welcome(): void {
        const rt = this.runtime;
        const view = this.view;
        if (!rt || !view) return;
        view.appendLine("banner", rt.art("banner"));
        if (this.saveError) view.appendLine("error", this.saveError);
        view.appendLine("info", "Welcome to Bashcrawl.");
        view.appendLine("dim", "Try: pwd · ls -F · cat scroll · cd cellar  —  stuck? type hint  ·  F1 opens the Docs  ·  the chips under the log suggest what to type next.");
        view.appendLine("magic", "🎓  New to the terminal? The Learn door (Alt+2) walks you through it.   🕹 Arcade (Alt+3) drills   📖 Reference (Alt+4) cheatsheets");
        if (rt.state.trainer && rt.state.trainer.active) {
            for (const out of rt.trainerChallenge()) view.appendLine(out.kind, out.text);
        }
    }

    private publish(patch: Partial<GameSnap>): void {
        this.cache.clear();
        const current = this.snap.get();
        this.snap.set({ ...current, ...patch, version: current.version + 1 });
    }

    // ── the log ────────────────────────────────────────────────────────
    /** A <pre> to paint into (or null to detach). Repaints in full on attach. */
    attachLog(element: HTMLElement | null): void {
        const { TermForge } = requireEngine();
        this.logEl = element;
        if (!this.view) return;
        // A DomSink assumes it starts on an empty element: clear whatever a
        // previous attach painted before the full repaint below.
        if (element) element.replaceChildren();
        this.view.sink = element ? new TermForge.sinks.DomSink(element) : null;
        if (element) this.flushLog();
    }

    flushLog(): void {
        if (!this.view) return;
        this.view.flush();
        if (this.logEl) markCommandBlocks(this.logEl, requireEngine().TermForge.sinks.escapeHtml);
    }

    appendLine(kind: string, text: string): void {
        this.view?.appendLine(kind, text);
        this.flushLog();
    }

    clearLog(): void {
        this.view?.clear();
        this.flushLog();
    }

    // ── commands ───────────────────────────────────────────────────────
    execute(line: string): Line[] {
        const { BashcrawlHud: Hud } = requireEngine();
        if (!this.runtime || !this.controller) return [];
        const before = this.prev ?? Hud.snapshot(this.runtime);
        const outputs = this.controller.execute(line, { echo: true });
        // `reset` may have swapped the runtime; the fog-of-war visit set is
        // recorded after the command and persisted with it.
        Hud.ensureVisited(this.runtime);
        this.controller.persist();
        const after = Hud.snapshot(this.runtime);
        const events = Hud.diffEvents(before, after);
        this.prev = after;
        this.flushLog();
        this.publish({});
        fxBus.publish({ type: "command", line, outputs, events, error: outputs.some((out) => out.kind === "error") });
        return outputs;
    }

    acceptsEmpty(): boolean {
        return false;
    }

    /** XP from outside the story (the arcade's trials). */
    awardXp(amount: number, label: string): void {
        const { BashcrawlHud: Hud } = requireEngine();
        if (!this.runtime || !this.controller || !amount) return;
        const before = this.prev ?? Hud.snapshot(this.runtime);
        this.runtime.awardXp(amount, label);
        this.controller.persist();
        const after = Hud.snapshot(this.runtime);
        const events = Hud.diffEvents(before, after);
        this.prev = after;
        this.publish({});
        fxBus.publish({ type: "award", amount, label, events });
    }

    historyStep(direction: -1 | 1): string | null {
        const { TermForge } = requireEngine();
        return this.runtime ? TermForge.input.historyStep(this.runtime.state, direction) : null;
    }

    complete(text: string): string | null {
        const { TermForge } = requireEngine();
        if (!this.runtime) return null;
        const { value, echo } = TermForge.input.applyCompletion(text, this.runtime.completions(text));
        if (echo) this.appendLine("info", echo);
        return value;
    }

    promptLabel(): string {
        return this.runtime ? this.runtime.promptLabel() : "$";
    }

    placeholder(): string {
        const rows = this.runtime ? this.model("suggestionsModel") : [];
        return rows.length ? `e.g. ${rows[0].cmd}` : "Type a command…";
    }

    // ── pager ──────────────────────────────────────────────────────────
    openPage(text: string): void {
        this.snap.set({ ...this.snap.get(), page: text });
    }

    closePage(): void {
        if (this.snap.get().page == null) return;
        this.snap.set({ ...this.snap.get(), page: null });
    }

    // ── presenter models and layout ────────────────────────────────────
    model<K extends HudModelName>(name: K): HudModels[K] {
        if (this.cache.has(name)) return this.cache.get(name) as HudModels[K];
        const { BashcrawlHud: Hud } = requireEngine();
        if (!this.runtime) throw new Error("game not booted");
        const value = Hud[name](this.runtime) as HudModels[K];
        this.cache.set(name, value);
        return value;
    }

    layout(): HudLayout {
        return requireEngine().BashcrawlHud.getLayout();
    }

    applyLayout(action: HudAction): string {
        const { message } = requireEngine().BashcrawlHud.applyAction(action);
        this.publish({});
        return message;
    }
}

// One store per page, even when Vite's HMR re-evaluates this module under a
// new ?t= URL after an edit: a second instance would own a second runtime,
// and the components would split between them.
const SINGLETON = "__bashcrawlGame";
const registry = globalThis as unknown as Record<string, GameStore | undefined>;
export const game: GameStore = registry[SINGLETON] ?? (registry[SINGLETON] = new GameStore());

export function useGame<S>(selector: (snap: GameSnap) => S, store: GameStore = game): S {
    return useStore(store.snap, selector);
}

/** A presenter model, recomputed only when the store publishes. */
export function useModel<K extends HudModelName>(name: K, store: GameStore = game): HudModels[K] {
    return useStore(store.snap, () => store.model(name));
}
