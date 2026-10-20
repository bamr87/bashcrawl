// The Practice Arcade's state, outside React: which trial is running on
// which scoped runtime, its own log, the best scores (same key and shape as
// before, so records carry over), and the hand-off of XP to the story. The
// games themselves are the engine's (BashcrawlArcade.GAMES): seed world +
// goal predicate + scoring over a bare runtime — nothing is faked. A modal
// trial (the Vim Catacombs) also reads raw keys through the prompt's
// keystroke hook; its `:` and `/` lines come through execute() like any other.
import { fxBus } from "../engine/fx-bus";
import { game, type GameStore } from "../engine/game-store";
import { requireEngine } from "../engine/index";
import type { ArcadeContext, ArcadeGame, ArcadeRecords, Line, TerminalView } from "../engine/types";
import { createStore, useStore, type Store } from "../lib/store";
import type { InputTarget } from "../terminal/input-target";
import { focusPrompt, setPromptValue } from "../terminal/prompt-store";
import { toast } from "../chrome/toast-store";

export const SCORES_KEY = "bashcrawl-web-arcade-v1";

export type ArcadePhase = "home" | "trial" | "finished";

// `:q` and friends end a modal trial; `:help` is a hint; anything else is E492.
const EX_QUIT = new Set(["q", "q!", "qa", "qa!", "wq", "x", "quit", "exit"]);

export interface ArcadeSnap {
    phase: ArcadePhase;
    version: number;
    gameId: string | null;
}

export class ArcadeStore implements InputTarget {
    readonly id = "arcade";
    readonly snap: Store<ArcadeSnap> = createStore<ArcadeSnap>({ phase: "home", version: 0, gameId: null });
    active: ArcadeGame | null = null;
    ctx: ArcadeContext | null = null;
    records: ArcadeRecords;
    private view: TerminalView | null = null;
    private logEl: HTMLElement | null = null;
    private awaitReturn = false;
    private history: string[] = [];
    private historyIndex = 0;

    constructor(private readonly story: GameStore = game) {
        const { BashcrawlStorage: Storage } = requireEngine();
        this.records = Storage.loadKey<ArcadeRecords>(SCORES_KEY, { games: {} });
        if (!this.records.games) this.records.games = {};
    }

    private get arcade() {
        const module = requireEngine().BashcrawlArcade;
        if (!module) throw new Error("the arcade games are not loaded (web/assets/js/arcade.js)");
        return module;
    }

    get games(): ArcadeGame[] {
        return this.arcade.GAMES;
    }

    /** The content bundles (world, commands, arcade) the trials are built from. */
    get data() {
        return this.story.data;
    }

    private ensureView(): TerminalView {
        if (!this.view) {
            const { TermForge } = requireEngine();
            // Non-clear control records append like ordinary lines (the
            // historic arcade behaviour; bare runtimes never emit fanfare).
            this.view = new TermForge.view.TerminalView({ sink: null, cap: 500, onControl: () => true });
        }
        return this.view;
    }

    private publish(patch: Partial<ArcadeSnap> = {}): void {
        const current = this.snap.get();
        this.snap.set({ ...current, ...patch, version: current.version + 1 });
    }

    // ── the log ────────────────────────────────────────────────────────
    attachLog(element: HTMLElement | null): void {
        const { TermForge } = requireEngine();
        const view = this.ensureView();
        this.logEl = element;
        if (element) element.replaceChildren();
        view.sink = element ? new TermForge.sinks.DomSink(element) : null;
        if (element) view.flush();
    }

    private flushLog(): void {
        this.view?.flush();
        if (this.logEl) this.logEl.scrollTop = this.logEl.scrollHeight;
    }

    private append(kind: string, text: string): void {
        this.ensureView().appendLine(kind, text);
    }

    private appendMany(outputs: Line[]): void {
        this.ensureView().appendOutputs(outputs);
    }

    clearLog(): void {
        this.ensureView().clear();
        this.flushLog();
    }

    // ── records ────────────────────────────────────────────────────────
    record(gameId: string) {
        if (!this.records.games[gameId]) this.records.games[gameId] = { best: 0, plays: 0, seen: [] };
        return this.records.games[gameId];
    }

    // ── flow ───────────────────────────────────────────────────────────
    home(): void {
        this.active = null;
        this.ctx = null;
        this.awaitReturn = false;
        this.publish({ phase: "home", gameId: null });
    }

    /** `variant` picks a Command Flash deck or a Vim Catacombs level. */
    start(gameId: string, variant?: string): boolean {
        const gameDef = this.games.find((g) => g.id === gameId);
        const data = this.story.data;
        if (!gameDef || !data) return false;
        const scenario = gameDef.makeScenario({ world: data.world, commands: data.commands, arcade: data.arcade }, this.records, variant);
        // Content bundle missing or malformed: stay on the floor.
        if (!scenario || (gameDef.needsWorld && !scenario.world)) {
            toast("That trial's content failed to load — try another.", "error");
            return false;
        }
        this.active = gameDef;
        this.ctx = {
            ...scenario,
            rt: gameDef.needsWorld && scenario.world ? this.arcade.scopedRuntime(scenario.world) : null,
            moves: 0,
            hints: 0,
            startedAt: Date.now(),
        };
        this.awaitReturn = false;
        this.ensureView().clear();
        this.appendMany(gameDef.intro(this.ctx));
        this.flushLog();
        this.publish({ phase: "trial", gameId: gameDef.id });
        // A modal trial reads keys from the prompt, so the prompt must have them.
        if (gameDef.keystroke) focusPrompt();
        return true;
    }

    execute(line: string): void {
        const raw = String(line ?? "");
        if (raw.trim()) {
            if (this.history[this.history.length - 1] !== raw) this.history.push(raw);
            if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
            this.historyIndex = this.history.length;
        }
        // A finished trial waits for one Enter, then returns to the floor.
        if (this.awaitReturn) {
            this.home();
            return;
        }
        const trimmed = this.arcade.normalizeAnswer(raw).toLowerCase();
        if (!this.active || !this.ctx) {
            const gameDef = this.games.find((g) => g.id === trimmed || g.title.toLowerCase() === trimmed);
            if (gameDef) this.start(gameDef.id);
            else if (trimmed) toast("Pick a trial: click a card, or type its name (pathnav, hunt, pipes, flash, vim).");
            return;
        }
        if (!trimmed) return;
        let word = trimmed;
        if (this.active.keystroke && trimmed.startsWith(":")) {
            const ex = trimmed.slice(1).trim();
            if (EX_QUIT.has(ex)) word = "quit";
            else if (ex === "h" || ex === "help") word = "hint";
            else {
                this.append("error", `E492: Not an editor command: ${ex}`);
                this.flushLog();
                return;
            }
        }
        if (word === "quit" || word === "exit") {
            this.append("dim", "You withdraw from the trial. The arcade remembers nothing.");
            this.flushLog();
            toast("Trial abandoned.");
            this.home();
            return;
        }
        if (word === "hint") {
            this.ctx.hints += 1;
            this.append("magic", `☆ ${this.active.hintFor(this.ctx)}`);
            this.flushLog();
            this.publish();
            return;
        }
        if (this.active.needsWorld && this.arcade.BLOCKED_IN_GAME.has(trimmed.split(" ")[0])) {
            this.append("dim", "That belongs to the story dungeon — finish this trial first (or quit).");
            this.flushLog();
            return;
        }
        this.append("dim", `${this.promptLabel()} ${raw}`);
        this.ctx.moves += 1;
        const result = this.active.input(raw, this.ctx);
        const outputs = result.outputs ?? [];
        this.appendMany(outputs);
        const error = outputs.some((out) => out.kind === "error");
        if (result.done) this.finish(Boolean(result.success));
        this.flushLog();
        this.publish();
        fxBus.publish({ type: "command", line: raw, outputs, events: result.events ?? [], error });
    }

    /** One raw key from the prompt, for a modal trial; true when the trial took it. */
    keystroke(key: string, promptValue: string): boolean {
        if (!this.active?.keystroke || !this.ctx || this.awaitReturn) return false;
        if (promptValue) {
            // A `:` or `/` line is being typed; Escape abandons it, as in vim.
            if (key === "Escape") {
                setPromptValue("");
                return true;
            }
            return false;
        }
        const turn = this.active.keystroke(key, this.ctx);
        if (!turn.consumed) return false;
        const outputs = turn.outputs ?? [];
        this.appendMany(outputs);
        const error = outputs.some((out) => out.kind === "error");
        if (turn.done) this.finish(Boolean(turn.success));
        this.flushLog();
        this.publish();
        fxBus.publish({ type: "key", key, events: turn.events ?? [], error });
        return true;
    }

    private finish(success: boolean): void {
        if (!this.active || !this.ctx) return;
        const { BashcrawlStorage: Storage } = requireEngine();
        const { score, detail } = this.active.scoreFor(this.ctx);
        const rec = this.record(this.active.id);
        rec.plays += 1;
        rec.last = score;
        const isBest = score > (rec.best || 0);
        if (isBest) rec.best = score;
        const scenarioId = this.ctx.scenario?.id;
        if (scenarioId && !rec.seen.includes(scenarioId)) {
            rec.seen.push(scenarioId);
            if (rec.seen.length > 64) rec.seen.splice(0, rec.seen.length - 64);
        }
        if (success && scenarioId) {
            if (!rec.cleared) rec.cleared = [];
            if (!rec.cleared.includes(scenarioId)) rec.cleared.push(scenarioId);
        }
        Storage.saveKey(SCORES_KEY, this.records);
        const xp = Math.max(5, Math.round(score / 5));
        if (success) {
            this.appendMany([
                { kind: "art", text: "  ✦ ✧ ✦  T R I A L   C L E A R  ✦ ✧ ✦" },
                { kind: "success", text: `Score ${score}${isBest ? "  — NEW BEST!" : ""}  (${detail})` },
                { kind: "magic", text: `+${xp} XP flows back to your story hero.` },
                { kind: "dim", text: "Enter returns to the arcade floor." },
            ]);
            this.story.awardXp(xp, this.active.title);
            toast(`+${xp} XP — ${this.active.title}`, "magic");
            fxBus.publish({ type: "celebrate" });
        } else {
            this.appendMany([
                { kind: "info", text: `Trial ended. Score ${score} (${detail}).` },
                { kind: "dim", text: "Enter returns to the arcade floor." },
            ]);
        }
        this.awaitReturn = true;
        this.publish({ phase: "finished" });
    }

    // ── InputTarget ────────────────────────────────────────────────────
    acceptsEmpty(): boolean {
        return true;
    }

    historyStep(direction: -1 | 1): string | null {
        if (!this.history.length) return null;
        this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + direction));
        return this.historyIndex === this.history.length ? "" : this.history[this.historyIndex];
    }

    complete(text: string): string | null {
        const rt = this.ctx?.rt;
        if (!rt) return null;
        const { TermForge } = requireEngine();
        const { value, echo } = TermForge.input.applyCompletion(text, rt.completions(text));
        if (echo) {
            this.append("info", echo);
            this.flushLog();
        }
        return value;
    }

    promptLabel(): string {
        if (!this.active || !this.ctx) return "arcade ▸";
        if (this.active.needsWorld && this.ctx.rt) return `${this.ctx.rt.state.cwd} ⚔`;
        return `${this.active.id} ⚔`;
    }

    placeholder(): string {
        const phase = this.snap.get().phase;
        if (phase === "finished") return "Press Enter to return to the floor";
        if (phase === "trial" && this.active?.keystroke) return "Press vim keys here · :q quits · :help hints · /text searches";
        if (phase === "trial") return "Type a command — hint for a nudge, quit to leave";
        return "Type a trial's name: pathnav · hunt · pipes · flash · vim";
    }

    // ── side-panel models ──────────────────────────────────────────────
    objective(): { title: string; text: string } | null {
        if (!this.active || !this.ctx || this.awaitReturn) return null;
        return { title: this.active.title, text: this.active.objective(this.ctx) };
    }

    stats(): { moves: number; hints: number; seconds: number; keys?: number; par?: number } | null {
        if (!this.active || !this.ctx) return null;
        const base = { moves: this.ctx.moves, hints: this.ctx.hints, seconds: Math.round((Date.now() - this.ctx.startedAt) / 1000) };
        return typeof this.ctx.keys === "number" ? { ...base, keys: this.ctx.keys, par: this.ctx.par } : base;
    }

    cheats(): Array<[string, string]> {
        if (this.active?.cheatsFor && this.ctx && !this.awaitReturn) return this.active.cheatsFor(this.ctx);
        const concepts = this.active && !this.awaitReturn ? this.active.concepts : ["pipes", "grep", "find", "paths"];
        return concepts.map((c) => this.arcade.CHEAT_LINES[c]).filter((row): row is [string, string] => Boolean(row));
    }
}

let singleton: ArcadeStore | null = null;
export function getArcade(story: GameStore = game): ArcadeStore {
    if (!singleton) singleton = new ArcadeStore(story);
    return singleton;
}

export function useArcade<S>(selector: (snap: ArcadeSnap) => S, store: ArcadeStore): S {
    return useStore(store.snap, selector);
}
