<!-- kit: governance v0.1.0 · seeded from bamr87/bamr87 templates/governance/. Owned by this repo after seeding;
     change it ONLY through an amendment record in docs/amendments/ (see § 8). Validate: python3 <hub>/tools/governance_lint.py check . -->
# bashcrawl — Constitution

> The rules every change to this repo must satisfy, whoever makes it — a human or an AI agent.
> Agents read this before [AGENTS.md](../AGENTS.md) conventions, the [PRD](../PRD.md), or the
> [feature catalog](../features/features.yml). Ratified by merged PR; amended only per § 8.

## 1. Mission

Bashcrawl teaches real POSIX terminal skills through a fantasy dungeon crawl where the filesystem is the game: directories are rooms, `scroll` files are lessons, and executable scripts are encounters. It ships two doors — the classic dungeon in a real terminal and a free browser trainer (courses, story, practice arcade, reference) built from the same content. Derivative of Seth Kenlon's bashcrawl, GPL-3.0-only.

_Source: [PRD.md](../PRD.md)._

## 2. Invariants (non-negotiable)

These rules are lifted from the repo's own agent guide; breaking one is grounds to reject a PR.

- Game executables use no strict mode, emit plain text, never modify tracked files. _(CLAUDE.md)_
- `make validate-contracts && make web-build` — the web app must pick the room up. _(CLAUDE.md)_
- The engine stays classic. The root `package.json` must never declare `"type": "module"`. _(CLAUDE.md)_
- The reader layer (`web/src/terminal/prose.ts` + `log-decor.ts`) runs after every paint. _(CLAUDE.md)_
- The prompt answers some words with screens: `journal`, `menu`/`pause`, `hero`/`wardrobe`, `options`/`settings`, `title` never reach the engine — `GameStore.intercept()` echoes a dim line and opens the overlay (`InputTarget.intercept`). _(CLAUDE.md)_
- A new surface should get the same treatment — and never `AnimatePresence mode="wait"`. _(CLAUDE.md)_
- A mini-game = _(seed world + goal predicate + scoring)_ over a scoped bare `Runtime` (`BashcrawlArcade.GAMES` in `arcade.js`) — never reimplement command behavior outside `termforge/core/` + `runtime.js`. _(CLAUDE.md)_
- Dialogs animate out with `AnimatePresence`, which never completes under jsdom — assert the store state, not the DOM's absence, and never use `mode="wait"` for a sequence of cards (the next one never mounts there); key an enter-only `motion.div` instead. _(CLAUDE.md)_
- Secrets (tokens, API keys) are never printed, logged or committed. _(fleet rule)_
- `CHANGELOG.md`, when present, is not hand-edited once release-please owns it. _(fleet rule)_

## 3. Authority and precedence

When two documents disagree, the higher one wins and the lower one is fixed in the same PR:

1. This constitution (and its ratified amendments in [docs/amendments/](amendments/))
2. [AGENTS.md](../AGENTS.md) — how to work here (commands, conventions, Definition of Done)
3. The PRD ([`PRD.md`](../PRD.md)) — what the product must do (requirement ids `FRn` / `NFRn`)
4. [features/features.yml](../features/features.yml) — what it does today (stable feature ids)
5. ADRs in `docs/adr/` (none yet) and specs — why and how a specific change was made
6. Code, tests, generated files

## 4. Roles: humans and AI agents

| Actor | May | May not |
| --- | --- | --- |
| Maintainer (human) | Ratify amendments, PRD changes and releases by merging PRs; change settings, secrets, branch protection | — |
| AI agent | Read this file first; open PRs on a branch with Conventional Commit titles; update the feature catalog, PRD block and docs in the same PR as the change; propose amendments | Merge a PR that is not mergeable, or one the review gate holds (§ Merge authority); push to the default branch; force-push; change repo settings or branch protection; print or commit secrets; invent features or requirements (unknown = **TBD**) |

## 5. How the artifacts relate

| Artifact | Answers | Owned by | Rule |
| --- | --- | --- | --- |
| `docs/constitution.md` | What must always hold | Maintainer | Changes only by amendment (§ 8) |
| `docs/amendments/NNNN-*.md` | How and why the rules changed | Proposer → maintainer | Append-only; ratified by merged PR |
| `AGENTS.md` / `CLAUDE.md` | How to work here | Repo | Must link this file; `CLAUDE.md` imports `@AGENTS.md` |
| PRD | What the product must do | Maintainer | Requirements carry stable ids (`FRn`, `NFRn`) |
| `features/features.yml` | What the product does, where, proven how | Repo | Every user-facing feature has an id, `status`, location and `prd:` refs |
| PRD "Feature catalog" block | PRD → feature trace | Generated | `governance_lint.py prd-sync`; never hand-edit |
| `docs/adr/NNNN-*.md` | Why a hard-to-reverse decision was made | Proposer | One ADR per decision; an amendment may cite one |
| `CHANGELOG.md` | What shipped | release-please | Generated from Conventional Commits; never hand-edit |

## 6. Change process

| Change | Required in the same PR |
| --- | --- |
| Typo, docs fix, refactor with no user-visible effect | Conventional Commit title |
| New or changed user-facing feature | Entry in `features/features.yml` (`status`, `link`/`docs`, `prd:`), regenerated PRD block |
| New or changed requirement | PRD edit with a new `FRn`/`NFRn` id (ids are never reused), feature `prd:` refs updated |
| Hard-to-reverse technical decision | ADR in `docs/adr/` |
| Change to this constitution | Amendment record in `docs/amendments/` (§ 8) |

## 7. Quality gates

Every PR passes the checks the repo's guide names:

- `make validate-contracts` _(AGENTS.md)_
- `make web-build` _(AGENTS.md)_
- `make web-test` _(AGENTS.md)_
- `make test` _(AGENTS.md)_
- `make test-js` _(AGENTS.md)_
- `make lint` _(AGENTS.md)_
- `python3 <bamr87/bamr87>/tools/governance_lint.py check .` (feature catalog ↔ PRD, constitution, amendments)

## 8. Amendments

This constitution changes only through a numbered record in [docs/amendments/](amendments/) (`NNNN-kebab-slug.md`, copied from [0000-template.md](amendments/0000-template.md)):

1. **Propose** — open a PR that adds the record (`Status: proposed`) _and_ the edit to this file it describes. Name what it affects: constitution sections, PRD requirement ids, feature ids.
2. **Review** — the maintainer reviews; an agent never approves or merges its own amendment.
3. **Ratify** — merging the PR ratifies it. The record says `Status: ratified` and `Ratified by:` the PR. A rejected or withdrawn PR keeps its record with that status; numbers are never reused.
4. **Supersede** — a later amendment may replace an earlier one; mark the old record `superseded by NNNN`.

Records are append-only history: fix a ratified rule with a new amendment, never by editing an old record. [0001](amendments/0001-ratify-constitution.md) ratifies this document.

## Merge authority and the review gate

_(amendment `agent-merge-review-gate`, numbered at merge; conforms to hub constitution § 12, [bamr87/bamr87 amendment](https://github.com/bamr87/bamr87/pull/481). The hub's text governs.)_

1. **Mergeable PR.** A PR is mergeable only when **all** of these are true, rechecked against live state just before the merge: (1) the required CI checks are green; (2) the required reviews are satisfied; (3) there are no merge conflicts; (4) the review gate has passed wherever human review is required.
2. An AI agent may merge a PR only when it is mergeable; otherwise it waits. Merges use a merge commit, never squash or rebase, never `--admin`, and never a force-push.
3. **Review gate.** The gated categories are those in hub § 12: amendments and this constitution; secrets, budgets and billing; settings, branch protection and permissions; security-sensitive changes; deploys and the maintainer's machines; non-trivial conflicts; destructive changes; and anything labelled `agent:hold`, `blocked` or `needs-amr`. A gated PR gets the `needs-amr` label and the Fleet status *Needs Amr*. An agent never merges it, and amendments are ratified only by the maintainer merging.
