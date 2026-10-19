// What the one shared prompt needs from whoever owns it: the story runtime
// in Story and Learn, the arcade's scoped runtime during a trial.
export interface InputTarget {
    id: string;
    /** Run a line. The prompt has already been cleared. */
    execute(line: string): void;
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
