<!-- kit: community v0.1.0 · fleet PR template (UPS-WORK-03, UPS-REPO-19) -->

## What and why

<!-- One or two sentences: what changes, and why now. -->

Closes #

<!-- Or, in a repo with a declared file backlog: `Backlog: BL-YYYYMMDD-NN` (spec-driven) or `Backlog: T-NNN`.
     Spec-driven repos also link the package: `Spec: specs/NNN-slug` -->

## Definition of Done

<!-- fleet-dod:start v1 -->
- [ ] **Title** is a Conventional Commit (`feat:`, `fix:`, `docs:`, `chore:` …). It becomes the squash subject and drives the next version and the release-please CHANGELOG entry. Never edit `CHANGELOG.md` or version numbers by hand.
- [ ] **CI is green**: tests, lint, build and the conformance check.
- [ ] **Tests** were added or updated for the change, or this box says why none apply.
- [ ] **Docs** are current (README-First, README-Last): the nearest `README.md`, `docs/`, `SCHEMA.md` if files were added, moved or removed, and `features/features.yml` if a user-facing capability changed.
- [ ] **Agent instructions**: `AGENTS.md` is updated if commands, layout or conventions changed. `CLAUDE.md` stays a pointer to it.
- [ ] **Decision recorded** in `docs/adr/NNNN-slug.md` if this is hard to reverse.
- [ ] **Backlog of record** is updated: the issue is linked above, or the backlog item is moved to Done in this PR.
- [ ] **Clean diff**: no secrets, lockfiles, generated artefacts or unrelated changes.
<!-- fleet-dod:end -->

<!-- Repo-specific gates go BELOW this line. A repo may add boxes; it never removes or rewords the ones above. -->

### bashcrawl gates

- [ ] `make lint` and `make lint-js` pass.
- [ ] `make validate-contracts`, `make test`, `make test-js` and `make web-test` pass (what `ci.yml` runs).
- [ ] Game executables still use no strict mode, emit plain text and never modify git-tracked files; game state was reset with `bash lib/reset.sh` (never `git checkout -- entrance/`).
- [ ] Generated and vendored files (`web/data/*.json`, `web/assets/js/vendor/termforge/`, `docs/generated/`, `tools/`) were regenerated, not hand-edited.

## Evidence

<!-- Command output, screenshots for visual changes, or links. -->

## Follow-ups discovered

<!-- New work found while doing this, filed as issues or backlog items. Write "none" if there are none. -->
