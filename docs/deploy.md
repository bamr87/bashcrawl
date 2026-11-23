# Deploying the web trainer

> The runbook for production on Azure Static Web Apps: the one-time bootstrap, the secrets and variables by exact name, the first deploy, attaching the custom domain, rollback, the Standard plan, and where the security headers come from.

The web trainer is a static Vite build (`web/dist/`). Production is hosted on [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/overview) (SWA) behind a custom domain; [ADR 0002](adr/0002-host-production-on-azure-static-web-apps.md) records why. GitHub Pages (`.github/workflows/pages.yml`) is untouched and keeps serving its own address as the fallback.

Nothing here knows the production domain. It is one value, the repository variable `VITE_SITE_URL`, and an argument to `infra/azure/cutover.sh`.

## How it works

`.github/workflows/azure-swa.yml` builds the site, uploads it and checks the live result. There are three targets:

| Trigger | SWA environment | GitHub Environment | `VITE_APP_ENV` | Analytics key |
| --- | --- | --- | --- | --- |
| Pull request (opened, pushed to, reopened) | `pr<N>`, deleted when the pull request closes | `preview` | `preview` | none, ever |
| Push to `main` | `staging` | `staging` | `staging` | `VITE_POSTHOG_KEY_STAGING`, if set |
| A release, or a manual run with a `ref` | production | `production` | `production` | `VITE_POSTHOG_KEY` |

Every run does the same four things:

1. **Build.** `make web-test`, the same step `pages.yml` runs (Python 3.12 with pyyaml, Node 24, `npm install --no-audit --no-fund`, no lockfile).
2. **Configure.** `make swa-config` writes `staticwebapp.config.json` and `404.html` into `web/dist/` (see [Security headers and caching](#security-headers-and-caching)).
3. **Deploy.** `azure/login` exchanges the job's OIDC token for Azure credentials, the job reads the app's deployment token from Azure (masked, never stored) and the SWA CLI uploads the prebuilt folder. Azure builds nothing.
4. **Verify.** `scripts/verify_deploy.py` asks the live site for `/healthz` (must answer `{"status": "ok"}`) and `/version` (must report the commit that was built), retrying for up to five minutes while the deploy reaches the edge. The run is green only after that passes.

Pull-request and `main` runs start only when a file that reaches the site changed (the `paths` list in the workflow). A release always deploys.

A release deploys because `.github/workflows/release.yml` dispatches the workflow for the tag release-please just created. A release made with the default `GITHUB_TOKEN` fires no `release:` event, so nothing waits for one; a `workflow_dispatch` is one of the few events that token may raise. The deploy is a run of its own, so a production deploy waiting for your approval holds nothing else up: release-please keeps running on later pushes to `main`.

Until `AZURE_CLIENT_ID` is set the workflow skips itself with a notice, so it is safe to merge before Azure exists.

## One-time bootstrap

You need the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and an account that may create resource groups, Static Web Apps and Entra applications; `python3`; and `gh` if you want the script to ask GitHub for the repository's exact OIDC subject prefix.

```bash
az login
./infra/azure/bootstrap.sh
```

It creates, or reuses, the resource group `rg-bashcrawl-prod`, the Entra application `sp-bashcrawl-swa-github` with its service principal, four federated credentials, a Contributor role assignment on the resource group, and the Static Web App `swa-bashcrawl-prod` from `infra/azure/main.bicep` and `parameters.prod.json`. It is safe to run again. It links no repository to the app, stores no token and writes nothing to disk.

The four federated credentials are the four OIDC subjects the workflow's jobs present. A job that names a GitHub Environment presents `repo:bamr87/bashcrawl:environment:<name>`, never the branch ref, so there is one each for `preview`, `staging` and `production`. The job that deletes a closed pull request's preview names no environment and presents `repo:bamr87/bashcrawl:pull_request`.

The region, the app's name and its plan come from `infra/azure/parameters.prod.json`. The resource group, repository and Entra application names can be overridden with `AZURE_RESOURCE_GROUP`, `GITHUB_REPOSITORY` and `ENTRA_APP_NAME`.

## Secrets and variables

The script ends by printing the commands for the first two tables. Set everything at **repository** level (Settings → Secrets and variables → Actions): the job that decides whether Azure is configured runs in no environment, so an environment-level secret would be invisible to it.

Secrets. These are identifiers, not credentials: nothing can be done with them without a token GitHub issues to this repository. They are stored as secrets so logs mask them.

| Secret | Value | Required |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | The Entra application's client id | Yes. While it is unset the workflow skips. |
| `AZURE_TENANT_ID` | The Entra tenant id | Yes |
| `AZURE_SUBSCRIPTION_ID` | The Azure subscription id | Yes |

Variables for Azure. Optional: the workflow already defaults to the names the bootstrap uses.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AZURE_RESOURCE_GROUP` | `rg-bashcrawl-prod` | The resource group that holds the app |
| `AZURE_STATIC_WEB_APP_NAME` | `swa-bashcrawl-prod` | The Static Web App |
| `AZURE_SWA_PREVIEWS` | on | Set to `false` to stop deploying pull-request previews |

Variables for the build. Vite compiles every `VITE_*` value into the JavaScript the browser downloads, so these are public values and must never be secrets. `.env.example` documents the same names for local builds.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_SITE_URL` | production | The canonical origin, for example `https://example.com`: `https`, no trailing slash. The workflow rejects any other shape. Leave it unset until the domain is live. |
| `VITE_POSTHOG_KEY` | production | The PostHog project key. Unset means the production build measures nothing ([analytics.md](analytics.md)). |
| `VITE_POSTHOG_HOST` | every build | The PostHog ingestion host. Defaults to `https://us.i.posthog.com`. An `https` origin that is not a posthog.com host is treated as a reverse proxy and added to the Content-Security-Policy. |
| `VITE_POSTHOG_UI_HOST` | every build | Optional: the PostHog app itself, when the host above is a reverse proxy. |
| `VITE_POSTHOG_KEY_STAGING` | staging | Optional: a separate PostHog project key for staging. Unset means staging measures nothing. |
| `VITE_SITE_URL_STAGING` | staging | Optional: the staging URL the first staging deploy prints, so staging's canonical link names itself. |

`VITE_APP_ENV` is not a variable you set: the workflow passes `production`, `staging` or `preview` itself.

```bash
gh variable set VITE_POSTHOG_KEY --body '<phc_… project key>' --repo bamr87/bashcrawl
gh variable set VITE_SITE_URL --body 'https://<your-domain>' --repo bamr87/bashcrawl
```

## GitHub Environments

The deploy job runs in a GitHub Environment named after its target. GitHub creates `preview`, `staging` and `production` the first time a job names them, with no protection, so create `production` yourself **before the first release** and give it a reviewer:

```bash
gh api --method PUT repos/bamr87/bashcrawl/environments/production
```

Then, in Settings → Environments → production, add yourself under **Required reviewers**, and under **Deployment branches and tags** allow only `main`. A production deploy then waits for your approval, and a manual run started from any other branch is refused.

One limit to know: Azure sees a single identity. The federated credentials for `preview`, `staging` and `production` all belong to the same Entra application, and a Static Web App has one deployment token for all of its environments. So the reviewers gate the normal path, not a pull request that rewrites the workflow: anyone who can push a branch to this repository can reach the app. Forks cannot (they get no secrets and no OIDC token). Keep write access to the repository as tight as you would keep production.

## First deploy

1. Merge the pipeline. Without `AZURE_CLIENT_ID` it skips.
2. Run `./infra/azure/bootstrap.sh` and the `gh secret set` commands it prints.
3. Create the `production` environment and its reviewer (above).
4. Set `VITE_POSTHOG_KEY` if production should measure usage. Leave `VITE_SITE_URL` unset for now.
5. Deploy production by hand, from `main`, and approve it when GitHub asks:

    ```bash
    gh workflow run azure-swa.yml --repo bamr87/bashcrawl -f ref=main
    ```

6. Read the run's summary: it names the URL (`https://<generated-name>.azurestaticapps.net`) and the commit it verified. Open it and play.

From then on every push to `main` that changes the site deploys `staging`, every such pull request gets a preview and a comment with its URL, and every release deploys production after your approval.

## Attach the custom domain

Do this after the default hostname has been checked. The script takes the domain as an argument or from `SITE_DOMAIN`, attaches it in Azure and prints the DNS records Azure asks for. It changes no DNS: you create the records at your DNS provider.

```bash
./infra/azure/cutover.sh example.com                    # www.example.com and example.com
./infra/azure/cutover.sh --www-only example.com
./infra/azure/cutover.sh --apex-only example.com
./infra/azure/cutover.sh --subdomain play.example.com   # exactly that host
```

| Host | Record | Value | How Azure validates it |
| --- | --- | --- | --- |
| A subdomain (`www` included) | `CNAME` | the app's default hostname | By looking up the `CNAME`, so the record must resolve **before** the host can be attached. |
| The apex | `TXT` at `@` | the token the script prints | By the `TXT` record. Azure generates the token; the script fetches it. |
| The apex | `ALIAS`, `ANAME` or a flattened `CNAME` at `@` | the app's default hostname | This one carries the traffic. |

Run the script, create the records, and run it again until every host reports `Ready`: the first run for a subdomain usually ends with "Not attached yet", because the `CNAME` does not resolve yet. Azure issues the TLS certificate itself once a host validates. Apex changes can take up to 72 hours to propagate.

If your DNS provider offers none of `ALIAS`, `ANAME` or `CNAME` flattening, either forward the apex to `www` at the registrar, or use an `A` record to the app's `stableInboundIP` (Azure portal → the app → JSON View). An `A` record reaches a single regional host instead of the global edge, so prefer the other two.

The Free plan allows two custom domains per app: `www` and the apex use both.

When the host answers over `https`, check it the way the workflow does:

```bash
make deploy-verify URL=https://example.com ARGS=--swa
```

## Make it the default host

1. Name the canonical origin, once: `gh variable set VITE_SITE_URL --body 'https://example.com' --repo bamr87/bashcrawl`. Choose the apex or `www`, not both.
2. Deploy production again so the build carries it (canonical link, `robots.txt`, sitemap): `gh workflow run azure-swa.yml --repo bamr87/bashcrawl -f ref=<latest release tag>`.
3. In the Azure portal, open the app → **Custom domains**, select that host and choose **Set default**. Requests for the app's other hostnames, the generated `azurestaticapps.net` one included, are then redirected to it. This step has no documented CLI command.

The workflow keeps verifying production through the generated hostname. Once a default host is set that request is redirected, and the check follows the redirect.

GitHub Pages is not changed by any of this. Retiring `pages.yml`, and pointing the README and the feature catalog at the new address, is a separate change to make once the domain has been live for a while.

## Rollback

Deploy the previous release tag. This is the same workflow that shipped it:

```bash
gh workflow run azure-swa.yml --repo bamr87/bashcrawl -f ref=v0.2.1
```

The run checks out that tag, builds it, deploys it to production after your approval, and verifies that `/version` reports that tag's commit. Two things to know. The build is repeated, not replayed: the repository commits no lockfile, so a rebuilt tag gets today's dependencies. And a tag from before this pipeline existed has no `make swa-config` and cannot be deployed this way.

To take a bad pull-request preview down, close the pull request, or delete it by hand:

```bash
az staticwebapp environment list --name swa-bashcrawl-prod --resource-group rg-bashcrawl-prod --output table
az staticwebapp environment delete --name swa-bashcrawl-prod --resource-group rg-bashcrawl-prod --environment-name pr123 --yes
```

## The Standard plan: why and how

The app starts on the **Free** plan, which Microsoft describes as "for personal projects". What that means here, from Microsoft's [plans](https://learn.microsoft.com/azure/static-web-apps/plans) and [quotas](https://learn.microsoft.com/azure/static-web-apps/quotas) pages as read on 2026-11-19 (check them before deciding: quotas move):

| | Free | Standard |
| --- | --- | --- |
| Pre-production environments per app | 3 | 10 |
| Custom domains per app | 2 | 5 or 6 (the two pages disagree) |
| Bandwidth per month | 100 GB, and no way to buy more | 100 GB included, then billed per GB |
| Size of one environment | 250 MB | 500 MB |
| Service level agreement | none | yes |
| Private endpoints, custom authentication providers | no | yes |

The site itself is far inside the size limits (about 2.3 MB in 57 files). The limit that bites first is the environment count: `staging` is a named pre-production environment and counts as one of the three, so only **two pull requests can have a preview at once** on Free. The third preview deploy fails until one closes. Move to Standard when that gets in the way, when traffic approaches 100 GB a month, when you need more hostnames than two, or when you want an SLA behind the site. If previews are the only problem, `gh variable set AZURE_SWA_PREVIEWS --body false` turns them off instead.

To move, change the plan in the file the infrastructure is deployed from, so the next bootstrap does not undo it:

1. In `infra/azure/parameters.prod.json`, set `"sku": { "value": "Standard" }` and commit it.
2. Run `./infra/azure/bootstrap.sh` again. Everything else already exists, so the only change is the plan.

Changing it in the Azure portal (the app → Settings → Hosting plan) works too, but then also change the file, or the next bootstrap run sets it back to Free. Moving back to Free is the same edit in reverse.

## Security headers and caching

GitHub Pages cannot send response headers; this is a large part of why production moved. On Azure every response carries the headers in `staticwebapp.config.json`, and that file is **generated, never committed**: `scripts/write_swa_config.py` writes it into `web/dist/` after the build (`make swa-config`).

It is generated because the Content-Security-Policy allows inline scripts only by hash. The script reads the built `index.html`, computes a `'sha256-…'` for every inline `<script>` it finds (today there is one, the theme-before-paint script) and puts them in `script-src`. Change an inline script and the next build's policy changes with it; there is no list to keep in step by hand.

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; scripts from this site and the hashed inline scripts only (the analytics library is bundled into the app, so no third party may serve a script); connections to this site and `https://*.posthog.com`; inline styles allowed; images from this site, `data:`, `blob:` and PostHog; no plugins, no framing, no off-site form posts; `upgrade-insecure-requests`. A reverse proxy named by `VITE_POSTHOG_HOST` is added to `connect-src`. |
| `Strict-Transport-Security` | `max-age=31536000`. `includeSubDomains` and `preload` are left out on purpose: they bind every subdomain of a domain that is not chosen yet, and are hard to take back. Add them in `write_swa_config.py` once that is known to be safe. |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Camera, microphone, geolocation, sensors, payment, USB, MIDI and screen capture are denied. |
| `X-Robots-Tag` | `noindex, nofollow`, on staging and preview builds only. |

Caching is set by route, and Azure stops at the first route that matches, so their order in the script matters:

| Path | `Cache-Control` | Why |
| --- | --- | --- |
| `/version`, `/healthz` and their `.json` twins | `no-store` | They describe the live build. The extensionless paths are rewritten to the `.json` files so they answer as JSON. |
| `/assets/js/*`, `/data/*` | `no-cache` | The engine's classic scripts and the data bundles keep the same name from build to build, so the browser must revalidate them. |
| `/assets/*` (everything else) | `public, max-age=31536000, immutable` | Vite's output: the file name carries a content hash. |
| `/`, `/index.html` | `no-cache` | The page names the hashed files, so it must always be fresh. |

An unknown path gets a real `404` with `infra/azure/404.html`. The app routes by hash, so `/` is its only page, and its HTML uses relative URLs that would break at a deeper path: nothing falls back to `index.html`.

To change a header or a rule, edit `scripts/write_swa_config.py` and its tests in `test/unit/test_swa_config.py`. To see what a build would ship:

```bash
make web-bundle swa-config
cat web/dist/staticwebapp.config.json
```

The script reads `VITE_POSTHOG_HOST` and `VITE_APP_ENV` from the process environment, not from `.env` files.

## When something fails

| Symptom | Cause and fix |
| --- | --- |
| The run says "Azure deploy skipped" | `AZURE_CLIENT_ID` is not set at repository level. Run the bootstrap and set the three secrets. |
| `azure/login` fails with "No matching federated identity record found for presented assertion subject …" | The subject in the message has no federated credential. Run `./infra/azure/bootstrap.sh` again: it adds any that are missing. If the subject names an environment the workflow does not use, the workflow and `DEPLOY_ENVIRONMENTS` in the script have drifted (`test/integration/test_azure_infra.py` checks that they agree). |
| A preview deploy fails while others exist | The plan's limit on pre-production environments. Close a pull request, delete a stray environment (see [Rollback](#rollback)), turn previews off, or move to Standard. |
| A preview environment outlives its pull request | The close event did not run, which can happen when the pull request no longer touched any file in the workflow's `paths` list when it closed. Delete it by hand (see [Rollback](#rollback)). |
| "Verify the live build" fails on the commit | The live site still serves another build after five minutes. Re-run the job; if it repeats, the upload did not replace the environment, so read the "Deploy the prebuilt site" step's log. |
| "Verify the live build" reports a missing Content-Security-Policy | `staticwebapp.config.json` was not applied. Check that the artifact has it at its root and that the deploy step's log shows Azure accepting it (it rejects a file over 20 KB). |
| The build fails with "VITE_POSTHOG_HOST must be an https:// URL" | The repository variable is not an `https` origin. Fix or delete it. |

## Files

| Path | Role |
| --- | --- |
| `.github/workflows/azure-swa.yml` | Build, deploy, verify; previews, staging, production |
| `.github/workflows/release.yml` | Dispatches the workflow above for the tag, when a release is cut |
| `infra/azure/main.bicep`, `parameters.prod.json` | The Static Web App and its plan |
| `infra/azure/bootstrap.sh` | One-time Azure and Entra setup |
| `infra/azure/cutover.sh` | Attach the custom domain, print the DNS records |
| `infra/azure/404.html` | The 404 page |
| `scripts/write_swa_config.py` | Generates `staticwebapp.config.json` and copies the 404 page |
| `scripts/verify_deploy.py` | The post-deploy check (`make deploy-verify`) |
| `.env.example` | The build variables, for local builds |
