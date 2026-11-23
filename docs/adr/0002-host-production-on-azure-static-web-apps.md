# ADR 0002 — Host production on Azure Static Web Apps

- **Status**: accepted
- **Date**: 2026-11-19
- **Deciders**: the maintainer (decision already taken); written up by an AI agent
- **Related**: [docs/deploy.md](../deploy.md); bamr87/bamr87 `specs/OPERATIONS.md` UPS-OPS-23, UPS-OPS-41, UPS-OPS-42; the bash-365.com pipeline (`.github/workflows/azure-swa.yml`, `infra/azure/` in that repository)

## Context

The web trainer is a static Vite build, deployed until now only to GitHub Pages at a project path (`bamr87.github.io/bashcrawl`) by `.github/workflows/pages.yml`. Three things about Pages stand in the way of running it as a production site on its own domain:

- **No response headers.** Pages cannot send a `Content-Security-Policy`, `Permissions-Policy` or cache rules. The fleet standard asks for security headers on every HTML response (UPS-OPS-23) and offers `<meta>` tags as the most a Pages site can do, which covers neither `frame-ancestors` nor caching. The site is about to load a third-party analytics library, which is exactly when a real policy matters.
- **No pull-request previews.** A change to the trainer can only be seen on the web after it has merged to `main` and replaced the live site. There is no staging copy either.
- **A soft bandwidth limit.** Pages documents about 100 GB a month as a soft limit, with no way to pay past it.

Pages also serves one site per repository, so "deploy from a tagged release, with a staging copy and a reviewer on production" (UPS-OPS-41) cannot be built on it.

If nothing is decided, the trainer stays at a `github.io` project path with no headers, no previews, and every merge to `main` shipping straight to learners.

## Decision

Production is hosted on **Azure Static Web Apps** behind a custom domain. GitHub Pages stays exactly as it is, as the fallback, until the domain has been cut over and proven.

- `infra/azure/main.bicep` and `parameters.prod.json` define one Static Web App, on the Free plan to begin with; the plan is a parameter (`sku`), and [docs/deploy.md](../deploy.md) says when to move to Standard.
- `.github/workflows/azure-swa.yml` builds with `make web-test`, uploads the prebuilt `web/dist` with the SWA CLI and verifies `/healthz` and `/version` on the live site before it reports success (UPS-OPS-42). Pull requests deploy to a preview environment `pr<N>`, pushes to `main` to `staging`, and a release-please release (or a manual run naming a ref, which is the rollback) to production in a GitHub Environment that can require a reviewer. `release.yml` dispatches the production deploy for the release it just cut, as a run of its own.
- Authentication is GitHub OIDC with Entra federated credentials (`infra/azure/bootstrap.sh`). No deployment token or client secret is stored in GitHub.
- `staticwebapp.config.json` is generated into the build by `scripts/write_swa_config.py`, so the Content-Security-Policy carries a hash for every inline script the build really ships. It is not committed.
- The domain is not chosen yet and is named nowhere in the repository: it is the repository variable `VITE_SITE_URL` and an argument to `infra/azure/cutover.sh`.

## Consequences

**Positive**

- Real response headers: a hash-based Content-Security-Policy, HSTS, `nosniff`, a referrer policy and a permissions policy, plus cache rules that tell hashed files from the engine scripts that keep their names.
- Every pull request that changes the site gets a URL to try it at, and `main` has a staging copy, before anything reaches production.
- Production ships from a release tag, behind a reviewer, and rollback is deploying the previous tag with the same workflow.
- The deploy checks the live build, so "green" means the site answers and is the commit that was built.
- The pipeline is the one bash-365.com already runs, adapted rather than invented: OIDC login, SWA CLI deploy of a prebuilt folder, preview environments with a sticky comment and a close job. Its lesson about deleting preview environments through `az rest` is carried over.

**Negative**

- A second cloud to operate: an Azure subscription, an Entra application and a one-time bootstrap that needs rights in both, where Pages needed none.
- The Free plan is small: three pre-production environments (so two concurrent previews beside `staging`), two custom domains, 100 GB of bandwidth a month with no overage, and no SLA. The bandwidth ceiling is no better than Pages until the app moves to the paid Standard plan.
- Azure sees one identity and one deployment token for every environment of the app, so the reviewer on production gates the normal path, not a branch that rewrites the workflow. The trust boundary is write access to the repository.
- Two hosts exist until Pages is retired, and the README, the PRD and the feature catalog still name the Pages address.
- The bash-365.com precedent proves the deploy half only. On the day this was written its public domain was still answering from GitHub Pages, so attaching a custom domain and making it the default has not been exercised in the fleet.

## Alternatives considered

- **Stay on GitHub Pages** — free and already working, but it cannot send headers, has no previews or staging, and has a soft bandwidth limit with nothing beyond it. Kept as the fallback, not as production.
- **Cloudflare Pages** — it does offer custom headers (a `_headers` file), a preview per branch and generous bandwidth, so it meets the same needs. It was not chosen because the fleet already runs one Azure Static Web Apps pipeline with OIDC and infrastructure as code, and a second hosting vendor would mean a second account, a second way to authenticate from Actions and a second set of scripts to keep.
- **Azure Static Web Apps' own GitHub integration** (a linked repository, the generated workflow, the Oryx build and a stored `AZURE_STATIC_WEB_APPS_API_TOKEN`) — rejected for a long-lived secret in GitHub and a build that Azure, not `make web-test`, would run.

## Supersedes / Superseded by

- Supersedes: none
- Superseded by: none
