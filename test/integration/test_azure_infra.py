"""infra/azure/bootstrap.sh and cutover.sh, run against a fake `az`.

Neither script can be exercised for real without an Azure subscription, so a
stand-in `az` (and `gh`) on PATH records every call and answers from a small
JSON state file. What this proves is the scripts' own logic: which resources
and federated credentials bootstrap asks for, that a second run asks for
nothing new, and which hostnames and DNS records cutover works out for a
domain. It proves nothing about Azure's side of those calls.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

pytestmark = [pytest.mark.integration, pytest.mark.bash]

ROOT = Path(__file__).resolve().parents[2]
INFRA = ROOT / "infra" / "azure"
WORKFLOW = ROOT / ".github" / "workflows" / "azure-swa.yml"

DEFAULT_HOST = "calm-rock-0a1b2c3d4.4.azurestaticapps.net"

FAKE_AZ = r"""
import json, os, re, sys

args = sys.argv[1:]
line = " ".join(args)
state_file = os.environ["FAKE_AZ_STATE"]
with open(state_file, encoding="utf-8") as handle:
    state = json.load(handle)
state["calls"].append(line)


def save():
    with open(state_file, "w", encoding="utf-8") as handle:
        json.dump(state, handle)


def option(name):
    return args[args.index(name) + 1] if name in args else ""


def done(out="", code=0):
    save()
    if out:
        print(out)
    sys.exit(code)


if args[:2] == ["account", "show"]:
    if not state["logged_in"]:
        done(code=1)
    query = option("--query")
    done({"id": "sub-0001", "tenantId": "tenant-0002"}.get(query, "{}"))
if args[:2] == ["group", "create"]:
    state["created"].append("group " + option("--name"))
    done()
if args[:2] == ["group", "show"]:
    done("/subscriptions/sub-0001/resourceGroups/" + option("--name"))
if args[:3] == ["ad", "app", "list"]:
    done(state["app"])
if args[:3] == ["ad", "app", "create"]:
    state["app"] = "app-1111"
    state["created"].append("app " + option("--display-name"))
    done(state["app"])
if args[:3] == ["ad", "sp", "list"]:
    done(state["sp"])
if args[:3] == ["ad", "sp", "create"]:
    state["sp"] = "sp-2222"
    state["created"].append("sp")
    done(state["sp"])
if args[:4] == ["ad", "app", "federated-credential", "list"]:
    subject = re.search(r"subject=='([^']*)'", option("--query")).group(1)
    done(state["credentials"].get(subject, ""))
if args[:4] == ["ad", "app", "federated-credential", "create"]:
    params = json.loads(option("--parameters"))
    assert params["issuer"] == "https://token.actions.githubusercontent.com", params
    assert params["audiences"] == ["api://AzureADTokenExchange"], params
    assert re.fullmatch(r"[A-Za-z0-9-]+", params["name"]), params["name"]
    state["credentials"][params["subject"]] = params["name"]
    state["created"].append("credential " + params["subject"])
    done("{}")
if args[:3] == ["role", "assignment", "list"]:
    done(state["role"])
if args[:3] == ["role", "assignment", "create"]:
    state["role"] = option("--role") + " on " + option("--scope")
    state["created"].append("role")
    done("{}")
if args[:3] == ["deployment", "group", "create"]:
    sent = option("--template-file") + " " + option("--parameters")
    state["created"].append("deployment " + sent)
    done("{}")
if args[:2] == ["staticwebapp", "show"]:
    done(state["default_host"])
if args[:3] == ["staticwebapp", "hostname", "show"]:
    host = option("--hostname")
    if host not in state["hosts"]:
        done(code=3)
    if option("--query") == "validationToken":
        done(state["token"])
    done(state["hosts"][host])
if args[:3] == ["staticwebapp", "hostname", "set"]:
    host = option("--hostname")
    if option("--validation-method") == "dns-txt-token":
        assert "--no-wait" in args, "TXT validation must not block on DNS"
        state["hosts"][host] = "Validating"
        done()
    if host in state["resolving"]:
        state["hosts"][host] = "Ready"
        done()
    sys.stderr.write("CNAME Record is invalid.\n")
    done(code=1)
if args[:3] == ["staticwebapp", "hostname", "list"]:
    done("\n".join(f"{host}  {status}" for host, status in state["hosts"].items()))
sys.stderr.write("fake az: unexpected call: " + line + "\n")
done(code=64)
"""


class Azure:
    """The fake cloud: a stub `az`/`gh`/`sleep` on PATH and the state they share."""

    def __init__(self, tmp_path: Path, sub_prefix: str = "repo:bamr87/bashcrawl") -> None:
        self.bin = tmp_path / "bin"
        self.bin.mkdir()
        self.work = tmp_path / "work"
        self.work.mkdir()
        self.state_file = tmp_path / "azure.json"
        self.write(
            {
                "logged_in": True,
                "app": "",
                "sp": "",
                "role": "",
                "credentials": {},
                "default_host": DEFAULT_HOST,
                "hosts": {},
                "resolving": [],
                "token": "txt-token-abc123",
                "created": [],
                "calls": [],
            }
        )
        (tmp_path / "fake_az.py").write_text(FAKE_AZ, encoding="utf-8")
        self._tool("az", f'exec "{sys.executable}" "{tmp_path / "fake_az.py"}" "$@"')
        self._tool("gh", f'[ "$1" = "api" ] || exit 64\necho "{sub_prefix}"')
        self._tool("sleep", "exit 0")
        self._tool("python3", f'exec "{sys.executable}" "$@"')

    def _tool(self, name: str, body: str) -> None:
        path = self.bin / name
        path.write_text(f"#!/bin/sh\n{body}\n", encoding="utf-8")
        path.chmod(0o755)

    def write(self, state: dict) -> None:
        self.state_file.write_text(json.dumps(state), encoding="utf-8")

    @property
    def state(self) -> dict:
        return json.loads(self.state_file.read_text(encoding="utf-8"))

    def set(self, **changes: object) -> None:
        self.write({**self.state, **changes})

    def run(
        self, script: str, *args: str, env: dict[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        clean = {"PATH": f"{self.bin}:/usr/bin:/bin", "FAKE_AZ_STATE": str(self.state_file)}
        return subprocess.run(
            ["bash", str(INFRA / script), *args],
            cwd=self.work,
            env={**clean, **(env or {})},
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=60,
            check=False,
        )

    def calls(self, prefix: str) -> list[str]:
        return [call for call in self.state["calls"] if call.startswith(prefix)]


@pytest.fixture
def azure(tmp_path: Path) -> Azure:
    return Azure(tmp_path)


# ── bootstrap.sh ───────────────────────────────────────────────────────────

SUBJECTS = [
    "repo:bamr87/bashcrawl:environment:preview",
    "repo:bamr87/bashcrawl:environment:staging",
    "repo:bamr87/bashcrawl:environment:production",
    "repo:bamr87/bashcrawl:pull_request",
]


def test_bootstrap_creates_everything_the_workflow_needs(azure: Azure) -> None:
    result = azure.run("bootstrap.sh")
    assert result.returncode == 0, result.stdout + result.stderr

    params = INFRA / "parameters.prod.json"
    assert azure.state["created"] == [
        "group rg-bashcrawl-prod",
        "app sp-bashcrawl-swa-github",
        "sp",
        *[f"credential {subject}" for subject in SUBJECTS],
        "role",
        f"deployment {INFRA / 'main.bicep'} @{params}",
    ]
    assert azure.state["role"] == (
        "Contributor on /subscriptions/sub-0001/resourceGroups/rg-bashcrawl-prod"
    )
    assert f"Default hostname: https://{DEFAULT_HOST}" in result.stdout


def test_bootstrap_prints_the_secrets_and_variables_and_writes_nothing(azure: Azure) -> None:
    result = azure.run("bootstrap.sh")
    assert result.returncode == 0, result.stdout + result.stderr
    for line in (
        "gh secret set AZURE_CLIENT_ID --body 'app-1111' --repo bamr87/bashcrawl",
        "gh secret set AZURE_TENANT_ID --body 'tenant-0002' --repo bamr87/bashcrawl",
        "gh secret set AZURE_SUBSCRIPTION_ID --body 'sub-0001' --repo bamr87/bashcrawl",
        "gh variable set AZURE_RESOURCE_GROUP --body 'rg-bashcrawl-prod' --repo bamr87/bashcrawl",
        "gh variable set AZURE_STATIC_WEB_APP_NAME --body 'swa-bashcrawl-prod' "
        "--repo bamr87/bashcrawl",
        "gh variable set VITE_SITE_URL --body 'https://<your-domain>' --repo bamr87/bashcrawl",
        "gh api --method PUT repos/bamr87/bashcrawl/environments/production",
    ):
        assert line in result.stdout, line
    assert list(azure.work.iterdir()) == [], "bootstrap must write nothing to disk"
    # It never asks for the deployment token: the workflow reads it at deploy time.
    assert azure.calls("staticwebapp secrets") == []


def test_bootstrap_run_again_creates_nothing_new(azure: Azure) -> None:
    assert azure.run("bootstrap.sh").returncode == 0
    first = azure.state["created"]

    again = azure.run("bootstrap.sh")
    assert again.returncode == 0, again.stdout + again.stderr
    # Idempotent by request: the resource group and the Bicep deployment are
    # sent again (Azure reconciles them); nothing in Entra or RBAC is.
    assert azure.state["created"][len(first) :] == [
        "group rg-bashcrawl-prod",
        f"deployment {INFRA / 'main.bicep'} @{INFRA / 'parameters.prod.json'}",
    ]
    assert "Reusing Entra app" in again.stdout
    assert again.stdout.count("already exists") == len(SUBJECTS)
    assert "Contributor already assigned" in again.stdout


def test_bootstrap_uses_the_subject_prefix_github_reports(tmp_path: Path) -> None:
    # A repository with immutable OIDC subjects carries ids in the prefix.
    azure = Azure(tmp_path, sub_prefix="repo:bamr87@11/bashcrawl@22")
    assert azure.run("bootstrap.sh").returncode == 0
    assert sorted(azure.state["credentials"]) == sorted(
        subject.replace("repo:bamr87/bashcrawl", "repo:bamr87@11/bashcrawl@22")
        for subject in SUBJECTS
    )


def test_bootstrap_credentials_match_the_subjects_the_workflow_presents() -> None:
    """A job that names an environment presents `…:environment:<name>`.

    The deploy job takes its environment from the plan job, which names
    exactly three; the job that closes a preview names none, so on a
    pull_request event it presents `…:pull_request`.
    """
    workflow = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    jobs = workflow["jobs"]

    assert jobs["deploy"]["environment"]["name"] == "${{ needs.plan.outputs.environment }}"
    plan = "\n".join(step.get("run", "") for step in jobs["plan"]["steps"])
    planned = set(re.findall(r"^\s*environment=(\w+)$", plan, flags=re.MULTILINE))
    assert planned == {"preview", "staging", "production"}

    logging_in = [
        name
        for name, job in jobs.items()
        if any("azure/login" in step.get("uses", "") for step in job.get("steps", []))
    ]
    assert sorted(logging_in) == ["close-preview", "deploy"]
    assert "environment" not in jobs["close-preview"]

    script = (INFRA / "bootstrap.sh").read_text(encoding="utf-8")
    declared = re.search(r'^DEPLOY_ENVIRONMENTS="([^"]+)"$', script, flags=re.MULTILINE)
    assert declared and set(declared.group(1).split()) == planned
    assert "${SUB_PREFIX}:pull_request" in script


def test_bootstrap_stops_when_not_logged_in(azure: Azure) -> None:
    azure.set(logged_in=False)
    result = azure.run("bootstrap.sh")
    assert result.returncode == 1
    assert "az login" in result.stderr
    assert azure.state["created"] == []


def test_bootstrap_rejects_arguments(azure: Azure) -> None:
    result = azure.run("bootstrap.sh", "--force")
    assert result.returncode == 2 and "Usage:" in result.stderr
    assert azure.state["calls"] == []


# ── cutover.sh ─────────────────────────────────────────────────────────────


def test_cutover_needs_a_domain(azure: Azure) -> None:
    result = azure.run("cutover.sh")
    assert result.returncode == 2
    assert "No domain given" in result.stderr and "Usage:" in result.stderr
    assert azure.state["calls"] == [], "nothing may reach Azure without a domain"


@pytest.mark.parametrize("domain", ["localhost", "exa mple.org", "-x.org", "example..org"])
def test_cutover_rejects_what_is_not_a_domain(azure: Azure, domain: str) -> None:
    result = azure.run("cutover.sh", env={"SITE_DOMAIN": domain})
    assert result.returncode == 2 and "Not a domain name" in result.stderr
    assert azure.state["calls"] == []


def test_cutover_prints_the_records_azure_asks_for(azure: Azure) -> None:
    result = azure.run("cutover.sh", "example.org")
    assert result.returncode == 0, result.stdout + result.stderr
    out = result.stdout

    # www: validated by its CNAME, which does not resolve yet.
    assert f"CNAME  www.example.org.  ->  {DEFAULT_HOST}." in out
    assert "Not attached yet" in out
    # apex: validated by the TXT value Azure generated, served through an ALIAS.
    assert "TXT    example.org.  (host @)  txt-token-abc123" in out
    assert f"ALIAS  example.org.  (host @)  ->  {DEFAULT_HOST}." in out
    assert "Not finished" in out and "changed no DNS" in out

    sets = azure.calls("staticwebapp hostname set")
    assert len(sets) == 2
    assert "--hostname www.example.org" in sets[0] and "dns-txt-token" not in sets[0]
    assert "--hostname example.org --validation-method dns-txt-token --no-wait" in sets[1]
    # It reads and attaches hostnames; it never edits a DNS zone.
    assert all(call.startswith(("account", "staticwebapp")) for call in azure.state["calls"])


def test_cutover_attaches_once_the_cname_resolves(azure: Azure) -> None:
    azure.set(resolving=["www.example.org"])
    result = azure.run("cutover.sh", "--www-only", "example.org")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Attached: Azure saw the CNAME" in result.stdout
    assert "Every requested host is attached." in result.stdout
    assert azure.state["hosts"] == {"www.example.org": "Ready"}


def test_cutover_reads_the_domain_from_the_environment_and_tidies_it(azure: Azure) -> None:
    result = azure.run("cutover.sh", "--apex-only", env={"SITE_DOMAIN": "HTTPS://WWW.Example.org/"})
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Reading that as the domain example.org" in result.stdout
    assert azure.state["hosts"] == {"example.org": "Validating"}
    assert "www.example.org" not in " ".join(azure.calls("staticwebapp hostname"))


def test_cutover_attaches_exactly_one_subdomain(azure: Azure) -> None:
    azure.set(resolving=["play.example.org"])
    result = azure.run("cutover.sh", "--subdomain", "play.example.org")
    assert result.returncode == 0, result.stdout + result.stderr
    assert f"CNAME  play.example.org.  ->  {DEFAULT_HOST}." in result.stdout
    assert azure.state["hosts"] == {"play.example.org": "Ready"}


def test_cutover_run_again_leaves_ready_hosts_alone(azure: Azure) -> None:
    azure.set(hosts={"www.example.org": "Ready", "example.org": "Ready"})
    result = azure.run("cutover.sh", "example.org")
    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.count("Already attached and Ready.") == 2
    assert azure.calls("staticwebapp hostname set") == []
    assert "Every requested host is attached." in result.stdout


def test_cutover_shows_the_token_of_a_validation_already_under_way(azure: Azure) -> None:
    azure.set(hosts={"example.org": "Validating"})
    result = azure.run("cutover.sh", "--apex-only", "example.org")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Validation already requested (status: Validating)." in result.stdout
    assert "txt-token-abc123" in result.stdout
    assert azure.calls("staticwebapp hostname set") == []


def test_no_infra_file_names_a_real_domain() -> None:
    """The domain is one config value: an argument here, VITE_SITE_URL in CI."""
    allowed = re.compile(
        r"example\.(com|org)|azurestaticapps\.net|posthog\.com|microsoft\.com|"
        r"githubusercontent\.com|management\.azure\.com|azure\.com|github\.com"
    )
    hostname = re.compile(r"\b(?:[a-z0-9-]+\.)+(?:com|org|net|dev|io|app)\b")
    for path in [*sorted(INFRA.iterdir()), WORKFLOW]:
        if path.suffix == ".html":
            continue
        for found in hostname.findall(path.read_text(encoding="utf-8")):
            assert allowed.search(found), f"{path.name} hard-codes {found}"


def test_infra_scripts_are_executable() -> None:
    for name in ("bootstrap.sh", "cutover.sh"):
        assert os.access(INFRA / name, os.X_OK), f"{name} must be chmod +x"
