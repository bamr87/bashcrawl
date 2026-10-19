// The prompt dock under the stage: suggestion chips over the shared prompt.
import { useSyncExternalStore } from "react";

import { game, useGame, type GameStore } from "../engine/game-store";
import type { Store } from "../lib/store";
import type { InputTarget } from "./input-target";
import { PromptBar } from "./PromptBar";
import { SuggestionChips } from "./SuggestionChips";

const noop = () => () => {};

// An owner other than the story (the arcade) publishes on its own `snap`.
function useOwnerVersion(owner: InputTarget): number {
    const snap = (owner as unknown as { snap?: Store<{ version: number }> }).snap;
    return useSyncExternalStore(snap ? snap.subscribe : noop, () => (snap ? snap.get().version : 0), () => 0);
}

export interface PromptDockProps {
    /** Who owns the prompt right now; the story store by default. */
    target?: InputTarget;
    store?: GameStore;
    suggestions?: boolean;
}

export function PromptDock({ target, store = game, suggestions = true }: PromptDockProps) {
    // Re-render the label and placeholder whenever the owner publishes.
    useGame((snap) => snap.version, store);
    const owner = target ?? store;
    useOwnerVersion(owner);
    return (
        <div className="bc-dock">
            {suggestions && <SuggestionChips store={store} />}
            <PromptBar target={owner} label={owner.promptLabel()} placeholder={owner.placeholder()} />
        </div>
    );
}
