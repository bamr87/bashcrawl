---
name: verify-feature
description: "**WORKFLOW SKILL** — Prove a feature, change, or fix works the way a USER experiences it: run the app, drive it through a real browser (Playwright MCP or verify/runner.mjs), capture screenshots + metrics into an evidence bundle, and link it from features/features.yml. USE FOR: any PR that changes what a user sees or does; after a bug fix; when asked to \"verify\", \"test this in the browser\", \"prove it works\", or \"add evidence\". READS: features/features.yml (what exists), verify/verify.yml (how to run it), verify/scenarios/*.yml (what a user does). DO NOT USE FOR: pure docs/config edits with no user-visible effect (label the PR `skip-evidence`)."
---

<!-- kit: verify v0.1.0 — seeded from bamr87/bamr87 templates/verify/. Fleet standard: bamr87/bamr87 docs/VERIFICATION.md (UPS-QA-50..53). -->

# verify-feature — agent verification of bashcrawl

You are verifying that the software works **as a user would experience it**, not that the code looks right. Every claim you make ends in an artifact someone else can open: a screenshot, a `report.json`, a scenario file that re-runs.

| Piece | Where | What it tells you |
| --- | --- | --- |
| Feature index | `features/features.yml` | every user-facing capability, its route/docs, the tests/scenarios/evidence that already prove it |
| Run config | `verify/verify.yml` | how to start the app, the base URL, viewports, where evidence goes, what you must never do |
| Scenarios | `verify/scenarios/*.yml` | step-by-step user paths (goto/click/fill/expect/screenshot) — both your acceptance script and the runner's input |
| Runner | `verify/runner.mjs` | deterministic Playwright executor → `test/evidence/<id>/` |
| Evidence | `test/evidence/<slug>/` | screenshots + `report.json` + a README explaining what each image proves |
| Browser (interactive) | Playwright MCP (`verify/mcp.json`) | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_take_screenshot` — you, driving the app like a person |

## Steps

1. **Scope from the index, not the diff alone.** Read `features/features.yml`. From the change (the PR diff, the issue, or the request), list the feature ids it touches. If a touched capability has **no entry**, add one first (stable id, `surface`, `link`, `docs`) — an unindexed feature is the gap this whole loop exists to close. Note which of those features already have `tests`, `scenarios`, `evidence`.

2. **Start the app the way `verify/verify.yml` says.** Run `app.build` (if any) then `app.start` in the background, poll `app.url + app.ready` until it answers. Do not invent a different port or command — if the config is wrong, fix the config (that is a deliverable too).

3. **Run what already exists.** `node verify/runner.mjs --feature <ID>` (or `--only <scenario>`). Read the printed PASS/FAIL lines and `test/evidence/<id>/report.json`. A pre-existing scenario failing on this branch is a finding — report it before anything else.

4. **Drive it yourself.** Through the Playwright MCP, do what the change claims a user can now do: navigate to the route, take a `browser_snapshot` (accessibility tree — this is how you *read* the page), interact, and `browser_take_screenshot` at the moments that prove the behaviour, at desktop AND mobile widths (`browser_resize`). Check the things a user notices and a unit test never does: nothing overflows sideways, focus is visible, the console has no errors (`browser_console_messages`), the 404 and empty states render, dark and light modes both hold if the app has them. Respect `agent.never` in `verify/verify.yml`.

5. **Turn what you did into a scenario.** Write `verify/scenarios/<slug>.yml` (`scenario/v1` — see any existing file for the step vocabulary) that replays the path you took, with `expect:` steps at each proof point and `screenshot:` steps where the images matter. Re-run it: `node verify/runner.mjs --only <slug>`. It must pass before you cite it.

6. **Write the evidence README.** `test/evidence/<slug>/README.md` — one paragraph on what the user can do and what the images prove (before/after for a fix; numbers over adjectives), a table of images, a "Not covered" section that says where the edge of this proof is. The runner scaffolds the file; you fill it.

7. **Link it back.** In `features/features.yml`, add the scenario to `scenarios:` and the bundle to `evidence:` for each feature id; run `node verify/runner.mjs --feature <ID> --stamp --by agent` to record `verified:`. Validate with `python3 <hub>/tools/features_index.py check .` when the hub is available (CI runs it regardless).

8. **Report honestly.** Your summary states, per feature: PASS / FAIL / NOT VERIFIED, with the scenario id and the evidence dir. "Could not start the app: <reason>" or "Verified on desktop only, mobile nav did not open" are first-class results. Never describe behaviour you did not observe in the browser. If the change is not user-visible, say so and recommend the `skip-evidence` label instead of manufacturing evidence.

## Definition of done

- [ ] Every touched feature has an entry in `features/features.yml` (`surface`, `link`, `docs`).
- [ ] A `verify/scenarios/<slug>.yml` replays the user path and passes via `verify/runner.mjs`.
- [ ] `test/evidence/<slug>/` has screenshots at ≥2 viewports, `report.json`, and a filled README.
- [ ] `features.yml` links `scenarios:` + `evidence:` and carries a fresh `verified:` stamp.
- [ ] The PR body links the evidence README (or carries `skip-evidence` with a reason).
