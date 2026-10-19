// Root of the web trainer: providers, the route → screen switch, and the
// app-wide keys (Alt+1–4 doors, `?` help). Screens arrive door by door;
// until then a door shows its placeholder.
import { MotionConfig } from "motion/react";
import { useEffect } from "react";

import { ErrorBoundary } from "../chrome/ErrorBoundary";
import { ShortcutsHelp } from "../chrome/ShortcutsHelp";
import { ThemeToggle } from "../chrome/ThemeToggle";
import { Toaster } from "../chrome/Toaster";
import { getPrefs, setPrefs, usePrefs } from "../chrome/prefs-store";
import { setUi, toggleHelp } from "../chrome/ui-store";
import { NotFound } from "../screens/NotFound";
import { initTheme } from "../theme/theme-store";
import { AppShell } from "./AppShell";
import { MODES, type Mode } from "./modes";
import { navigate, useRoute } from "./useHashRoute";

initTheme();

function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
}

function Placeholder({ mode }: { mode: Mode }) {
    return (
        <section className="bc-page" aria-label={`${mode} door`}>
            <p>The {mode} door is being carved.</p>
        </section>
    );
}

export function App() {
    const route = useRoute();
    const prefs = usePrefs();

    // No hash: open the last door, or the entrance.
    useEffect(() => {
        if (route.kind === "none") navigate(getPrefs().mode ?? "story");
    }, [route]);

    // Remember the door for next time.
    useEffect(() => {
        if (route.kind === "mode" && prefs.mode !== route.mode) setPrefs({ mode: route.mode });
    }, [route, prefs.mode]);

    // Alt+1–4 switch doors (the physical key, since macOS types a symbol for
    // Alt+digit); `?` outside an input opens the shortcuts list.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey && !event.ctrlKey && !event.metaKey) {
                const digit = /^Digit[1-4]$/.test(event.code) ? Number(event.code.slice(5)) : Number(event.key);
                if (digit >= 1 && digit <= MODES.length) {
                    event.preventDefault();
                    navigate(MODES[digit - 1]);
                }
                return;
            }
            if (event.key === "?" && !event.ctrlKey && !event.metaKey && !isTypingTarget(event.target)) {
                event.preventDefault();
                toggleHelp();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const mode: Mode | null = route.kind === "mode" ? route.mode : null;
    const actions = (
        <>
            <button type="button" className="bc-btn" onClick={() => setUi({ helpOpen: true })} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">?</button>
            <ThemeToggle />
        </>
    );

    return (
        <MotionConfig reducedMotion="user">
            <ErrorBoundary>
                <AppShell mode={mode} actions={actions}>
                    {route.kind === "notfound" ? <NotFound path={route.path} /> : mode ? <Placeholder mode={mode} /> : null}
                </AppShell>
                <Toaster />
                <ShortcutsHelp />
            </ErrorBoundary>
        </MotionConfig>
    );
}
