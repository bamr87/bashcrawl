// Character creation: name, path, look, preferences, ready — with the hero
// drawn live beside the steps. Choosing a path dresses the hero in its
// preset until the player touches the wardrobe. Enter advances, Escape
// returns to the title. Finishing creates the hero and leads into the
// intro (the first time) or straight through the hero's door with the tour.
import { AnimatePresence, motion } from "motion/react";
import { useState, type KeyboardEvent } from "react";

import { navigate } from "../app/useHashRoute";
import { play } from "../audio/sfx";
import { getPrefs, setPrefs } from "../chrome/prefs-store";
import { SettingsForm } from "../chrome/SettingsForm";
import { openOverlay, setUi, startTour, useUi } from "../chrome/ui-store";
import { resetJournal } from "../story/journal-store";
import { unlockChapter } from "../story/story";
import { describeAppearance, ROLE_PRESETS, type Appearance } from "./appearance";
import { AppearanceEditor } from "./AppearanceEditor";
import { HeroFigure } from "./HeroFigure";
import { cleanName, createHero, NAME_MAX, ROLES, rollName, roleMeta, type HeroRole } from "./hero-store";

const STEPS = ["name", "path", "look", "options", "ready"] as const;
type Step = (typeof STEPS)[number];
const TITLES: Record<Step, string> = {
    name: "Name your hero",
    path: "Choose a path",
    look: "Shape your hero",
    options: "Set your preferences",
    ready: "Ready to descend",
};

function doorName(role: HeroRole): string {
    const door = roleMeta(role).door;
    return door === "arcade" ? "Practice Arcade" : door.charAt(0).toUpperCase() + door.slice(1);
}

function Wizard() {
    const [step, setStep] = useState(0);
    const [name, setName] = useState(() => rollName());
    const [role, setRole] = useState<HeroRole>("wanderer");
    const [appearance, setAppearance] = useState<Appearance>(ROLE_PRESETS.wanderer);
    const [touched, setTouched] = useState(false);
    const id = STEPS[step] ?? "name";
    const meta = roleMeta(role);
    const last = step === STEPS.length - 1;

    const next = () => {
        play("tab");
        setStep((current) => Math.min(STEPS.length - 1, current + 1));
    };
    const back = () => setStep((current) => Math.max(0, current - 1));

    function pickRole(value: HeroRole) {
        setRole(value);
        if (!touched) setAppearance(ROLE_PRESETS[value]);
    }
    function dress(value: Appearance) {
        setTouched(true);
        setAppearance(value);
    }

    function finish() {
        const hero = createHero({ name, role, appearance });
        setPrefs({ onboarded: true });
        // A new hero, a new chronicle: the prologue is told once the screens clear.
        resetJournal();
        unlockChapter("prologue");
        play("quest");
        if (getPrefs().introSeen) {
            setUi({ overlay: null });
            navigate(meta.door);
            if (meta.door === "story" || meta.door === "learn") startTour();
        } else {
            openOverlay("intro");
        }
        return hero;
    }

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Escape") {
            event.preventDefault();
            openOverlay("title");
        } else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
            event.preventDefault();
            if (last) finish();
            else next();
        }
    }

    return (
        <div className="bc-create-panel bc-frame" data-step={id} onKeyDown={onKeyDown}>
            <aside className="bc-create-preview" aria-label="Your hero so far">
                <HeroFigure appearance={appearance} size="lg" label={`${cleanName(name)}, ${meta.title}`}>
                    <p className="bc-hero-name bc-display">{cleanName(name)}</p>
                    <p className="bc-muted bc-hero-path"><span aria-hidden="true">{meta.icon} </span>{meta.title}</p>
                </HeroFigure>
                <p className="bc-muted bc-create-trait">{meta.trait}</p>
            </aside>
            <section className="bc-create-step" aria-live="polite">
                <p className="bc-step-kicker">Step {step + 1} of {STEPS.length}</p>
                <h2 className="bc-display">{TITLES[id]}</h2>

                {id === "name" && (
                    <>
                        <div className="bc-name-row">
                            <label className="bc-visually-hidden" htmlFor="hero-name">Hero name</label>
                            <input id="hero-name" value={name} maxLength={NAME_MAX} autoComplete="off" spellCheck={false} autoFocus onChange={(event) => setName(event.target.value)} />
                            <button type="button" className="bc-btn" onClick={() => setName(rollName())} title="Roll a random name">⚄ Roll</button>
                        </div>
                        <p className="bc-muted">Up to {NAME_MAX} characters. You can rename your hero later from the profile.</p>
                    </>
                )}

                {id === "path" && (
                    <div className="bc-cards" role="radiogroup" aria-label="Path">
                        {ROLES.map((entry) => (
                            <button key={entry.id} type="button" role="radio" aria-checked={entry.id === role} className="bc-card" onClick={() => pickRole(entry.id)} onDoubleClick={next}>
                                <strong><span aria-hidden="true">{entry.icon}</span>{entry.title}</strong>
                                <small>{entry.blurb}</small>
                                <small className="bc-card-door">Starts in: {doorName(entry.id)}</small>
                            </button>
                        ))}
                    </div>
                )}

                {id === "look" && <AppearanceEditor value={appearance} onChange={dress} role={role} />}

                {id === "options" && <SettingsForm />}

                {id === "ready" && (
                    <div className="bc-ready">
                        <p><strong className="bc-display">{cleanName(name)}</strong> the <strong>{meta.title}</strong> — {describeAppearance(appearance)} — begins in the <strong>{doorName(role)}</strong>.</p>
                        <p className="bc-muted">{meta.trait} Everything is saved in this browser; nothing leaves it.</p>
                    </div>
                )}

                <nav className="bc-wizard-nav" aria-label="Steps">
                    <button type="button" className="bc-btn" onClick={step === 0 ? () => openOverlay("title") : back}>{step === 0 ? "Title" : "Back"}</button>
                    <span className="bc-dots" aria-hidden="true">
                        {STEPS.map((label, index) => <span key={label} className="bc-dot" data-on={index <= step || undefined} />)}
                    </span>
                    {last ? (
                        <button type="button" className="bc-btn bc-btn-primary" onClick={finish}>Begin the descent</button>
                    ) : (
                        <button type="button" className="bc-btn bc-btn-primary" onClick={next}>Next</button>
                    )}
                </nav>
            </section>
        </div>
    );
}

export function CreateHero() {
    const { overlay } = useUi();
    return (
        <AnimatePresence>
            {overlay === "create" && (
                <motion.div
                    className="bc-title bc-create"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Create your hero"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.26 }}
                >
                    <Wizard />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
