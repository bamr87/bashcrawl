// The prompt dock under the stage: suggestion chips over the shared prompt.
import { game, useGame, type GameStore } from "../engine/game-store";
import type { InputTarget } from "./input-target";
import { PromptBar } from "./PromptBar";
import { SuggestionChips } from "./SuggestionChips";

export interface PromptDockProps {
    /** Who owns the prompt right now; the story store by default. */
    target?: InputTarget;
    store?: GameStore;
    suggestions?: boolean;
}

export function PromptDock({ target, store = game, suggestions = true }: PromptDockProps) {
    // Re-render the label and placeholder whenever the game publishes.
    useGame((snap) => snap.version, store);
    const owner = target ?? store;
    return (
        <div className="bc-dock">
            {suggestions && <SuggestionChips store={store} />}
            <PromptBar target={owner} label={owner.promptLabel()} placeholder={owner.placeholder()} />
        </div>
    );
}
