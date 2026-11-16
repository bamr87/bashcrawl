<!-- kit: governance v0.1.0 -->
# 0003 — Missions

- **Status:** proposed
- **Date:** 2026-11-16
- **Proposed by:** Grok Bot (agent), at the maintainer's request
- **Ratified by:**
- **Affects:** constitution §1; PRD.md §1.1; BASHCRAWL-026
- **Supersedes:** none
- **Related:** [PRD.md](../../PRD.md) §1.1

## Context

Constitution §1 was a single mission sentence or short paragraph, not one direction statement with exactly three numbered missions. The fleet rule is that every repo's constitution §1 uses that form, adopted through a numbered amendment the maintainer ratifies by merging. Mission 1 is the maintainer's own wording, adapted to this repo: provide data, tools, resources and transparency for all stakeholders, practitioners in the domain, and the general public. The ambition is the direction, not a claim that the work is already finished.

The earlier §1 text was:

> Bashcrawl teaches real POSIX terminal skills through a fantasy dungeon crawl where the filesystem is the game: directories are rooms, `scroll` files are lessons, and executable scripts are encounters. It ships two doors — the classic dungeon in a real terminal and a free browser trainer (courses, story, practice arcade, reference) built from the same content. Derivative of Seth Kenlon's bashcrawl, GPL-3.0-only.

## Amendment

Retitle constitution §1 **Missions**. Replace the body of §1 with the following. Any invariants or other normative rules that already lived outside §1 are unchanged.

Bashcrawl's direction is to become the ultimate open home for all things terminal learning — data, tools, resources and transparency, gathered in one place that anyone can inspect and reuse.

1. **Provide data, tools, resources and transparency for all stakeholders, learners, educators, terminal practitioners and the general public.** Beginners, teachers, contributors, and the general public are first-class audiences. The aim is a shared, open commons: the same lessons, the same tools, and the same trail of evidence for everyone.
2. **Teach real POSIX terminal skills through a fantasy dungeon crawl where the filesystem is the game: directories are rooms, scroll files are lessons, and executable scripts are encounters.** Lessons stay correct; a wrong command in a scroll is a defect. The classic dungeon runs in a real terminal.
3. **Put that dungeon in every learner's hands through two doors — the classic terminal dungeon and a free browser trainer built from the same content.** Courses, story, practice arcade and reference ship alongside the dungeon, under GPL-3.0-only, in the lineage of Seth Kenlon's bashcrawl — an open toolkit for working with all things terminal learning.

These missions set the course; they do not claim the work is finished. They serve the existing constitution and PRD: real POSIX skills, two doors, and the GPL-3.0-only lineage. The earlier mission paragraph is absorbed into these three. Attribution and license principles are kept. Every feature must trace to them.

_Source: [../PRD.md](../PRD.md) §1.1._

## Consequences

Agents and reviewers judge fit against these three missions before inventing scope, treating them as the direction of the repo rather than a description of what already ships. The same text is added as PRD.md §1.1 so the constitution's `_Source:` line stays accurate. The PRD purpose, goals, feature catalog and invariants outside this addition are unchanged except for a new catalog entry (BASHCRAWL-026) and a regenerated feature-catalog block where the repo already has one. This PR also aligns the README and AGENTS.md one-liners with the missions and links them to constitution §1.
