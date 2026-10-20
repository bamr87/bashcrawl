// What the one shared prompt needs from whoever owns it: the story runtime
// in Story and Learn, the arcade's scoped runtime during a trial.
export interface InputTarget {
    id: string;
    /** Run a line. The prompt has already been cleared. */
    execute(line: string): void;
    /** A chance to answer a line with a screen instead (`journal`, `menu`); true when taken. */
    intercept?(line: string): boolean;
    /**
     * A raw key, before the prompt handles it: a modal trial (the Vim
     * Catacombs) reads keys as they are pressed. The prompt's current text
     * comes along so a `:` or `/` line being typed is left alone. True when
     * the key was consumed.
     */
    keystroke?(key: string, promptValue: string): boolean;
    /** Whether an empty Enter means something (the arcade uses it to return home). */
    acceptsEmpty(): boolean;
    /** ↑ (-1) / ↓ (+1) through history; null when there is none. */
    historyStep(direction: -1 | 1): string | null;
    /** Tab: the completed text, or null (a multi-candidate list is echoed by the owner). */
    complete(text: string): string | null;
    /** Ctrl+L. */
    clearLog(): void;
    promptLabel(): string;
    placeholder(): string;
}
