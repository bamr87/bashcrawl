# PRD — Bashcrawl

> The product requirements for Bashcrawl — problem, users, goals, features and open questions — derived from the README, agent docs, config and code, with anything those sources do not state marked **TBD**.

## 1. Overview / problem

Bashcrawl teaches real POSIX terminal skills through a fantasy dungeon crawl where the filesystem is the game: directories are rooms, `scroll` files are lessons, and executable scripts are encounters. It ships two doors — the classic dungeon in a real terminal and a free browser trainer (courses, story, practice arcade, reference) built from the same content. Derivative of Seth Kenlon's bashcrawl, GPL-3.0-only.

## 2. Target users

- Beginners learning the Linux/macOS terminal
- Educators running terminal courses
- Learners on mobile/browser without a shell

## 3. Goals and non-goals

**Goals**

- Teach real, transferable commands (pwd, ls, cd, cat, grep, find, pipes, variables, permissions, vim)
- Zero-install browser experience plus the original terminal game
- Keep browser and terminal content generated from one source

**Non-goals**

- Teaching shell features that do not work on real POSIX systems
- Changing the upstream GPL licensing

## 4. Core features (current)

- Web app (bamr87.github.io/bashcrawl): Learn courses beside an emulated shell, Story mode, Practice Arcade (Path Navigator, grep/find Hunt, Pipe Puzzle, Command Flash, Vim Catacombs), Reference cheatsheets
- Classic terminal dungeon (`entrance/`, `setup.sh`)
- XP/score persistence across modes
- Content data (rooms, recommendations) and transcript-based tests

## 5. Requirements

**Functional**

- Course objectives are checked as the learner types
- Scores and bests persist locally

**Non-functional**

- Node ≥ 22.22 for the web build; typecheck, lint and tests in CI
- Works on mobile
- GPL-3.0-only

## 6. Success metrics (proposed — not defined in sources)

- Course completion rate
- Return-player rate: TBD (no analytics source identified)

## 7. Roadmap / open questions

- Roadmap beyond v3.x: TBD

## 8. Links

- [README.md](README.md) · [AGENTS.md](AGENTS.md) · [CHANGELOG.md](CHANGELOG.md) · [NOTICE](NOTICE)
