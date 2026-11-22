// The event catalogue: every product event this app can send, what it means
// and exactly which properties ride on it. It is the single source for three
// things, so they cannot drift apart: the types `track()` checks at compile
// time, the "what is collected" list in the Privacy dialog, and the table in
// docs/analytics.md (catalog.test.ts fails when that table is stale).
//
// Rules for a new event: `object_verb` in snake_case; properties are ids,
// enums, counts and booleans that come from the game's own content, never
// text a person typed (no command lines, no hero name, no search text).

/** The four doors plus the two pages that are not doors. */
export type Surface = "home" | "story" | "learn" | "arcade" | "reference" | "notfound";

export interface EventProps {
    $pageview: { surface: Surface };
    app_loaded: { returning: boolean; has_hero: boolean; theme: string; viewport: "mobile" | "tablet" | "desktop" };
    landing_cta_clicked: { cta: string; surface: Surface };
    hero_created: { path: string; skipped: boolean };
    intro_finished: { via: "seen" };
    tour_finished: { outcome: "completed" | "skipped"; step: number };
    command_first_used: { command: string; surface: Surface };
    command_failed: { command: string; surface: Surface; quest_id: number | null; streak: number };
    hint_used: { surface: Surface; quest_id: number | null };
    room_discovered: { room: string };
    quest_completed: { quest_id: number; quests_done: number };
    rank_reached: { rank: string; rank_index: number };
    passage_unlocked: { quests_done: number };
    story_completed: { quests_done: number };
    course_started: { course_id: string };
    objective_met: { course_id: string; lesson_index: number };
    lesson_completed: { course_id: string; lesson_index: number };
    course_completed: { course_id: string };
    arcade_game_started: { game: string; variant: string | null };
    arcade_game_finished: { game: string; outcome: "won" | "lost"; score: number; best: boolean; seconds: number; hints: number };
    reference_searched: { term: string | null; results: number };
    overlay_opened: { overlay: string; surface: Surface };
    setting_changed: { setting: string; value: string };
    feedback_opened: { surface: Surface };
    consent_updated: { analytics: "granted" };
}

export type EventName = keyof EventProps;

export interface EventSpec<K extends EventName> {
    /** One sentence, shown to visitors as is. */
    about: string;
    /** Each property and what it holds. */
    props: { [P in keyof EventProps[K]]: string };
}

const SURFACE = "which part of the app: home, story, learn, arcade, reference";

export const EVENT_CATALOG: { [K in EventName]: EventSpec<K> } = {
    $pageview: {
        about: "A page or door was opened.",
        props: { surface: SURFACE },
    },
    app_loaded: {
        about: "The app finished loading.",
        props: {
            returning: "whether this browser already had a saved game",
            has_hero: "whether a hero has been created",
            theme: "dark, light or auto",
            viewport: "mobile, tablet or desktop, by window width",
        },
    },
    landing_cta_clicked: {
        about: "A button on the home page was used.",
        props: { cta: "which button: start, continue, a door name, or source", surface: SURFACE },
    },
    hero_created: {
        about: "A hero was created (or creation was skipped).",
        props: { path: "the chosen path: wanderer, scribe, rogue or sage", skipped: "true when the default hero was taken" },
    },
    intro_finished: {
        about: "The how-to-play intro was read to the end or closed.",
        props: { via: "always “seen”" },
    },
    tour_finished: {
        about: "The guided tour ended.",
        props: { outcome: "completed or skipped", step: "the tour stop it ended on" },
    },
    command_first_used: {
        about: "A command was run successfully for the first time in this visit.",
        props: { command: "the command’s name only (ls, cd, grep…), never its arguments", surface: SURFACE },
    },
    command_failed: {
        about: "A command returned an error (at most 30 per visit).",
        props: {
            command: "the command’s name if it is one the game knows, otherwise “unknown”",
            surface: SURFACE,
            quest_id: "the story quest in progress, if any",
            streak: "how many commands in a row have failed",
        },
    },
    hint_used: {
        about: "The hint command was used.",
        props: { surface: SURFACE, quest_id: "the story quest in progress, if any" },
    },
    room_discovered: {
        about: "A dungeon room was entered for the first time.",
        props: { room: "the room’s path in the game, such as /entrance/cellar" },
    },
    quest_completed: {
        about: "A story quest was completed.",
        props: { quest_id: "the quest’s number", quests_done: "how many quests are complete" },
    },
    rank_reached: {
        about: "The hero reached a new rank.",
        props: { rank: "the rank’s title", rank_index: "its position on the ladder" },
    },
    passage_unlocked: {
        about: "A hidden passage was opened.",
        props: { quests_done: "how many quests are complete" },
    },
    story_completed: {
        about: "The main story was finished.",
        props: { quests_done: "how many quests are complete" },
    },
    course_started: {
        about: "A guided course was opened.",
        props: { course_id: "the course’s id" },
    },
    objective_met: {
        about: "A lesson objective was met.",
        props: { course_id: "the course’s id", lesson_index: "the lesson’s position in the course" },
    },
    lesson_completed: {
        about: "A lesson was completed.",
        props: { course_id: "the course’s id", lesson_index: "the lesson’s position in the course" },
    },
    course_completed: {
        about: "A course was completed.",
        props: { course_id: "the course’s id" },
    },
    arcade_game_started: {
        about: "A Practice Arcade game was started.",
        props: { game: "the game’s id", variant: "the deck or level, if one was picked" },
    },
    arcade_game_finished: {
        about: "A Practice Arcade game ended.",
        props: {
            game: "the game’s id",
            outcome: "won or lost",
            score: "the score",
            best: "whether it beat the saved best",
            seconds: "how long the game took",
            hints: "how many hints were used",
        },
    },
    reference_searched: {
        about: "The Reference search was used.",
        props: { term: "the search text only when it is exactly a command the game teaches, otherwise nothing", results: "how many entries matched" },
    },
    overlay_opened: {
        about: "A panel was opened: journal, options, profile, menu, docs, shortcuts or privacy.",
        props: { overlay: "which panel", surface: SURFACE },
    },
    setting_changed: {
        about: "An option was changed.",
        props: { setting: "which option", value: "its new value" },
    },
    feedback_opened: {
        about: "The feedback form was opened.",
        props: { surface: SURFACE },
    },
    consent_updated: {
        about: "Usage analytics was switched on.",
        props: { analytics: "always “granted” (a refusal sends nothing at all)" },
    },
};

export const EVENT_NAMES = Object.keys(EVENT_CATALOG) as EventName[];

/** What every event also carries, set once when analytics starts. */
export const COMMON_PROPERTIES: Record<string, string> = {
    app_version: "the release of the app",
    app_commit: "the build’s commit",
    app_env: "production, staging or preview",
};

/** What the analytics library adds on its own. */
export const AUTOMATIC_DATA: readonly string[] = [
    "a random visitor id kept in this browser’s local storage (no cookies, no account, no email)",
    "the page address, the referring site and campaign tags in the link you followed",
    "browser, operating system, device type, screen size and language",
    "an approximate location derived from your IP address by PostHog",
    "which buttons and links are clicked (their position and type, not their text)",
    "uncaught errors in the page, with their stack traces",
    "page-load and responsiveness timings",
    "a replay of your visit to this site: what the page showed and where you clicked, including the commands you typed at the game’s prompt; text boxes such as the hero’s name are masked",
    "your answers to an occasional in-app survey, if you choose to answer one",
];

/** What is never sent, whatever the consent. */
export const NEVER_COLLECTED: readonly string[] = [
    "anything at all before you allow analytics, or after you switch it off",
    "your name, email address or any account: the site has no sign-in",
    "your saved game, which stays in this browser",
    "anything outside this site’s own pages",
    "advertising identifiers; no data is sold or shared with advertisers",
];

function cell(value: string): string {
    return value.replace(/\|/g, "\\|");
}

/** The catalogue as the Markdown table docs/analytics.md embeds. */
export function catalogMarkdown(): string {
    const rows = EVENT_NAMES.map((name) => {
        const spec = EVENT_CATALOG[name] as EventSpec<EventName>;
        const props = Object.entries(spec.props as Record<string, string>)
            .map(([key, about]) => `\`${key}\`: ${cell(about)}`)
            .join("; ");
        return `| \`${name}\` | ${cell(spec.about)} | ${props} |`;
    });
    return ["| Event | Sent when | Properties |", "| --- | --- | --- |", ...rows].join("\n");
}
