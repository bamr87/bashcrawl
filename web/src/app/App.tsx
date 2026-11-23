// Root of the web trainer: providers, the route → screen switch (the home
// page, the four doors, not-found; with a slide between them), the app-wide
// keys (Alt+1–4 doors, Alt+J/H/O/M, `?` help, Escape → the game menu), the
// boot of the game store, the story observer, analytics (inert without
// consent), and the game's own screens over it — title, hero creation, the
// intro, the tour, the pause menu, the journal, options, privacy, the
// profile, the title cards, the tooltips — and the fleet feedback widget.
import { BookMarked, Keyboard, LifeBuoy, Menu, PanelLeft, Settings } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
import { useEffect } from "react";

import { ConsentBanner } from "../analytics/ConsentBanner";
import { PrivacyDialog } from "../analytics/PrivacyDialog";
import { installAnalytics } from "../analytics/install";
import { getArcade } from "../arcade/arcade-store";
import { bindUnlock } from "../audio/synth";
import { DocsDrawer } from "../chrome/DocsDrawer";
import { ErrorBoundary } from "../chrome/ErrorBoundary";
import { Feedback } from "../chrome/Feedback";
import { GameMenu } from "../chrome/GameMenu";
import { Intro } from "../chrome/Intro";
import { OptionsDialog } from "../chrome/OptionsDialog";
import { ShortcutsHelp } from "../chrome/ShortcutsHelp";
import { SoundToggle } from "../chrome/SoundToggle";
import { TitleScreen } from "../chrome/TitleScreen";
import { Toaster } from "../chrome/Toaster";
import { Tooltips } from "../chrome/Tooltips";
import { Tour } from "../chrome/Tour";
import { initCrt } from "../chrome/crt-store";
import { getPrefs, setPrefs, usePrefs } from "../chrome/prefs-store";
import { initSettings } from "../chrome/settings-store";
import { isIdle, openOverlay, setUi, startTour, toggleHelp, toggleOverlay, useUi } from "../chrome/ui-store";
import { fxBus } from "../engine/fx-bus";
import { game, useGame } from "../engine/game-store";
import { Banners } from "../fx/Banners";
import { FxCanvas } from "../fx/FxCanvas";
import { ScreenFlash } from "../fx/ScreenFlash";
import { installEffects } from "../fx/effects";
import { CreateHero } from "../hero/CreateHero";
import { ProfileDialog } from "../hero/ProfileDialog";
import { useHero } from "../hero/hero-store";
import { HudMenu } from "../hud/HudMenu";
import { StatusStrip } from "../hud/StatusStrip";
import { ArcadeScreen } from "../screens/ArcadeScreen";
import { LandingScreen } from "../screens/LandingScreen";
import { LearnScreen } from "../screens/LearnScreen";
import { NotFound } from "../screens/NotFound";
import { ReferenceScreen } from "../screens/ReferenceScreen";
import { StoryScreen } from "../screens/StoryScreen";
import { Journal } from "../story/Journal";
import { getDialogue } from "../story/dialogue-store";
import { unreadCount, useJournal } from "../story/journal-store";
import { installStory } from "../story/story";
import { Pager } from "../terminal/Pager";
import { PromptDock } from "../terminal/PromptDock";
import { initTheme } from "../theme/theme-store";
import { AppShell } from "./AppShell";
import { MODE_META, MODES, storyOwnsInput, type Mode } from "./modes";
import { HOME_HREF, hrefFor, navigate, useRoute } from "./useHashRoute";

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
                    <h1 className="bc-display">The dungeon did not load</h1>
                    <p>{error}</p>
                    <p><button type="button" className="bc-btn bc-btn-primary" onClick={() => window.location.reload()}>Reload</button></p>
                </>
            ) : (
                <p className="bc-loading"><span className="bc-loading-dot" aria-hidden="true" />Loading the dungeon…</p>
            )}
        </section>
    );
}

const SLIDE = { duration: 0.26, ease: [0.2, 0, 0, 1] as const };

export function App() {
    const route = useRoute();
    const prefs = usePrefs();
    const hero = useHero();
    const { overlay, tour } = useUi();
    const journal = useJournal();
    const phase = useGame((snap) => snap.phase);
    const bootError = useGame((snap) => snap.error);

    useEffect(() => {
        bindUnlock();
        const offEffects = installEffects();
        const offStory = installStory();
        const offAnalytics = installAnalytics();
        void game.boot();
        return () => {
            offEffects();
            offStory();
            offAnalytics();
        };
    }, []);

    // No hash: a returning hero goes back to their last door; a newcomer
    // gets the home page (rendered below, with the address left clean).
    const returning = hero !== null;
    useEffect(() => {
        if (route.kind === "none" && returning) navigate(getPrefs().mode ?? "story");
    }, [route, returning]);

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
    // Alt+digit); Alt+J/H/O/M open the journal, the hero, options, the menu;
    // `?` outside an input opens the shortcuts; F1 the docs; Escape closes
    // the small-screen panels, or opens the game menu when nothing is open.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey && !event.ctrlKey && !event.metaKey) {
                const digit = /^Digit[1-4]$/.test(event.code) ? Number(event.code.slice(5)) : Number(event.key);
                if (digit >= 1 && digit <= MODES.length) {
                    event.preventDefault();
                    navigate(MODES[digit - 1]);
                    return;
                }
                const hot: Record<string, "journal" | "profile" | "options" | "menu"> = { KeyJ: "journal", KeyH: "profile", KeyO: "options", KeyM: "menu" };
                const target = hot[event.code];
                if (target && game.snap.get().phase === "ready") {
                    event.preventDefault();
                    toggleOverlay(target);
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
                // A chapter being told takes its own Escape; otherwise, with nothing open, the game menu.
                if (isIdle() && game.snap.get().phase === "ready" && game.snap.get().page == null && getDialogue().current == null) openOverlay("menu");
                else setUi({ panelsOpen: false });
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const arcade = ready ? getArcade() : null;
    const storyChrome = ready && storyOwnsInput(mode);
    const unread = unreadCount(journal);

    const hasMenu = ready && mode !== null;
    // The header's actions: quiet icon buttons. On a small screen only the
    // journal and the menu stay (the menu reaches the rest).
    const actions = (
        <>
            {ready && returning && (
                <button type="button" className="bc-btn bc-btn-ghost bc-btn-icon bc-journal-btn" onClick={() => openOverlay("journal")} title="Journal: chronicle, quests, lore, bestiary, badges (Alt+J)" aria-label={`Journal${unread ? `, ${unread} new` : ""}`}>
                    <BookMarked aria-hidden="true" />
                    {unread > 0 && <span className="bc-badge-count" aria-hidden="true">{unread}</span>}
                </button>
            )}
            {storyChrome && (
                <button type="button" className="bc-btn bc-btn-ghost bc-btn-icon bc-action-wide" onClick={() => setUi({ hudOpen: true })} title="Sidebar panels: show, hide, reorder, dock" aria-label="Sidebar panels">
                    <PanelLeft aria-hidden="true" />
                </button>
            )}
            {ready && mode !== null && mode !== "reference" && (
                <button type="button" className="bc-btn bc-btn-ghost bc-btn-icon bc-action-wide" onClick={() => setUi({ docsOpen: true })} title="Documentation drawer (F1)" aria-label="Documentation">
                    <LifeBuoy aria-hidden="true" />
                </button>
            )}
            <button type="button" className="bc-btn bc-btn-ghost bc-btn-icon bc-action-wide" onClick={() => setUi({ helpOpen: true })} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
                <Keyboard aria-hidden="true" />
            </button>
            <SoundToggle />
            <button type="button" className={`bc-btn bc-btn-ghost bc-btn-icon${hasMenu ? " bc-action-wide" : ""}`} onClick={() => openOverlay("options")} title="Options: theme, sound, effects, text, privacy (Alt+O)" aria-label="Options">
                <Settings aria-hidden="true" />
            </button>
            {hasMenu && (
                <button type="button" className="bc-btn bc-btn-ghost bc-btn-icon bc-action-narrow" onClick={() => openOverlay("menu")} title="Menu" aria-label="Menu">
                    <Menu aria-hidden="true" />
                </button>
            )}
        </>
    );

    const home = route.kind === "home" || (route.kind === "none" && !returning);
    let screen = null;
    let screenKey: string = route.kind === "mode" ? route.mode : home ? "home" : route.kind;
    if (route.kind === "notfound") screen = <NotFound path={route.path} />;
    else if (home) screen = <LandingScreen />;
    else if (!ready) {
        screen = <Booting error={bootError} />;
        screenKey = "booting";
    } else if (mode === "story") screen = <StoryScreen />;
    else if (mode === "learn") screen = <LearnScreen />;
    else if (mode === "arcade" && arcade) screen = <ArcadeScreen store={arcade} />;
    else if (mode === "reference") screen = <ReferenceScreen />;

    const dock = storyChrome ? <PromptDock /> : mode === "arcade" && arcade ? <PromptDock target={arcade} suggestions={false} /> : null;
    const status = ready && mode !== null && mode !== "reference" ? <StatusStrip /> : null;
    const feedbackRoute = route.kind === "mode" ? hrefFor(route.mode) : route.kind === "notfound" ? `#${route.path}` : home ? HOME_HREF : undefined;

    return (
        <MotionConfig reducedMotion="user">
            <ErrorBoundary>
                <AppShell
                    mode={mode}
                    footer={!home}
                    actions={actions}
                    status={status && <motion.div key="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={SLIDE}>{status}</motion.div>}
                    dock={dock && <motion.div key="dock" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SLIDE}>{dock}</motion.div>}
                >
                    <motion.div key={screenKey} className="bc-screen" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={SLIDE}>
                        {screen}
                    </motion.div>
                </AppShell>
                <FxCanvas />
                <ScreenFlash />
                <Banners />
                <Toaster />
                <Tooltips />
                <ShortcutsHelp />
                <OptionsDialog />
                <PrivacyDialog />
                <ConsentBanner />
                {ready && <Pager />}
                {ready && <HudMenu />}
                {ready && <DocsDrawer />}
                {ready && <Journal />}
                {ready && <ProfileDialog />}
                {ready && <GameMenu />}
                {ready && <Tour />}
                {ready && <Intro />}
                {ready && <CreateHero />}
                {ready && <TitleScreen />}
            </ErrorBoundary>
            {/* Outside the boundary: the crash screen is the one most worth reporting from. */}
            <Feedback route={feedbackRoute} pageTitle={mode ? `Bashcrawl — ${MODE_META[mode].title}` : undefined} />
        </MotionConfig>
    );
}
