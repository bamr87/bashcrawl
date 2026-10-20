// Types for the game ENGINE the React app drives: the vendored TermForge
// core, the bashcrawl runtime, the HUD presenter and the helpers, all of
// which index.html loads as classic scripts onto window before this app
// runs. These describe only the surface the UI uses; the engine itself is
// plain JavaScript (web/assets/js, termforge/core) shared with the node
// hosts and is not compiled by Vite.

// ── terminal protocol ─────────────────────────────────────────────────────
export type LineKind = "output" | "error" | "success" | "info" | "dim" | "magic" | "art" | "banner" | "control";

export interface Line {
    kind: LineKind | string;
    text: string;
    /** Control records only: clear | reset | levelup | page. */
    action?: string;
}

// ── HUD presenter events (Hud.diffEvents) ─────────────────────────────────
export type HudEventType =
    | "quest" | "damage" | "heal" | "xp" | "item" | "levelup"
    | "move" | "unlock" | "lesson" | "objective" | "skill";

export interface HudEvent {
    type: HudEventType;
    text: string;
    amount?: number;
    items?: string[];
    from?: string;
    to?: string;
    skills?: string[];
}

export interface HudSnapshot {
    xp: number;
    hp: number;
    completed: number;
    currentQuestId: number;
    inventory: string[];
    achievements: number;
    rankIndex: number;
    rankTitle: string;
    cwd: string;
    reveals: number;
    lessonsDone: number;
    objectivesMet: number;
    skillLevels: Record<string, number>;
}

// ── world and content ─────────────────────────────────────────────────────
export type EntryType = "dir" | "file" | "exec";

export interface Entry {
    name: string;
    type: EntryType;
    hidden?: boolean;
}

export interface EssentialCommand {
    command: string;
    description?: string;
}

export interface RoomMeta {
    slug?: string;
    title?: string;
    emoji?: string;
    hint?: string;
    description?: string;
    teaches?: string[];
    hidden?: boolean;
    next_steps?: string;
    essential_commands?: Array<EssentialCommand | string>;
}

export interface World {
    root: string;
    directories: Record<string, Entry[]>;
    files: Record<string, string>;
    rooms: Record<string, RoomMeta>;
    encounters: Record<string, unknown>;
}

export interface QuestCompletion {
    command: string;
    location: string | null;
    args: string | null;
    args_file: string | null;
    item_check: string | null;
}

export interface Quest {
    id: number;
    title: string;
    description: string;
    objective: string;
    hint: string;
    required_commands?: string[];
    completion?: QuestCompletion;
    reward?: string;
    reward_name?: string;
    xp: number;
}

export interface Rank {
    min: number;
    title: string;
}

export interface Achievement {
    id: string;
    icon: string;
    title: string;
    desc: string;
    xp: number;
}

export interface SkillGroup {
    group: string;
    commands: string[];
}

export interface Catalog {
    ranks: Rank[];
    achievements: Achievement[];
    bestiary: Array<{ key: string; name: string; blurb: string }>;
    trials: unknown[];
    skills: SkillGroup[];
    cards: unknown[];
}

export interface LessonObjective {
    text: string;
    solution?: string;
}

export interface Lesson {
    id: string;
    title: string;
    body: string;
    teaches?: string[];
    objectives: LessonObjective[];
}

export interface Course {
    id: string;
    title: string;
    summary?: string;
    level: string;
    skills?: string[];
    requires?: string[];
    lessons: Lesson[];
}

export interface CommandRow {
    command: string;
    description: string;
}

export interface CommandCategory {
    title?: string;
    commands: CommandRow[];
}

export interface QuickRefSheet {
    title?: string;
    sections: Array<{ title?: string; items: Array<{ cmd: string; desc: string }> }>;
}

export interface CommandsData {
    categories: Record<string, CommandCategory>;
    quick_ref: Record<string, QuickRefSheet>;
    runtime?: unknown[];
}

export interface DocsData {
    quick_start: string[];
    commands: { categories: Record<string, CommandCategory> };
    rooms: Record<string, RoomMeta>;
    quests: unknown;
    glossary: Array<{ term: string; definition: string }>;
}

export interface FlashCard {
    q: string;
    a: string[];
    why?: string;
}

export interface FlashDeck {
    id: string;
    title: string;
    concept?: string;
    cards: FlashCard[];
}

export interface ArcadeData {
    pipe_puzzles: unknown[];
    hunt_scenarios: unknown[];
    flash_decks: FlashDeck[];
    vim_levels: VimLevel[];
}

/** One Vim Catacombs level (arcade.yaml `vim_levels`): the buffer is the map. */
export interface VimLevel {
    id: string;
    title: string;
    brief: string;
    hint: string;
    /** The keys this level teaches; its spellbook is every level's keys up to its own. */
    keys: string[];
    lines: string[];
    cursor?: [number, number];
    /** An exact buffer to produce (edit levels); gem levels have none. */
    target?: string[];
    par: number;
    solution: string[];
}

/** The seven generated bundles under web/data. */
export interface GameData {
    world: World;
    quests: { quests: Quest[] };
    progression: unknown;
    courses: { courses: Course[] } | Course[];
    commands: CommandsData;
    docs: DocsData;
    arcade: ArcadeData;
}

export type RuntimeData = Pick<GameData, "world" | "quests" | "commands"> & Partial<Pick<GameData, "progression" | "courses">>;

// ── runtime ───────────────────────────────────────────────────────────────
export interface DailyState {
    date: string | null;
    baselineXp: number;
    goal: number;
    completed: boolean;
    streak: number;
    lastDate: string | null;
}

export interface LearnState {
    active: string | null;
    progress: Record<string, { lesson?: number; met?: number[]; done?: string[]; complete?: boolean }>;
    completed: string[];
}

export interface RuntimeState {
    cwd: string;
    prevCwd: string | null;
    hp: number;
    xp: number;
    inventory: string[];
    aliases: Record<string, string>;
    envVars: Record<string, string>;
    userNodes: Record<string, unknown>;
    completedQuestIds: number[];
    currentQuestId: number;
    visited: string[];
    history: string[];
    historyIndex: number;
    flags: Record<string, unknown>;
    reveals: Record<string, string>;
    trainer: { active?: boolean } | null;
    pathfind: { active?: boolean; target?: string; targetTitle?: string; moves?: number } | null;
    speedrunBest: number | null;
    achievements: string[];
    bestiary: string[];
    daily: DailyState;
    rankIndex: number;
    stats: Record<string, unknown>;
    learn: LearnState;
    mastery: Record<string, unknown>;
}

export interface Persistence {
    description: string;
    save(state: RuntimeState): boolean;
}

export interface Capabilities {
    surface: string;
    pager: boolean;
    compactEvents: boolean;
}

export interface EventBus {
    on(type: string, handler: (event: Record<string, unknown>) => void): () => void;
    once(type: string, handler: (event: Record<string, unknown>) => void): () => void;
    emit(type: string, payload?: Record<string, unknown>): unknown;
}

/** An ASCII Motion clip is opaque to the UI; the engine parses and plays it. */
export type AsciiClip = object;

export interface AsciiLibrary {
    get(name: string): AsciiClip | null;
    has(name: string): boolean;
}

export interface Runtime {
    state: RuntimeState;
    quests: Quest[];
    courses: Course[];
    catalog: Catalog;
    world: World;
    handlers: Record<string, unknown>;
    events: EventBus;
    capabilities: Partial<Capabilities>;
    persistence: Persistence | null;
    execute(line: string): Line[];
    promptLabel(): string;
    completions(text: string): string[];
    art(name: string, index?: number): string;
    artLibrary(): AsciiLibrary | null;
    currentRoomMeta(): RoomMeta;
    entries(path: string, showHidden?: boolean): Entry[];
    isDir(path: string): boolean;
    basename(path: string): string;
    resolve(path: string, cwd?: string): string;
    actual(path: string): string;
    awardXp(amount: number, reason?: string): void;
    rankFor(xp: number): Rank;
    trainerChallenge(): Line[];
    revealRoom(name: string): Line | null;
}

export interface RuntimeModule {
    Runtime: new (data: RuntimeData, state?: RuntimeState, options?: { bare?: boolean }) => Runtime;
    defaultState(root: string): RuntimeState;
    loadState(world: World, parsed: unknown, progression?: unknown): RuntimeState;
    lineLimit(line: string): number;
    commandLabel(line: string): string;
    GAME_PLUGINS: readonly string[];
}

// ── TermForge core ────────────────────────────────────────────────────────
export interface Sink {
    render?(lines: Line[]): void;
    write?(lines: Line[]): void;
    clear?(): void;
}

export interface TerminalView {
    sink: Sink | null;
    cap: number;
    lines: Line[];
    onControl: (action: string, record: Line) => boolean | void;
    appendLine(kind: string, text: string): void;
    appendOutputs(outputs: Line[]): void;
    clear(): void;
    flush(): void;
}

export interface SessionSpec {
    readonly runtime: Runtime;
    maxLine?: number | ((line: string) => number);
    commandLabel?: (line: string) => string;
    handleLine?: (line: string) => Line[];
    onControl?: (action: string, record: Line) => void;
}

export interface SessionOptions {
    view: TerminalView;
    persistence?: Persistence | null;
    capabilities?: Capabilities;
    onState?: (state: RuntimeState) => void;
    onPage?: (text: string) => void;
}

export interface SessionController {
    view: TerminalView;
    execute(line: string, options?: { echo?: boolean }): Line[];
    persist(): void;
}

export interface AsciiFrame {
    text: string;
    cells?: unknown;
}

export interface TermForgeGlobal {
    view: {
        TerminalView: new (options: { sink?: Sink | null; cap?: number; onControl?: (action: string, record: Line) => boolean | void }) => TerminalView;
    };
    sinks: {
        DomSink: new (element: HTMLElement) => Sink;
        escapeHtml(value: unknown): string;
    };
    session: {
        SessionController: new (session: SessionSpec, options: SessionOptions) => SessionController;
    };
    input: {
        historyStep(state: RuntimeState, direction: number): string | null;
        applyCompletion(text: string, candidates: string[]): { value: string | null; echo: string | null };
    };
    asciiMotion: {
        parse(source: unknown): AsciiClip;
        renderFrame(clip: AsciiClip, index: number): AsciiFrame;
        Library: new (sources: Record<string, unknown>, options?: { aliases?: Record<string, string> }) => AsciiLibrary;
    };
}

// ── HUD presenter (web/assets/js/hud.js) ──────────────────────────────────
export interface StatusModel {
    rank: string;
    rankIndex: number;
    xp: number;
    level: number;
    nextRank: { title: string; min: number; remaining: number } | null;
    pct: number;
    hp: number;
    hpMax: number;
    questsDone: number;
    questsTotal: number;
    streak: number;
    dailyDone: boolean;
    badges: number;
    badgeTotal: number;
    cwd: string;
}

export interface Suggestion {
    cmd: string;
    why: string;
    kind: "quest" | "room" | "lesson";
}

export interface QuestModel {
    current: { title: string; objective: string } | null;
    mainDone: number;
    mainTotal: number;
    rows: Array<{ status: "done" | "active" | "locked"; icon: string; title: string }>;
    side: Array<{ key: string; name: string; hint: string; done: boolean; icon: string }>;
    sideDone: number;
    xp: number;
}

export interface InventoryModel {
    hp: number;
    hpMax: number;
    hpBar: string;
    items: string[];
}

export interface HeroModel {
    rank: string;
    xp: number;
    level: number;
    into: number;
    span: number;
    xpBar: string;
    badges: number;
    badgeTotal: number;
}

export interface RoomModel {
    title: string;
    path: string;
    vignette: { key: string; art: string[] };
    entries: Array<{ name: string; type: EntryType; icon: string; marker: string }>;
    teaches: string[];
    next_steps: string;
}

export interface MapModel {
    rows: Array<{ prefix: string; path: string; name: string; here: boolean; seen: boolean }>;
    explored: number;
}

export interface LessonModel {
    active: boolean;
    courses: number;
    completed: number;
    courseId?: string;
    course?: string;
    n?: number;
    total?: number;
    title?: string;
    complete?: boolean;
    lab?: string;
    objectives?: Array<{ text: string; met: boolean }>;
    met?: number;
    lessonsDone?: number;
}

export interface SkillsModel {
    levelsByName: Record<string, number>;
    total: number;
    practised: number;
    due: number;
    levels: number;
    top: Array<{ name: string; level: number; due: boolean }>;
}

export interface HudPane {
    id: string;
    visible: boolean;
    collapsed: boolean;
}

export interface HudLayout {
    version: number;
    dock: "left" | "right";
    sidebar: boolean;
    width: number;
    panes: HudPane[];
}

export type HudAction =
    | { op: "reset" }
    | { op: "dock"; side: "left" | "right" }
    | { op: "toggle"; id: string; field?: "visible" | "collapsed"; value?: boolean }
    | { op: "move"; id: string; dir: -1 | 1 };

export interface HudModels {
    statusModel: StatusModel;
    suggestionsModel: Suggestion[];
    questModel: QuestModel;
    inventoryModel: InventoryModel;
    heroModel: HeroModel;
    roomModel: RoomModel;
    mapModel: MapModel;
    lessonModel: LessonModel;
    skillsModel: SkillsModel;
}

export type HudModelName = keyof HudModels;

export type HudModule = {
    [K in HudModelName]: (runtime: Runtime) => HudModels[K];
} & {
    LAYOUT_KEY: string;
    PANE_DEFS: Array<{ id: string; title: string; surfaces: string[] }>;
    SIDE_QUESTS: Array<{ key: string; name: string; hint: string }>;
    VIGNETTE_KEYS: readonly string[];
    attachStore(store: { load(): unknown; save(value: HudLayout): void }, defaults: { dock?: "left" | "right"; order?: string[]; collapsed?: string[] }): HudLayout;
    getLayout(): HudLayout;
    applyAction(action: HudAction): { layout: HudLayout; message: string };
    snapshot(runtime: Runtime): HudSnapshot;
    diffEvents(prev: HudSnapshot, next: HudSnapshot): HudEvent[];
    ensureVisited(runtime: Runtime): void;
    bar(value: number, max: number, width?: number): string;
    rankFor(xp: number, ranks: Rank[]): Rank;
    levelFor(xp: number): { level: number; into: number; span: number };
};

// ── helpers ───────────────────────────────────────────────────────────────
export interface StorageModule {
    KEY: string;
    lastError: string;
    load(defaults: () => RuntimeState): RuntimeState;
    save(state: RuntimeState): boolean;
    clear(): boolean;
    backup(): boolean;
    loadKey<T>(key: string, fallback: T): T;
    saveKey(key: string, value: unknown): void;
}

export interface LearnModule {
    renderMarkdown(markdown: string): string;
    inlineHtml(text: string): string;
}

export interface FxSpec {
    cmd: string;
    flags: string[];
    motion: string;
    flagMotions: string[];
    accent: string;
    piped: boolean;
    redirect: string;
    exec: boolean;
    family: string;
    known: boolean;
    hue: number;
    key?: string;
}

export interface CommandFxApplyOptions {
    log?: HTMLElement | null;
    root?: HTMLElement | null;
    form?: HTMLElement | null;
    prompt?: HTMLElement | null;
    error?: boolean;
    events?: HudEvent[];
}

export interface CommandFxModule {
    describe(line: string): FxSpec;
    motionFor(line: string, options?: { error?: boolean; events?: HudEvent[] }): FxSpec;
    apply(line: string, options: CommandFxApplyOptions): FxSpec;
    playClip(host: HTMLElement, motionOrClip: string | AsciiClip, options?: { speed?: number; looping?: boolean }): AsciiClip | null;
    clearStage(host: HTMLElement): void;
    stageMotions(): string[];
    library(): AsciiLibrary | null;
    commands: Record<string, { family: string; motion: string; accent: string }>;
}

export interface AmbientModule {
    INHERIT: string;
    play(node: HTMLElement, source: unknown, options?: { loop?: boolean; speed?: number; onDone?: () => void }): AsciiClip | null;
    loop(node: HTMLElement, source: unknown, options?: { speed?: number }): AsciiClip | null;
    once(node: HTMLElement, source: unknown, options?: { speed?: number; onDone?: () => void }): AsciiClip | null;
    stop(node: HTMLElement): void;
    isPlaying(node: HTMLElement): boolean;
}

// ── the vim engine (web/assets/js/vim.js) ───────────────────────────────
export interface VimBuffer {
    lines: string[];
    row: number;
    col: number;
    want: number;
    mode: "normal" | "insert";
    /** The keys of the command being typed (`2`, `d` …). */
    pending: string[];
    register: { text: string[]; linewise: boolean } | null;
    undo: Array<{ lines: string[]; row: number; col: number }>;
    lastFind: { ch: string; kind: string } | null;
    lastSearch: { pattern: string; backward: boolean } | null;
    changes: number;
}

export interface VimFeedResult {
    /** false: not the editor's key — the host may use it. */
    consumed: boolean;
    applied: boolean;
    kind: string | null;
    command: string | null;
    pending: string;
    error: { code: "locked" | "unknown" | "fail"; key: string; message: string } | null;
}

export interface VimModule {
    createState(lines: string[], options?: { row?: number; col?: number }): VimBuffer;
    feed(state: VimBuffer, key: string, options?: { allowed?: string[] | Set<string> | null }): VimFeedResult;
    search(state: VimBuffer, pattern: string, backward?: boolean): { found: boolean; wrapped: boolean };
    toKeys(text: string): string[];
    keyLabel(key: string): string;
}

// ── the Practice Arcade's games (web/assets/js/arcade.js GAMES) ──────────
export interface ArcadeScenario {
    world?: World;
    scenario?: { id?: string; [key: string]: unknown };
    [key: string]: unknown;
}

export interface ArcadeContext extends ArcadeScenario {
    rt: Runtime | null;
    moves: number;
    hints: number;
    startedAt: number;
    // The Vim Catacombs trial's state (arcade.js VimCatacombs), read by VimStage.
    vim?: VimBuffer;
    level?: VimLevel;
    index?: number;
    levelCount?: number;
    allowed?: string[];
    total?: number;
    taken?: number;
    hp?: number;
    traps?: number;
    keys?: number;
    par?: number;
}

export interface ArcadeTurn {
    outputs: Line[];
    done: boolean;
    success?: boolean;
    /** HUD-shaped events for the effects layer (a gem taken, a spike sprung). */
    events?: HudEvent[];
}

export interface ArcadeKeyTurn extends ArcadeTurn {
    /** false: the key was not the trial's — the prompt handles it as usual. */
    consumed: boolean;
}

export interface ArcadeGame {
    id: string;
    title: string;
    icon: string;
    tagline: string;
    concepts: string[];
    needsWorld: boolean;
    /** `variant` picks a Command Flash deck or a Vim Catacombs level. */
    makeScenario(data: { world: World; commands: CommandsData; arcade: ArcadeData }, persist: ArcadeRecords, variant?: string): ArcadeScenario | null;
    intro(ctx: ArcadeContext): Line[];
    objective(ctx: ArcadeContext): string;
    hintFor(ctx: ArcadeContext): string;
    input(line: string, ctx: ArcadeContext): ArcadeTurn;
    scoreFor(ctx: ArcadeContext): { score: number; detail: string };
    /** A modal trial reads raw keys as they are pressed (the Vim Catacombs). */
    keystroke?(key: string, ctx: ArcadeContext): ArcadeKeyTurn;
    /** Level-specific cheats for the side panel, instead of the concept lines. */
    cheatsFor?(ctx: ArcadeContext): Array<[string, string]>;
}

export interface ArcadeRecord {
    best: number;
    plays: number;
    seen: string[];
    last?: number;
    /** Scenarios won, not merely played (the Vim Catacombs picks the next one). */
    cleared?: string[];
}

export interface ArcadeRecords {
    games: Record<string, ArcadeRecord>;
}

export interface ArcadeModule {
    GAMES: ArcadeGame[];
    CHEAT_LINES: Record<string, [string, string]>;
    BLOCKED_IN_GAME: Set<string>;
    normalizeAnswer(line: string): string;
    scopedRuntime(world: World): Runtime;
}
