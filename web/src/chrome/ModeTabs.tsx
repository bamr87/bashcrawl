// The four doors as a tablist. Click or Enter switches; Left/Right move
// between tabs; Alt+1–4 is handled app-wide in App.tsx.
import type { KeyboardEvent } from "react";

import { MODES, MODE_META, type Mode } from "../app/modes";
import { navigate } from "../app/useHashRoute";

export function ModeTabs({ mode }: { mode: Mode | null }) {
    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const next = MODES[(index + delta + MODES.length) % MODES.length];
        navigate(next);
        const list = event.currentTarget.parentElement;
        const button = list?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`);
        button?.focus();
    }
    return (
        <nav className="bc-modes" aria-label="Game modes">
            <div role="tablist">
                {MODES.map((id, index) => {
                    const meta = MODE_META[id];
                    const selected = id === mode;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            className="bc-tab"
                            data-mode={id}
                            aria-selected={selected}
                            tabIndex={selected || (mode === null && index === 0) ? 0 : -1}
                            title={`${meta.title} (Alt+${index + 1})`}
                            onClick={() => navigate(id)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                        >
                            <span aria-hidden="true">{meta.icon}</span>
                            <span className="bc-tab-text">{meta.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
