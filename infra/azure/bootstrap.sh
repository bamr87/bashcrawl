#!/usr/bin/env bash
# One-time Azure bootstrap for bashcrawl's production host (docs/deploy.md).
#
# Creates, or reuses, everything .github/workflows/azure-swa.yml needs:
#   - the resource group
#   - an Entra application and service principal for GitHub Actions, with one
#     federated credential per OIDC subject the workflow's jobs present
#   - Contributor on the resource group for that service principal
#   - the Static Web App itself (main.bicep + parameters.prod.json)
#
# Safe to run again: every step checks before it creates. It links no GitHub
# repository to the Static Web App (that would make Azure generate its own
# token-based workflow), stores no deployment token, and writes nothing to
# disk. It ends by printing the `gh secret set` / `gh variable set` lines for
# you to run.
#
# Prerequisites: az CLI, logged in with rights to create resource groups,
# Static Web Apps and Entra applications; python3. Optional: gh, to ask
# GitHub for the repository's exact OIDC subject prefix.
#
# Usage:
#   az login
#   ./infra/azure/bootstrap.sh
#
# Optional environment overrides:
#   AZURE_RESOURCE_GROUP   default rg-bashcrawl-prod
#   GITHUB_REPOSITORY      default bamr87/bashcrawl
#   ENTRA_APP_NAME         default sp-bashcrawl-swa-github
#   DEPLOYMENT_NAME        default swa-bashcrawl-prod
# The region, the Static Web App's name and its SKU come from
# parameters.prod.json: edit that file, then run this again.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARAM_FILE="${ROOT}/parameters.prod.json"
BICEP_FILE="${ROOT}/main.bicep"

RG_NAME="${AZURE_RESOURCE_GROUP:-rg-bashcrawl-prod}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-bamr87/bashcrawl}"
ENTRA_APP_NAME="${ENTRA_APP_NAME:-sp-bashcrawl-swa-github}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-swa-bashcrawl-prod}"

# The GitHub Environments the workflow's deploy job runs in. A job that names
# an environment presents "…:environment:<name>" as its OIDC subject, never
# the branch ref, so each one needs its own federated credential.
DEPLOY_ENVIRONMENTS="preview staging production"

usage() {
  cat <<'USAGE'
Usage: ./infra/azure/bootstrap.sh

One-time (and re-runnable) Azure setup for bashcrawl's production host:
resource group, Entra app with GitHub OIDC federated credentials, role
assignment and the Static Web App. Run `az login` first. Prints the GitHub
secrets and variables to set; writes nothing to disk.

Environment overrides: AZURE_RESOURCE_GROUP, GITHUB_REPOSITORY,
ENTRA_APP_NAME, DEPLOYMENT_NAME. Region, app name and SKU:
infra/azure/parameters.prod.json. Runbook: docs/deploy.md.
USAGE
}

case "${1:-}" in
  "") ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown argument: $1" >&2
    usage >&2
    exit 2
    ;;
esac

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required. $2" >&2
    exit 1
  fi
}

param_value() {
  python3 - "$PARAM_FILE" "$1" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    print(json.load(handle)["parameters"][sys.argv[2]]["value"])
PY
}

ensure_fed_cred() {
  local app_id="$1"
  local cred_name="$2"
  local subject="$3"
  local existing params
  # Match on the subject, not the name: a credential left over under another
  # name must not hide the fact that this subject is already trusted.
  existing="$(az ad app federated-credential list --id "$app_id" --query "[?subject=='${subject}'].name" --output tsv 2>/dev/null || true)"
  if [[ -n "$existing" ]]; then
    echo "Federated credential for ${subject} already exists (${existing})."
    return 0
  fi
  params="$(printf '{"name":"%s","issuer":"https://token.actions.githubusercontent.com","subject":"%s","description":"GitHub Actions OIDC for %s","audiences":["api://AzureADTokenExchange"]}' \
    "$cred_name" "$subject" "$GITHUB_REPOSITORY")"
  az ad app federated-credential create --id "$app_id" --parameters "$params" >/dev/null
  echo "Created federated credential ${cred_name} for ${subject}."
}

need az "Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
need python3 "It reads parameters.prod.json."
if ! az account show >/dev/null 2>&1; then
  echo "Not logged in. Run: az login" >&2
  exit 1
fi

LOCATION="$(param_value location)"
SWA_NAME="$(param_value staticWebAppName)"
SWA_SKU="$(param_value sku)"

SUBSCRIPTION_ID="$(az account show --query id --output tsv)"
TENANT_ID="$(az account show --query tenantId --output tsv)"
echo "Subscription:   ${SUBSCRIPTION_ID}"
echo "Tenant:         ${TENANT_ID}"
echo "Resource group: ${RG_NAME} (${LOCATION})"
echo "Static Web App: ${SWA_NAME} (${SWA_SKU})"
echo "GitHub repo:    ${GITHUB_REPOSITORY}"
echo

az group create --name "$RG_NAME" --location "$LOCATION" --tags project=bashcrawl env=prod >/dev/null
echo "Resource group ready."

APP_ID="$(az ad app list --display-name "$ENTRA_APP_NAME" --query "[0].appId" --output tsv)"
if [[ -z "$APP_ID" ]]; then
  APP_ID="$(az ad app create --display-name "$ENTRA_APP_NAME" --query appId --output tsv)"
  echo "Created Entra app ${ENTRA_APP_NAME} (${APP_ID})."
else
  echo "Reusing Entra app ${ENTRA_APP_NAME} (${APP_ID})."
fi

SP_OID="$(az ad sp list --filter "appId eq '${APP_ID}'" --query "[0].id" --output tsv)"
if [[ -z "$SP_OID" ]]; then
  SP_OID="$(az ad sp create --id "$APP_ID" --query id --output tsv)"
  echo "Created service principal ${SP_OID}."
else
  echo "Reusing service principal ${SP_OID}."
fi

# Credential names may not contain "/" or ".": derive them from the repo name.
CRED_PREFIX="$(basename "$GITHUB_REPOSITORY" | tr '.' '-')"
# The subject must match the token GitHub issues. A repository with immutable
# subjects sends "repo:<owner>@<id>/<repo>@<id>:…" rather than
# "repo:<owner>/<repo>:…"; GitHub reports the exact prefix, so ask it.
SUB_PREFIX=""
if command -v gh >/dev/null 2>&1; then
  SUB_PREFIX="$(gh api "repos/${GITHUB_REPOSITORY}/actions/oidc/customization/sub" --jq '.sub_claim_prefix // empty' 2>/dev/null || true)"
fi
SUB_PREFIX="${SUB_PREFIX:-repo:${GITHUB_REPOSITORY}}"

for env_name in $DEPLOY_ENVIRONMENTS; do
  ensure_fed_cred "$APP_ID" "${CRED_PREFIX}-environment-${env_name}" "${SUB_PREFIX}:environment:${env_name}"
done
# The job that deletes a closed pull request's preview names no environment,
# so on a pull_request event it presents this subject.
ensure_fed_cred "$APP_ID" "${CRED_PREFIX}-pull-request" "${SUB_PREFIX}:pull_request"

RG_ID="$(az group show --name "$RG_NAME" --query id --output tsv)"
EXISTING_ROLE="$(az role assignment list --assignee "$APP_ID" --scope "$RG_ID" --role Contributor --query "[0].id" --output tsv 2>/dev/null || true)"
if [[ -z "$EXISTING_ROLE" ]]; then
  az role assignment create \
    --assignee-object-id "$SP_OID" \
    --assignee-principal-type ServicePrincipal \
    --role Contributor \
    --scope "$RG_ID" >/dev/null
  echo "Assigned Contributor on ${RG_NAME}."
else
  echo "Contributor already assigned on ${RG_NAME}."
fi

az deployment group create \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RG_NAME" \
  --template-file "$BICEP_FILE" \
  --parameters "@${PARAM_FILE}" \
  --query properties.outputs \
  --output json

DEFAULT_HOSTNAME="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG_NAME" --query defaultHostname --output tsv)"

echo
echo "Bootstrap complete. Default hostname: https://${DEFAULT_HOSTNAME}"
echo
echo "1. Add the GitHub Actions secrets (identifiers, kept as secrets so logs mask them):"
echo "  gh secret set AZURE_CLIENT_ID --body '${APP_ID}' --repo ${GITHUB_REPOSITORY}"
echo "  gh secret set AZURE_TENANT_ID --body '${TENANT_ID}' --repo ${GITHUB_REPOSITORY}"
echo "  gh secret set AZURE_SUBSCRIPTION_ID --body '${SUBSCRIPTION_ID}' --repo ${GITHUB_REPOSITORY}"
echo
echo "2. Add the GitHub Actions variables (optional: the workflow defaults to these two names):"
echo "  gh variable set AZURE_RESOURCE_GROUP --body '${RG_NAME}' --repo ${GITHUB_REPOSITORY}"
echo "  gh variable set AZURE_STATIC_WEB_APP_NAME --body '${SWA_NAME}' --repo ${GITHUB_REPOSITORY}"
echo
echo "3. When you have them, the build variables (public values, never secrets):"
echo "  gh variable set VITE_SITE_URL --body 'https://<your-domain>' --repo ${GITHUB_REPOSITORY}"
echo "  gh variable set VITE_POSTHOG_KEY --body '<phc_... project key>' --repo ${GITHUB_REPOSITORY}"
echo "  gh variable set VITE_POSTHOG_HOST --body 'https://us.i.posthog.com' --repo ${GITHUB_REPOSITORY}"
echo
echo "4. Create the production environment and give it a required reviewer BEFORE the first release:"
echo "  gh api --method PUT repos/${GITHUB_REPOSITORY}/environments/production"
echo "  then GitHub > Settings > Environments > production > Required reviewers"
echo
echo "No DNS was touched. Next: push to main (deploys staging), cut a release"
echo "(deploys production to https://${DEFAULT_HOSTNAME}), then attach the"
echo "domain with ./infra/azure/cutover.sh <domain>. Full runbook: docs/deploy.md"
