# NEW — Agent merge of mergeable PRs, and a review gate

- **Status:** proposed
- **Number:** NEW
- **Date:** 2026-10-30
- **Proposed by:** Grok Bot (agent), for Amr
- **Ratified by:** (blank until merged)
- **Affects:** constitution § 4 (AI agent row), new section "Merge authority and the review gate"
- **Supersedes:** none
- **Related:** hub amendment https://github.com/bamr87/bamr87/pull/481 (source of truth)

## Context

This constitution forbids agents from merging their own PRs. Hub amendment `agent-merge-review-gate` (hub § 12) lets an agent merge a PR only when it meets the *mergeable PR* checklist, and holds anything that needs human review behind a review gate. Each fleet repo must conform to it or file its own amendment.

## Amendment

In § 4, "Merge its own PRs" becomes "Merge a PR that is not mergeable, or one the review gate holds". A new section adopts hub § 12 by reference:

- **Mergeable PR checklist.** All of: (1) required CI checks green; (2) required reviews satisfied; (3) no merge conflicts; (4) the review gate passed wherever human review is required. All four are rechecked against live state just before the merge. Otherwise the agent waits.
- Merge commits only, with no `--admin` and no force-push.
- The gated categories, the `needs-amr` label and the *Needs Amr* Fleet status.
- Agents never merge a gated PR, and amendments are ratified only by the maintainer.

## Consequences

Agents may close routine green PRs here once the hub amendment is ratified. Gated work still waits for Amr. Ratify after, or together with, the hub PR.
