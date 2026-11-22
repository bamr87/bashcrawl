#!/usr/bin/env bash
# Attach the site's custom domain to the Static Web App and print the DNS
# records Azure asks for (docs/deploy.md). It changes NO DNS: you create the
# records at your DNS provider, then run this again until every host is Ready.
#
# The domain is an argument (or SITE_DOMAIN); nothing here knows it otherwise.
#
# Usage:
#   az login
#   ./infra/azure/cutover.sh example.com               # www.example.com and example.com
#   ./infra/azure/cutover.sh --www-only example.com    # www.example.com
#   ./infra/azure/cutover.sh --apex-only example.com   # example.com
#   ./infra/azure/cutover.sh --subdomain play.example.com   # exactly that host
#   SITE_DOMAIN=example.com ./infra/azure/cutover.sh
#
# A subdomain (www included) is validated by its CNAME, so that record must
# resolve before Azure will attach it. The apex is validated by a TXT record
# whose value Azure generates here; it then needs an ALIAS/ANAME (or CNAME
# flattening) to the app's default hostname. Run after the default hostname
# has been checked (make deploy-verify URL=https://<default-hostname>).
#
# Optional environment:
#   SITE_DOMAIN                 the domain, when it is not an argument
#   AZURE_RESOURCE_GROUP        default rg-bashcrawl-prod
#   AZURE_STATIC_WEB_APP_NAME   default swa-bashcrawl-prod

set -euo pipefail

RG_NAME="${AZURE_RESOURCE_GROUP:-rg-bashcrawl-prod}"
SWA_NAME="${AZURE_STATIC_WEB_APP_NAME:-swa-bashcrawl-prod}"
DOMAIN="${SITE_DOMAIN:-}"
MODE="both"
PENDING=0

usage() {
  cat <<'USAGE'
Usage: ./infra/azure/cutover.sh [--www-only | --apex-only | --subdomain] <domain>

Attach a custom domain to the Static Web App and print the DNS records Azure
asks for. Changes no DNS. Safe to run again.

  <domain>        the registered domain, e.g. example.com (or set SITE_DOMAIN)
  (no option)     attach www.<domain> and <domain>
  --www-only      attach www.<domain> only
  --apex-only     attach <domain> only
  --subdomain     attach exactly <domain>, a subdomain such as play.example.com

Environment: SITE_DOMAIN, AZURE_RESOURCE_GROUP, AZURE_STATIC_WEB_APP_NAME.
Run `az login` first. Runbook: docs/deploy.md.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --www-only) MODE="www" ;;
    --apex-only) MODE="apex" ;;
    --subdomain) MODE="subdomain" ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *) DOMAIN="$1" ;;
  esac
  shift
done

# Accept a pasted URL: drop the scheme, any path and upper case.
DOMAIN="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%%/*}"
if [[ -z "$DOMAIN" ]]; then
  echo "No domain given: pass it as an argument or set SITE_DOMAIN." >&2
  usage >&2
  exit 2
fi
HOSTNAME_RE='^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
if [[ ! "$DOMAIN" =~ $HOSTNAME_RE ]]; then
  echo "Not a domain name: ${DOMAIN}" >&2
  exit 2
fi
if [[ "$MODE" != "subdomain" && "$DOMAIN" == www.* ]]; then
  DOMAIN="${DOMAIN#www.}"
  echo "Reading that as the domain ${DOMAIN} (www is attached as its subdomain)."
fi

if ! command -v az >/dev/null 2>&1; then
  echo "az CLI is required. Install: https://learn.microsoft.com/cli/azure/install-azure-cli" >&2
  exit 1
fi
if ! az account show >/dev/null 2>&1; then
  echo "Not logged in. Run: az login" >&2
  exit 1
fi

DEFAULT_HOSTNAME="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG_NAME" --query defaultHostname --output tsv)"
if [[ -z "$DEFAULT_HOSTNAME" ]]; then
  echo "Static Web App ${SWA_NAME} not found in ${RG_NAME}. Run ./infra/azure/bootstrap.sh first." >&2
  exit 1
fi
echo "Static Web App:   ${SWA_NAME} (${RG_NAME})"
echo "Default hostname: ${DEFAULT_HOSTNAME}"
echo

# "" when the host is not attached, else Azure's status for it (Ready,
# Validating, Failed, …).
host_status() {
  local status
  status="$(az staticwebapp hostname show --name "$SWA_NAME" --resource-group "$RG_NAME" --hostname "$1" --query status --output tsv 2>/dev/null || true)"
  if [[ "$status" == "None" ]]; then
    status=""
  fi
  printf '%s' "$status"
}

# A subdomain: Azure validates it by looking up its CNAME.
attach_cname() {
  local host="$1"
  local status
  echo "== ${host} =="
  echo "DNS record (create it at your DNS provider):"
  echo "  CNAME  ${host}.  ->  ${DEFAULT_HOSTNAME}."
  status="$(host_status "$host")"
  if [[ "$status" == "Ready" ]]; then
    echo "Already attached and Ready."
  elif az staticwebapp hostname set --name "$SWA_NAME" --resource-group "$RG_NAME" --hostname "$host" --output none; then
    echo "Attached: Azure saw the CNAME and is issuing the certificate."
  else
    PENDING=1
    echo "Not attached yet: Azure could not validate the CNAME. Create the record,"
    echo "wait until it resolves (dig +short CNAME ${host}), then run this again."
  fi
  echo
}

# The apex: no CNAME is allowed there, so Azure validates a TXT record whose
# value it generates.
attach_apex() {
  local host="$1"
  local status token try
  echo "== ${host} =="
  status="$(host_status "$host")"
  if [[ "$status" == "Ready" ]]; then
    echo "Already attached and Ready."
    echo "DNS record that serves it (keep it):"
    echo "  ALIAS  ${host}.  ->  ${DEFAULT_HOSTNAME}.   (ALIAS, ANAME or CNAME flattening)"
    echo
    return 0
  fi
  if [[ -z "$status" || "$status" == "Failed" ]]; then
    az staticwebapp hostname set --name "$SWA_NAME" --resource-group "$RG_NAME" --hostname "$host" \
      --validation-method dns-txt-token --no-wait --output none
    echo "Asked Azure to validate ${host} by TXT record."
  else
    echo "Validation already requested (status: ${status})."
  fi
  PENDING=1

  token=""
  try=0
  while [[ $try -lt 12 ]]; do
    token="$(az staticwebapp hostname show --name "$SWA_NAME" --resource-group "$RG_NAME" --hostname "$host" --query validationToken --output tsv 2>/dev/null || true)"
    if [[ -n "$token" && "$token" != "None" ]]; then
      break
    fi
    token=""
    try=$((try + 1))
    sleep 5
  done

  echo "DNS records (create both at your DNS provider):"
  if [[ -n "$token" ]]; then
    echo "  TXT    ${host}.  (host @)  ${token}"
  else
    echo "  TXT    ${host}.  (host @)  <not generated yet: run this again in a minute>"
  fi
  echo "  ALIAS  ${host}.  (host @)  ->  ${DEFAULT_HOSTNAME}.   (ALIAS, ANAME or CNAME flattening)"
  echo "The TXT record proves ownership; the ALIAS record sends the traffic."
  echo "If your DNS provider offers none of ALIAS, ANAME or CNAME flattening, forward"
  echo "the apex to www instead, or use an A record to the app's stableInboundIP"
  echo "(Azure portal > the app > JSON View): a single regional host, not the global edge."
  echo
}

case "$MODE" in
  both)
    attach_cname "www.${DOMAIN}"
    attach_apex "$DOMAIN"
    ;;
  www) attach_cname "www.${DOMAIN}" ;;
  apex) attach_apex "$DOMAIN" ;;
  subdomain) attach_cname "$DOMAIN" ;;
esac

echo "Custom hostnames now on ${SWA_NAME}:"
az staticwebapp hostname list --name "$SWA_NAME" --resource-group "$RG_NAME" --output table
echo

if [[ "$PENDING" -eq 1 ]]; then
  echo "Not finished: create the records above, then run this again until every host is Ready."
else
  echo "Every requested host is attached."
fi
echo "This script changed no DNS. GitHub Pages is untouched and keeps serving at its own address."
echo
echo "Once the host answers over https:"
echo "  make deploy-verify URL=https://<host> ARGS=--swa"
echo "  gh variable set VITE_SITE_URL --body 'https://<host>'   # the one canonical origin, no trailing slash"
echo "  then redeploy production so the build carries it, and make that host the default"
echo "  (Azure portal > the app > Custom domains > select it > Set default)."
