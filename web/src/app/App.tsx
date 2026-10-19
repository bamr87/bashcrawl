// Root of the web trainer: providers, the route → screen switch, the
// app-wide keys (Alt+1–4 doors, `?` help, Escape), the boot of the game
// store, and the game's own screens over it — title, hero creation, the
// intro, the tour, options, the profile, the title cards.
import { MotionConfig } from "motion/react";
import { useEffect } from "react";

import { getArcade } from "../arcade/arcade-store";
import { bindUnlock } from "../audio/synth";
import { DocsDrawer } from "../chrome/DocsDrawer";
import { ErrorBoundary } from "../chrome/ErrorBoundary";
import { Intro } from "../chrome/Intro";
import { OptionsDialog } from "../chrome/OptionsDialog";
import { ShortcutsHelp } from "../chrome/ShortcutsHelp";
import { SoundToggle } from "../chrome/SoundToggle";
import { TitleScreen } from "../chrome/TitleScreen";
import { Toaster } from "../chrome/Toaster";
import { Tour } from "../chrome/Tour";
import { initCrt } from "../chrome/crt-store";
import { getPrefs, setPrefs, usePrefs } from "../chrome/prefs-store";
import { initSettings } from "../chrome/settings-store";
import { openOverlay, setUi, startTour, toggleHelp, useUi } from "../chrome/ui-store";
import { fxBus } from "../engine/fx-bus";
import { game, useGame } from "../engine/game-store";
import { Banners } from "../fx/Banners";
import { FxCanvas } from "../fx/FxCanvas";
import { ScreenFlash } from "../fx/ScreenFlash";
import { installEffects } from "../fx/effects";
import { CreateHero } from "../hero/CreateHero";
import { HeroButton } from "../hero/HeroButton";
import { ProfileDialog } from "../hero/ProfileDialog";
import { useHero } from "../hero/hero-store";
import { HudMenu } from "../hud/HudMenu";
import { StatusStrip } from "../hud/StatusStrip";
import { ArcadeScreen } from "../screens/ArcadeScreen";
import { LearnScreen } from "../screens/LearnScreen";
import { NotFound } from "../screens/NotFound";
import { ReferenceScreen } from "../screens/ReferenceScreen";
import { StoryScreen } from "../screens/StoryScreen";
import { Pager } from "../terminal/Pager";
import { PromptDock } from "../terminal/PromptDock";
import { initTheme } from "../theme/theme-store";
import { AppShell } from "./AppShell";
import { MODES, storyOwnsInput, type Mode } from "./modes";
import { navigate, useRoute } from "./useHashRoute";

initTheme();
initCrt();
initSettings();

function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
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
    const hero = useHero();
    const { overlay, tour } = useUi();
    const phase = useGame((snap) => snap.phase);
    const bootError = useGame((snap) => snap.error);

    useEffect(() => {
        bindUnlock();
        const off = installEffects();
        void game.boot();
        return off;
    }, []);

    // No hash: open the last door, or the entrance.
    useEffect(() => {
        if (route.kind === "none") navigate(getPrefs().mode ?? "story");
    }, [route]);

    // Remember the door for next time; a door change is a beat too.
    useEffect(() => {
        if (route.kind !== "mode") return;
        if (prefs.mode !== route.mode) setPrefs({ mode: route.mode });
        fxBus.publish({ type: "mode", mode: route.mode });
    }, [route, prefs.mode]);

    const mode: Mode | null = route.kind === "mode" ? route.mode : null;
    const ready = phase === "ready";

    // A hero who has not taken the tour gets it the first time the Story
    // door is open with nothing else in the way (the Rogue starts in the
    // Arcade and meets it later).
    useEffect(() => {
        if (!ready || mode !== "story" || !hero || hero.tourDone || overlay !== null || tour !== null || !prefs.onboarded) return;
        startTour();
    }, [ready, mode, hero, overlay, tour, prefs.onboarded]);

    // Alt+1–4 switch doors (the physical key, since macOS types a symbol for
    // Alt+digit); `?` outside an input opens the shortcuts; F1 the docs;
    // Escape closes the small-screen panels overlay.
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
            if (event.key === "F1") {
                event.preventDefault();
                setUi({ docsOpen: !document.querySelector(".bc-docs") });
            } else if (event.key === "?" && !event.ctrlKey && !event.metaKey && !isTypingTarget(event.target)) {
                event.preventDefault();
                toggleHelp();
            } else if (event.key === "Escape") {
                setUi({ panelsOpen: false });
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const arcade = ready ? getArcade() : null;
    const storyChrome = ready && storyOwnsInput(mode);

    const actions = (
        <>
            {ready && <HeroButton />}
            {storyChrome && (
                <button type="button" className="bc-btn" onClick={() => setUi({ hudOpen: true })} title="Sidebar panels: show, hide, reorder, dock">HUD</button>
            )}
            {ready && mode !== "reference" && (
                <button type="button" className="bc-btn" onClick={() => setUi({ docsOpen: true })} title="Documentation drawer (F1)" aria-label="Documentation">Docs</button>
            )}
            <button type="button" className="bc-btn" onClick={() => setUi({ helpOpen: true })} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">?</button>
            <SoundToggle />
            <button type="button" className="bc-btn" onClick={() => openOverlay("options")} title="Options: theme, sound, effects, text" aria-label="Options">
                <span aria-hidden="true">⚙</span>
            </button>
        </>
    );

    let screen = null;
    if (route.kind === "notfound") screen = <NotFound path={route.path} />;
    else if (!ready) screen = <Booting error={bootError} />;
    else if (mode === "story") screen = <StoryScreen />;
    else if (mode === "learn") screen = <LearnScreen />;
    else if (mode === "arcade" && arcade) screen = <ArcadeScreen store={arcade} />;
    else if (mode === "reference") screen = <ReferenceScreen />;

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
                <Banners />
                <Toaster />
                <ShortcutsHelp />
                <OptionsDialog />
                {ready && <Pager />}
                {ready && <HudMenu />}
                {ready && <DocsDrawer />}
                {ready && <ProfileDialog />}
                {ready && <Tour />}
                {ready && <Intro />}
                {ready && <CreateHero />}
                {ready && <TitleScreen />}
            </ErrorBoundary>
        </MotionConfig>
    );
}
