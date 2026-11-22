// The ways into the game, shared by the home page and the title screen:
// straight in as the default hero, or back in as the hero already made.
import { track } from "../analytics/client";
import { navigate } from "../app/useHashRoute";
import { createHero, DEFAULT_NAME, roleMeta, type Hero } from "../hero/hero-store";
import { resetJournal } from "../story/journal-store";
import { unlockChapter } from "../story/story";
import { getPrefs, setPrefs } from "./prefs-store";
import { setUi, startTour } from "./ui-store";

/** Into the game: the last door, or the hero's own. */
export function enterGame(hero: Hero | null): void {
    setPrefs({ onboarded: true });
    setUi({ overlay: null });
    navigate(getPrefs().mode ?? (hero ? roleMeta(hero.role).door : "story"));
}

/** No questions asked: the default hero, the prologue, the Story door, the tour. */
export function dropIn(): void {
    const who = createHero({ name: DEFAULT_NAME, role: "wanderer" });
    track("hero_created", { path: "wanderer", skipped: true });
    resetJournal();
    unlockChapter("prologue");
    enterGame(who);
    if (!getPrefs().introSeen) startTour();
}
