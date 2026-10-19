// The frame every door shares (UPS-FE-10/11): skip link, header with brand,
// mode tabs and settings, exactly one <main id="main-content">, a footer of
// hints. `status` and `dock` are slots the story fills (status strip above
// the stage, the prompt dock below it). #stage is the screen-shake target.
import type { ReactNode } from "react";

import { ModeTabs } from "../chrome/ModeTabs";
import { openOverlay } from "../chrome/ui-store";
import { MODE_META, type Mode } from "./modes";

export interface AppShellProps {
    mode: Mode | null;
    actions?: ReactNode;
    status?: ReactNode;
    dock?: ReactNode;
    hint?: string;
    children: ReactNode;
}

export function AppShell({ mode, actions, status, dock, hint, children }: AppShellProps) {
    const footerHint = hint ?? (mode ? MODE_META[mode].hint : "");
    return (
        <div className="bc-shell">
            <a className="bc-skip" href="#main-content">Skip to the game</a>
            <header className="bc-header">
                <button type="button" className="bc-brand bc-display" onClick={() => openOverlay("title")} title="Title screen" aria-label="Bashcrawl: title screen">
                    <span aria-hidden="true">⚔</span>
                    <strong>Bashcrawl</strong>
                    <span className="bc-brand-sub">Terminal Dungeon</span>
                </button>
                <ModeTabs mode={mode} />
                <div className="bc-actions" role="group" aria-label="Settings">
                    {actions}
                </div>
            </header>
            <div className="bc-status-slot">{status}</div>
            <main id="main-content" className="bc-main" tabIndex={-1}>
                <div id="stage" className="bc-stage">{children}</div>
            </main>
            <div className="bc-dock-slot">{dock}</div>
            <footer className="bc-footer">
                <span className="bc-footer-hint">{footerHint}</span>
                <a href="https://github.com/bamr87/bashcrawl" target="_blank" rel="noopener noreferrer">github.com/bamr87/bashcrawl</a>
            </footer>
        </div>
    );
}
