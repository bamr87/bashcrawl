// What a chip does: run a command as if typed, drop one into the prompt, or
// open another door. Used by the HUD panels, the lesson reader (through a
// delegated handler over its rendered HTML) and the reference's ▶ buttons.
// On a small screen the sidebar is an overlay, so acting on a chip there
// closes it.
import type { MouseEvent } from "react";

import { isMode, type Mode } from "../app/modes";
import { navigate } from "../app/useHashRoute";
import { setUi } from "../chrome/ui-store";
import { game, type GameStore } from "../engine/game-store";
import { fillPrompt, focusPrompt } from "./prompt-store";

export function runCommand(command: string, store: GameStore = game): void {
    store.execute(command);
    focusPrompt();
    setUi({ panelsOpen: false });
}

export function fillCommand(command: string): void {
    fillPrompt(command);
    setUi({ panelsOpen: false });
}

export function gotoMode(mode: Mode): void {
    navigate(mode);
    setUi({ panelsOpen: false });
}

/** Delegated handler for rendered HTML carrying data-run / data-fill / data-goto. */
export function handleChipClick(event: MouseEvent<HTMLElement>, store: GameStore = game): boolean {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-run],[data-fill],[data-goto]");
    if (!target) return false;
    event.preventDefault();
    const goto = target.dataset.goto;
    if (goto && isMode(goto)) {
        gotoMode(goto);
    } else if (target.dataset.run != null) {
        runCommand(target.dataset.run, store);
    } else {
        fillCommand(target.dataset.fill ?? "");
    }
    return true;
}
