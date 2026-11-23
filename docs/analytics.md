# Analytics and privacy

> What the web trainer measures, what it never does, how consent works and how to audit all of it: the public counterpart of `web/src/analytics/`.

Bashcrawl's first mission is transparency ([constitution](constitution.md) §1), so this page and the in-app Privacy panel list every event the site can send. Both are produced from one file, [`web/src/analytics/events.ts`](../web/src/analytics/events.ts): the code cannot send an event that is not listed here.

## The short version

- **Nothing is collected until you say yes.** The analytics library is not even downloaded before that. Saying no, or closing the banner, sends nothing at all.
- **No cookies, no account, no ads.** The visitor id is a random value in this browser's local storage, for this site only.
- **The classic terminal dungeon is never measured.** Analytics exists only in the web trainer, and only in a build that was given a key, which is the production site: a local build, a pull-request preview and the GitHub Pages copy carry no analytics key and collect nothing.
- **Your saved game never leaves your browser.**
- Usage data goes to [PostHog](https://posthog.com). It is used to see which lessons get finished, where learners get stuck and what breaks, and for nothing else. It is not sold or shared with advertisers.

## Consent

The rules follow the fleet standard UPS-FE-24 and are implemented in [`consent-store.ts`](../web/src/analytics/consent-store.ts).

| Rule | How it is met |
| --- | --- |
| No tracker fires before consent | PostHog is loaded by a dynamic `import()` that only runs after an explicit yes; `track()` drops events until then. |
| The answer is remembered for 365 days | Stored under the `localStorage` key `bashcrawl-web-consent-v1` with its date; after 365 days the question is asked again. |
| Do Not Track and Global Privacy Control are honoured | A browser that sends either is treated as having answered no and is never shown the banner. Analytics can still be switched on by hand in Options. |
| Production only | Analytics exists only in a build that was given `VITE_POSTHOG_KEY`. The deploy passes one to production; staging gets one only if the maintainer sets a separate staging key (a separate PostHog project), and pull-request previews, local builds and the GitHub Pages copy never do. |
| Yes and no are equal | The banner's two buttons are the same size and one click each. |
| Consent can be withdrawn | Options → Usage analytics, or the Privacy panel. Switching it off opts out, stops the session replay and deletes PostHog's keys from this browser. |

There are two categories: **essential** (the game's own saves and preferences in `localStorage`, which need no consent because nothing leaves the browser) and **analytics** (everything on this page). There is no marketing category because there is no marketing tracker.

## What is collected, only after a yes

Collected by PostHog's library itself:

- a random visitor id kept in this browser's local storage (no cookies, no account, no email)
- the page address, the referring site and campaign tags in the link you followed
- browser, operating system, device type, screen size and language
- an approximate location derived from your IP address by PostHog
- which buttons and links are clicked (their position and type, not their text)
- uncaught errors in the page, with their stack traces
- page-load and responsiveness timings
- a replay of your visit to this site: what the page showed and where you clicked, including the commands you typed at the game's prompt; text boxes such as the hero's name are masked
- your answers to an occasional in-app survey, if you choose to answer one

Every product event also carries `app_version`, `app_commit` and `app_env`. The product events are:

<!-- events:start (generated from web/src/analytics/events.ts; BC_WRITE_DOCS=1 npm run test:web -- catalog) -->
| Event | Sent when | Properties |
| --- | --- | --- |
| `$pageview` | A page or door was opened. | `surface`: which part of the app: home, story, learn, arcade, reference |
| `app_loaded` | The app finished loading. | `returning`: whether this browser already had a saved game; `has_hero`: whether a hero has been created; `theme`: dark, light or auto; `viewport`: mobile, tablet or desktop, by window width |
| `landing_cta_clicked` | A button on the home page was used. | `cta`: which button: start, continue, a door name, or source; `surface`: which part of the app: home, story, learn, arcade, reference |
| `hero_created` | A hero was created (or creation was skipped). | `path`: the chosen path: wanderer, scribe, rogue or sage; `skipped`: true when the default hero was taken |
| `intro_finished` | The how-to-play intro was read to the end or closed. | `via`: always “seen” |
| `tour_finished` | The guided tour ended. | `outcome`: completed or skipped; `step`: the tour stop it ended on |
| `command_first_used` | A command was run successfully for the first time in this visit. | `command`: the command’s name only (ls, cd, grep…), never its arguments; `surface`: which part of the app: home, story, learn, arcade, reference |
| `command_failed` | A command returned an error (at most 30 per visit). | `command`: the command’s name if it is one the game knows, otherwise “unknown”; `surface`: which part of the app: home, story, learn, arcade, reference; `quest_id`: the story quest in progress, if any; `streak`: how many commands in a row have failed |
| `hint_used` | The hint command was used. | `surface`: which part of the app: home, story, learn, arcade, reference; `quest_id`: the story quest in progress, if any |
| `room_discovered` | A dungeon room was entered for the first time. | `room`: the room’s path in the game, such as /entrance/cellar |
| `quest_completed` | A story quest was completed. | `quest_id`: the quest’s number; `quests_done`: how many quests are complete |
| `rank_reached` | The hero reached a new rank. | `rank`: the rank’s title; `rank_index`: its position on the ladder |
| `passage_unlocked` | A hidden passage was opened. | `quests_done`: how many quests are complete |
| `story_completed` | The main story was finished. | `quests_done`: how many quests are complete |
| `course_started` | A guided course was opened. | `course_id`: the course’s id |
| `objective_met` | A lesson objective was met. | `course_id`: the course’s id; `lesson_index`: the lesson’s position in the course |
| `lesson_completed` | A lesson was completed. | `course_id`: the course’s id; `lesson_index`: the lesson’s position in the course |
| `course_completed` | A course was completed. | `course_id`: the course’s id |
| `arcade_game_started` | A Practice Arcade game was started. | `game`: the game’s id; `variant`: the deck or level, if one was picked |
| `arcade_game_finished` | A Practice Arcade game ended. | `game`: the game’s id; `outcome`: won or lost; `score`: the score; `best`: whether it beat the saved best; `seconds`: how long the game took; `hints`: how many hints were used |
| `reference_searched` | The Reference search was used. | `term`: the search text only when it is exactly a command the game teaches, otherwise nothing; `results`: how many entries matched |
| `overlay_opened` | A panel was opened: journal, options, profile, menu, docs, shortcuts or privacy. | `overlay`: which panel; `surface`: which part of the app: home, story, learn, arcade, reference |
| `setting_changed` | An option was changed. | `setting`: which option; `value`: its new value |
| `feedback_opened` | The feedback form was opened. | `surface`: which part of the app: home, story, learn, arcade, reference |
| `consent_updated` | Usage analytics was switched on. | `analytics`: always “granted” (a refusal sends nothing at all) |
<!-- events:end -->

## What is never collected

- anything at all before you allow analytics, or after you switch it off
- your name, email address or any account: the site has no sign-in
- your saved game, which stays in this browser
- the arguments of the commands you type, as event data: a product event carries a command's name only when it is one the game teaches (`ls`, `grep`), and `unknown` otherwise
- anything outside this site's own pages
- advertising identifiers; no data is sold or shared with advertisers

## How it is built

| Part | File | Role |
| --- | --- | --- |
| Configuration | [`config.ts`](../web/src/analytics/config.ts) | Reads `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_UI_HOST` and `VITE_APP_ENV` once; no key means no analytics code path at all. |
| Consent | [`consent-store.ts`](../web/src/analytics/consent-store.ts), [`ConsentBanner.tsx`](../web/src/analytics/ConsentBanner.tsx), [`PrivacyDialog.tsx`](../web/src/analytics/PrivacyDialog.tsx) | The answer, the banner and the Privacy panel. |
| Catalogue | [`events.ts`](../web/src/analytics/events.ts) | Every event and its properties; the types `track()` is checked against, the Privacy panel's list and the table above. |
| Client | [`client.ts`](../web/src/analytics/client.ts) | The only file that touches PostHog. Loads `posthog-js` with replay, surveys, error tracking and flags bundled in, so no script is fetched from a third party at run time. |
| Wiring | [`install.ts`](../web/src/analytics/install.ts) | Subscribes to the route, the FX bus and the small stores; the screens carry no analytics calls of their own. |
| Flags | [`flags.ts`](../web/src/analytics/flags.ts) | `useFeatureFlag()`, undefined without consent, and the registry every flag must be declared in. |

PostHog is initialised with `persistence: "localStorage"` (no cookies), `person_profiles: "identified_only"` and no call to `identify()` (so no person profile is ever built), `mask_all_text: true` for click capture, input masking in session replay, and a pinned `defaults` snapshot so that a library update cannot change behaviour silently.

### Adding an event

1. Add it to `EventProps` and `EVENT_CATALOG` in `events.ts`: `object_verb` in snake_case, with properties that are ids, enums, counts or booleans from the game's own content. Never send text a person typed.
2. Send it from `install.ts` if a store or the FX bus already announces the moment, otherwise with `track()` where it happens.
3. Regenerate the table above: `BC_WRITE_DOCS=1 npm run test:web -- catalog`. CI fails while the table is stale.

### Surveys, flags, replay and errors

- **Surveys** are created in PostHog and appear to consenting visitors with no code change; target them on a catalogue event such as `lesson_completed` or `arcade_game_finished`. The GitHub feedback button stays the public, account-free way to report a problem.
- **Feature flags** are read with `useFeatureFlag("key")` and declared in `FLAGS` with the issue that will remove them (UPS-OPS-04). A flag is `undefined` for anyone who has not consented, so the default experience must be the one without it.
- **Session replay** starts with consent and stops when it is withdrawn. Mark anything that must never appear in a replay with the `ph-no-capture` class.
- **Errors**: uncaught exceptions are captured automatically; the app's error boundary reports through `captureError()`.

## Auditing it yourself

- Read the catalogue: `web/src/analytics/events.ts`, or the Privacy panel in the app.
- Watch the network tab: before you allow analytics there are no requests to any analytics host and no PostHog script is loaded.
- Search the code: `git grep -n "track(" web/src` lists every call site; `client.ts` is the only importer of `posthog-js`.
- Check the tests: `web/src/analytics/*.test.ts` assert that nothing is sent before consent, that withdrawal deletes PostHog's storage, and that no typed text leaves the browser.

## For the maintainer

Recommended PostHog project settings, which the code cannot enforce: enable **Discard client IP data**, set the session-replay and data retention you actually need, and add the production domain to the authorised URLs. The deploy passes the key through the repository variables described in [deploy.md](deploy.md).
