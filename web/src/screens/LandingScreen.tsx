// The home page: what Bashcrawl is, a terminal to try it in on the spot, the
// four doors, what a learner comes away with, and where the project lives.
// It is the first thing a newcomer sees at the site's address; a returning
// hero is taken to their last door instead and reaches this page from the
// brand. Every number on it is read from the game's own content.
import { ArrowRight, Check, GitBranch, Lock, School, SquareTerminal } from "lucide-react";

import { track } from "../analytics/client";
import { MODES, type Mode } from "../app/modes";
import { navigate } from "../app/useHashRoute";
import { ModeIcon } from "../chrome/ModeIcon";
import { dropIn, enterGame } from "../chrome/start";
import { openOverlay, setUi } from "../chrome/ui-store";
import { requireEngine } from "../engine";
import { game, useGame, type GameStore } from "../engine/game-store";
import type { Course } from "../engine/types";
import { useHero } from "../hero/hero-store";
import { TryIt } from "../landing/TryIt";

const REPO_URL = "https://github.com/bamr87/bashcrawl";
const UPSTREAM_URL = "https://gitlab.com/slackermedia/bashcrawl";

const CLONE = ["git clone https://github.com/bamr87/bashcrawl.git", "cd bashcrawl && ./setup.sh", "cd entrance && cat scroll"].join("\n");

interface DoorCopy {
    title: string;
    blurb: string;
    cta: string;
}

const DOORS: Record<Mode, DoorCopy> = {
    story: {
        title: "Story",
        blurb: "Explore a dungeon where every room is a directory and every scroll is a file. Quests, hidden halls and a map that fills in as you go.",
        cta: "Enter the dungeon",
    },
    learn: {
        title: "Learn",
        blurb: "Guided courses beside a practice lab of real files. Each objective ticks off the moment your command does the job.",
        cta: "Browse the courses",
    },
    arcade: {
        title: "Arcade",
        blurb: "Timed drills for the commands you have met: path races, grep hunts, pipe puzzles, flashcards and a vim maze.",
        cta: "Play a round",
    },
    reference: {
        title: "Reference",
        blurb: "Searchable cheatsheets for every command the dungeon teaches, with a glossary and where each idea is taught.",
        cta: "Open the cheatsheets",
    },
};

const STEPS = [
    { title: "Read the scroll", body: "Each room explains one idea in a few lines, with the exact command to try." },
    { title: "Type the real command", body: "No multiple choice. You type cd, ls, grep and pipes yourself, and see what they do." },
    { title: "Take it with you", body: "Everything works the same in a real terminal on Linux, macOS or WSL." },
];

function courseList(store: GameStore): Course[] {
    const raw = store.data?.courses;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : raw.courses;
}

function stat(store: GameStore, mode: Mode): string | null {
    const data = store.data;
    if (!data) return null;
    if (mode === "story") return `${store.runtime?.quests.length ?? 0} quests · ${Object.keys(data.world.rooms).length} rooms`;
    if (mode === "learn") {
        const courses = courseList(store);
        return `${courses.length} courses · ${courses.reduce((sum, course) => sum + course.lessons.length, 0)} lessons`;
    }
    if (mode === "arcade") return `${requireEngine().BashcrawlArcade?.GAMES.length ?? 0} games · ${data.arcade.vim_levels.length} vim levels`;
    const commands = Object.values(data.commands.categories).reduce((sum, category) => sum + category.commands.length, 0);
    return `${commands} commands`;
}

export function LandingScreen({ store = game }: { store?: GameStore }) {
    const hero = useHero();
    const ready = useGame((snap) => snap.phase === "ready", store);
    const failed = useGame((snap) => snap.phase === "error", store);
    const categories = ready && store.data ? Object.entries(store.data.commands.categories).filter(([, category]) => category.commands.length > 0) : [];

    function start() {
        track("landing_cta_clicked", { cta: hero ? "continue" : "start", surface: "home" });
        if (hero) enterGame(hero);
        else openOverlay("create");
    }
    function quick() {
        track("landing_cta_clicked", { cta: "quick_start", surface: "home" });
        if (hero) enterGame(hero);
        else dropIn();
    }
    function door(mode: Mode) {
        track("landing_cta_clicked", { cta: mode, surface: "home" });
        navigate(mode);
    }

    return (
        <div className="bc-home" aria-labelledby="bc-home-title">
            <section className="bc-home-hero">
                <div className="bc-home-pitch">
                    <p className="bc-eyebrow bc-home-eyebrow">Free · open source · no sign-up</p>
                    <h1 id="bc-home-title" className="bc-home-title">Learn the terminal by playing.</h1>
                    <p className="bc-home-lede">
                        Bashcrawl is a dungeon crawl where the filesystem is the game. You type real commands, <code>cd</code>, <code>ls</code>, <code>grep</code>, pipes, and walk out knowing them.
                    </p>
                    <div className="bc-home-cta">
                        <button type="button" className="bc-btn bc-btn-primary bc-btn-lg" onClick={start}>
                            {hero ? `Continue as ${hero.name}` : "Start playing"}
                            <ArrowRight aria-hidden="true" />
                        </button>
                        {!hero && (
                            <button type="button" className="bc-btn bc-btn-lg" onClick={quick}>Skip setup, jump in</button>
                        )}
                        <button type="button" className="bc-btn bc-btn-ghost bc-btn-lg" onClick={() => openOverlay("intro")}>How it works</button>
                    </div>
                    {failed && (
                        <p className="bc-home-alert" role="alert">
                            The game’s data did not load, so nothing here will start yet.
                            <button type="button" className="bc-btn" onClick={() => window.location.reload()}>Reload</button>
                        </p>
                    )}
                    <ul className="bc-home-points">
                        <li><Check aria-hidden="true" />Runs in your browser, on a phone too</li>
                        <li><Check aria-hidden="true" />Progress saved on your device</li>
                        <li><Check aria-hidden="true" />No ads, no account</li>
                    </ul>
                </div>
                <TryIt store={store} onContinue={quick} />
            </section>

            <section className="bc-home-section" aria-labelledby="bc-home-doors">
                <p className="bc-eyebrow">Four ways in</p>
                <h2 id="bc-home-doors" className="bc-home-h2">Pick how you like to learn</h2>
                <div className="bc-home-doors">
                    {MODES.map((mode) => {
                        const copy = DOORS[mode];
                        const figure = ready ? stat(store, mode) : null;
                        return (
                            <button key={mode} type="button" className="bc-home-door bc-frame" data-door={mode} onClick={() => door(mode)}>
                                <span className="bc-home-door-icon"><ModeIcon mode={mode} /></span>
                                <span className="bc-home-door-title">{copy.title}</span>
                                <span className="bc-home-door-blurb">{copy.blurb}</span>
                                {figure && <span className="bc-home-door-stat">{figure}</span>}
                                <span className="bc-home-door-cta">{copy.cta} <ArrowRight aria-hidden="true" /></span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="bc-home-section" aria-labelledby="bc-home-how">
                <p className="bc-eyebrow">How it works</p>
                <h2 id="bc-home-how" className="bc-home-h2">Real commands, from the first minute</h2>
                <ol className="bc-home-steps">
                    {STEPS.map((step, index) => (
                        <li key={step.title} className="bc-home-step">
                            <span className="bc-home-step-n" aria-hidden="true">{index + 1}</span>
                            <h3>{step.title}</h3>
                            <p>{step.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {categories.length > 0 && (
                <section className="bc-home-section" aria-labelledby="bc-home-learn">
                    <p className="bc-eyebrow">What you will learn</p>
                    <h2 id="bc-home-learn" className="bc-home-h2">The commands people use every day</h2>
                    <div className="bc-home-skills">
                        {categories.map(([id, category]) => (
                            <div key={id} className="bc-home-skill">
                                <h3>{category.title ?? id}</h3>
                                <p>
                                    {category.commands.slice(0, 7).map((row) => <code key={row.command}>{row.command}</code>)}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="bc-home-section bc-home-duo">
                <article className="bc-home-card bc-frame">
                    <School aria-hidden="true" />
                    <h2 className="bc-home-h3">Made for classrooms</h2>
                    <p>Nothing to install and nobody to sign up: open the page and type. It works on Chromebooks, tablets and phones, and each learner’s progress stays on their own device.</p>
                    <button type="button" className="bc-btn" onClick={() => door("learn")}>See the courses</button>
                </article>
                <article className="bc-home-card bc-frame">
                    <SquareTerminal aria-hidden="true" />
                    <h2 className="bc-home-h3">Or play it in your own shell</h2>
                    <p>The original game is plain bash with no dependencies. The browser trainer is built from the same rooms and scrolls.</p>
                    <pre className="bc-home-code"><code>{CLONE}</code></pre>
                </article>
            </section>

            <footer className="bc-home-foot">
                <p className="bc-home-foot-lead">
                    <GitBranch aria-hidden="true" />
                    <span>Open source under GPL-3.0, in the lineage of <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">Seth Kenlon’s bashcrawl</a>.</span>
                </p>
                <nav className="bc-home-foot-links" aria-label="Project">
                    <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
                    <a href={`${REPO_URL}/blob/main/docs/README.md`} target="_blank" rel="noopener noreferrer">Documentation</a>
                    <button type="button" onClick={() => setUi({ privacyOpen: true })}><Lock aria-hidden="true" />Privacy</button>
                    <span>v{__BC_VERSION__}</span>
                </nav>
            </footer>
        </div>
    );
}
