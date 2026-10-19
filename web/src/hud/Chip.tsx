// A command chip in a panel: `run` types and runs it, `fill` drops it into
// the prompt, `goto` opens a door.
import type { ReactNode } from "react";

import type { Mode } from "../app/modes";
import { game, type GameStore } from "../engine/game-store";
import { fillCommand, gotoMode, runCommand } from "../terminal/actions";

export interface ChipProps {
    run?: string;
    fill?: string;
    goto?: Mode;
    primary?: boolean;
    title?: string;
    store?: GameStore;
    children: ReactNode;
}

export function Chip({ run, fill, goto, primary, title, store = game, children }: ChipProps) {
    function onClick() {
        if (goto) gotoMode(goto);
        else if (run != null) runCommand(run, store);
        else fillCommand(fill ?? "");
    }
    return (
        <button
            type="button"
            className={`bc-chip bc-chip-panel${primary ? " bc-chip-primary" : ""}`}
            title={title ?? (run != null ? `Run: ${run}` : fill != null ? `Put in the prompt: ${fill}` : undefined)}
            data-run={run}
            data-fill={fill}
            data-goto={goto}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
