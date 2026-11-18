// The frame every door shares (UPS-FE-10/11): skip link, header with brand,
// mode tabs and settings, exactly one <main id="main-content">, a footer of
// hints. `status` and `dock` are slots the story fills (status strip above
// the stage, the prompt dock below it). #stage is the screen-shake target.
import { useLayoutEffect, useRef, type ReactNode } from "react";

import { ModeTabs } from "../chrome/ModeTabs";
import { openOverlay } from "../chrome/ui-store";
import { MODE_META, type Mode } from "./modes";

/** On <html>: how tall the shell's bottom edge (the prompt dock + the footer) is right now. */
export const BOTTOM_CHROME_VAR = "--bc-bottom-chrome";

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
    const dockRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLElement>(null);

    // Publish the dock + footer height for what floats above them from outside
    // the shell (the feedback button, mounted beside the error boundary). The
    // dock grows with the inline hint and is gone in the Reference door, so
    // it is measured, not assumed.
    useLayoutEffect(() => {
        const root = document.documentElement;
        const parts = [dockRef.current, footerRef.current].filter((el): el is HTMLElement => el !== null);
        const publish = () => {
            const height = parts.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
            root.style.setProperty(BOTTOM_CHROME_VAR, `${Math.ceil(height)}px`);
        };
        publish();
        const observer = typeof ResizeObserver === "function" ? new ResizeObserver(publish) : null;
        for (const el of parts) observer?.observe(el, { box: "border-box" });
        return () => {
            observer?.disconnect();
            root.style.removeProperty(BOTTOM_CHROME_VAR);
        };
    }, []);

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
            <div ref={dockRef} className="bc-dock-slot">{dock}</div>
            <footer ref={footerRef} className="bc-footer">
                <span className="bc-footer-hint">{footerHint}</span>
                <a href="https://github.com/bamr87/bashcrawl" target="_blank" rel="noopener noreferrer">github.com/bamr87/bashcrawl</a>
            </footer>
        </div>
    );
}
