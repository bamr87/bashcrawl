// Root of the web trainer: providers, the route → screen switch, the
// app-wide keys (Alt+1–4 doors, `?` help), and the boot of the game store.
import { MotionConfig } from "motion/react";
import { useEffect } from "react";

import { bindUnlock } from "../audio/synth";
import { ErrorBoundary } from "../chrome/ErrorBoundary";
import { ShortcutsHelp } from "../chrome/ShortcutsHelp";
import { SoundToggle } from "../chrome/SoundToggle";
import { ThemeToggle } from "../chrome/ThemeToggle";
import { Toaster } from "../chrome/Toaster";
import { getPrefs, setPrefs, usePrefs } from "../chrome/prefs-store";
import { setUi, toggleHelp } from "../chrome/ui-store";
import { fxBus } from "../engine/fx-bus";
import { game, useGame } from "../engine/game-store";
import { FxCanvas } from "../fx/FxCanvas";
import { ScreenFlash } from "../fx/ScreenFlash";
import { installEffects } from "../fx/effects";
import { HudMenu } from "../hud/HudMenu";
import { StatusStrip } from "../hud/StatusStrip";
import { getArcade } from "../arcade/arcade-store";
import { ArcadeScreen } from "../screens/ArcadeScreen";
import { LearnScreen } from "../screens/LearnScreen";
import { NotFound } from "../screens/NotFound";
import { StoryScreen } from "../screens/StoryScreen";
import { Pager } from "../terminal/Pager";
import { PromptDock } from "../terminal/PromptDock";
import { initTheme } from "../theme/theme-store";
import { AppShell } from "./AppShell";
import { MODES, storyOwnsInput, type Mode } from "./modes";
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

function Booting({ error }: { error: string | null }) {
    return (
        <section className="bc-page bc-frame" aria-live="polite" aria-label="Loading">
            {error ? (
                <>
                    <h1 className="bc-display">The torches would not light</h1>
                    <p>{error}</p>
                </>
            ) : (
                <p className="bc-display">Lighting the torches…</p>
            )}
        </section>
    );
}

export function App() {
    const route = useRoute();
    const prefs = usePrefs();
    const phase = useGame((snap) => snap.phase);
    const bootError = useGame((snap) => snap.error);

    useEffect(() => {
        bindUnlock();
        const off = installEffects();
        void game.boot();
        return off;
    }, []);

    // A door change is a beat too.
    useEffect(() => {
        if (route.kind === "mode") fxBus.publish({ type: "mode", mode: route.mode });
    }, [route]);

    // Escape closes the small-screen panels overlay from anywhere.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setUi({ panelsOpen: false });
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

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
    const ready = phase === "ready";
    const actions = (
        <>
            {ready && storyOwnsInput(mode) && (
                <button type="button" className="bc-btn" onClick={() => setUi({ hudOpen: true })} title="Sidebar panels: show, hide, reorder, dock">HUD</button>
            )}
            <button type="button" className="bc-btn" onClick={() => setUi({ helpOpen: true })} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">?</button>
            <SoundToggle />
            <ThemeToggle />
        </>
    );

    const arcade = ready ? getArcade() : null;
    let screen = null;
    if (route.kind === "notfound") screen = <NotFound path={route.path} />;
    else if (!ready) screen = <Booting error={bootError} />;
    else if (mode === "story") screen = <StoryScreen />;
    else if (mode === "learn") screen = <LearnScreen />;
    else if (mode === "arcade" && arcade) screen = <ArcadeScreen store={arcade} />;
    else if (mode) screen = <Placeholder mode={mode} />;

    const storyChrome = ready && storyOwnsInput(mode);
    const dock = storyChrome ? <PromptDock /> : mode === "arcade" && arcade ? <PromptDock target={arcade} suggestions={false} /> : null;
    const status = ready && mode !== null && mode !== "reference" ? <StatusStrip /> : null;

    return (
        <MotionConfig reducedMotion="user">
            <ErrorBoundary>
                <AppShell mode={mode} actions={actions} status={status} dock={dock}>
                    {screen}
                </AppShell>
                <FxCanvas />
                <ScreenFlash />
                <Toaster />
                <ShortcutsHelp />
                {ready && <Pager />}
                {ready && <HudMenu />}
            </ErrorBoundary>
        </MotionConfig>
    );
}
