# ADR 0003 — Measure usage with PostHog, behind explicit consent

- **Status**: proposed
- **Date**: 2026-11-19
- **Deciders**: Amr Abdel-Motaleb (maintainer), proposed by an AI agent
- **Related**: hub specs UPS-FE-24, UPS-OPS-02, UPS-OPS-14; [docs/analytics.md](../analytics.md); [ADR 0002](0002-host-production-on-azure-static-web-apps.md)

## Context

The web trainer is gaining traffic and the PRD's success metrics (course completion, return rate) had no data source: nothing was measured at all. Deciding what to improve needs to know where learners stop, which commands fail and what breaks. At the same time the project's first mission is transparency for learners, educators and the public, many visitors are students, and the site has never asked for an account or set a cookie. Whatever is added must not change that.

## Decision

Product analytics is PostHog, as the fleet standard names (UPS-OPS-14), with these constraints built into the code under `web/src/analytics/`:

- **Opt-in only.** Nothing is sent, and `posthog-js` is not downloaded, until the visitor allows analytics. The library is a dynamically imported chunk that `client.ts` loads on consent. A refusal sends nothing: PostHog's cookieless "on reject" counting is deliberately not used.
- **Consent rules of UPS-FE-24.** The answer is stored for 365 days under `bashcrawl-web-consent-v1`; Global Privacy Control and Do Not Track are read as a no and suppress the banner; yes and no are equal buttons; withdrawal stops capture, disables PostHog's persistence and deletes its keys.
- **Production only.** Analytics exists only in a build that was given `VITE_POSTHOG_KEY`, which the deploy passes to production alone.
- **No cookies, no profiles.** `persistence: "localStorage"`, `person_profiles: "identified_only"` and no `identify()` call.
- **A published, typed catalogue.** Every product event is declared in `events.ts`; `track()` is typed against it; the Privacy panel and `docs/analytics.md` are rendered from it and a test fails when the document is stale. Events carry ids, enums and counts from the game's content, never typed text: a command is reported by name only when the game knows it.
- **Bundled extensions.** Session replay, surveys, error tracking and feature flags ship inside the same chunk (`posthog-js/dist/module.full.no-external`), so no script is fetched from a third party at run time and the Content-Security-Policy needs no third-party `script-src`.

## Consequences

**Positive**

- The PRD's metrics become measurable, with a funnel from the home page to a completed quest or lesson.
- Visitors can read exactly what is collected, in the app and in the repository, and the build cannot send an undeclared event.
- A visitor who does not consent costs nothing: no request, no extra JavaScript.

**Negative**

- Opt-in consent means the data is a sample of consenting visitors, skewed away from privacy-conscious users and anyone with GPC enabled. Totals undercount; rates and funnels are still useful.
- Session replay records what the page shows, including commands typed at the game's prompt and the hero's name where the story prints it. This is disclosed in the consent copy; input fields are masked.
- The bundled chunk is about 235 kB gzipped for consenting visitors, and PostHog's toolbar cannot load (it needs external scripts).
- `posthog-js` is one more always-latest dependency; its behaviour is pinned with a `defaults` date.

## Alternatives considered

- **PostHog cookieless mode without a banner** — measures everyone, but sends events before any choice is made, which UPS-FE-24 forbids and the mission argues against.
- **A cookieless aggregate counter (Plausible, GoatCounter)** — simpler and banner-free, but has no funnels, replay, surveys, flags or error tracking, and is not the fleet standard.
- **Server logs only** — the site is static; logs show requests, not what happens inside the emulator.
- **No analytics** — keeps the status quo and leaves the PRD's metrics unmeasurable.

## Supersedes / Superseded by

- Supersedes: none
- Superseded by: none
