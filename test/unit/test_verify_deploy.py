"""Post-deploy verification of /healthz and /version (scripts/verify_deploy.py)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import verify_deploy  # noqa: E402
from verify_deploy import Response  # noqa: E402

SITE = "https://site.example.org"
COMMIT = "0791192c0ffee0791192c0ffee0791192c0ffee0"
JSON = {"content-type": "application/json"}
CSP = {"content-type": "text/html", "content-security-policy": "default-src 'self'"}


def body(payload: object) -> bytes:
    return json.dumps(payload).encode("utf-8")


class Site:
    """A fake deployment: {path: Response}, or a list of them to answer in turn."""

    def __init__(self, **paths: Response | list[Response]) -> None:
        self.paths = {f"/{name}".replace("/root", "/"): answer for name, answer in paths.items()}
        self.asked: list[str] = []

    def __call__(self, url: str, timeout: float) -> Response:
        assert url.startswith(SITE + "/"), url
        path = url[len(SITE) :]
        self.asked.append(path)
        answer = self.paths.get(path, Response(404))
        if isinstance(answer, list):
            return answer.pop(0) if len(answer) > 1 else answer[0]
        return answer


def live(commit: str = COMMIT, headers: dict[str, str] | None = None) -> Site:
    """A healthy Static Web Apps deployment of `commit`."""
    headers = JSON if headers is None else headers
    return Site(
        healthz=Response(200, body({"status": "ok"}), headers),
        version=Response(200, body({"name": "bashcrawl", "commit": commit}), headers),
        root=Response(200, b"<!DOCTYPE html>", CSP),
    )


def run(site: Site, **options: object) -> tuple[bool, list[str], list[float]]:
    lines: list[str] = []
    naps: list[float] = []
    ok = verify_deploy.verify(SITE + "/", get=site, sleep=naps.append, log=lines.append, **options)
    return ok, lines, naps


def test_live_build_is_verified_on_the_first_attempt() -> None:
    site = live()
    ok, lines, naps = run(site, commit=COMMIT, swa=True)
    assert ok and naps == []
    assert site.asked == ["/healthz", "/version", "/"]
    assert lines == [f"verified {SITE}: /healthz is ok, /version reports {COMMIT} (attempt 1)"]


def test_retries_until_the_new_build_has_propagated() -> None:
    stale = Response(200, body({"commit": "aaaaaaa1111111"}), JSON)
    fresh = Response(200, body({"commit": COMMIT}), JSON)
    site = live()
    site.paths["/version"] = [stale, stale, fresh]

    ok, lines, naps = run(site, commit=COMMIT, attempts=5, delay=3.0)
    assert ok and naps == [3.0, 3.0]
    assert "expected" in lines[0] and "aaaaaaa1111111" in lines[0]
    assert lines[-1].endswith("(attempt 3)")


def test_gives_up_when_the_wrong_commit_stays_live() -> None:
    ok, lines, naps = run(live("aaaaaaa1111111"), commit=COMMIT, attempts=3, delay=1.0)
    assert not ok
    assert naps == [1.0, 1.0], "no sleep after the last attempt"
    assert lines[-1] == f"NOT verified: {SITE} still fails after 3 attempt(s)"


@pytest.mark.parametrize(
    ("expected", "actual", "same"),
    [
        (COMMIT, COMMIT, True),
        (COMMIT, COMMIT[:7], True),  # a local build reports git's short SHA
        (COMMIT[:12], COMMIT.upper(), True),
        (COMMIT, "aaaaaaa", False),
        (COMMIT, COMMIT[:6], False),  # too short to mean anything
        (COMMIT, "", False),
        (COMMIT, "unknown", False),
    ],
)
def test_same_commit(expected: str, actual: str, same: bool) -> None:
    assert verify_deploy.same_commit(expected, actual) is same


def test_without_a_commit_any_version_answer_passes() -> None:
    ok, lines, _ = run(live("whatever"))
    assert ok and "/version answers" in lines[0]


@pytest.mark.parametrize(
    ("healthz", "problem"),
    [
        (Response(200, body({"status": "degraded"}), JSON), "status is 'degraded'"),
        (Response(200, body({}), JSON), "status is None"),
        (Response(200, b"<html>not found</html>", JSON), "/healthz: the body is not JSON"),
        (Response(200, body(["ok"]), JSON), "/healthz: the body is not a JSON object"),
        (Response(404, b"", JSON), "/healthz: HTTP 404"),
        (Response(0, b"name resolution failed"), "/healthz: unreachable (name resolution failed)"),
    ],
)
def test_unhealthy_site_is_not_verified(healthz: Response, problem: str) -> None:
    site = live()
    site.paths["/healthz"] = healthz
    found = verify_deploy.problems(SITE, COMMIT, get=site)
    assert len(found) == 1 and problem in found[0]


def test_swa_requires_json_probes_and_a_policy_on_the_page() -> None:
    # What a host without staticwebapp.config.json answers: the extensionless
    # probes as opaque bytes, and a page with no Content-Security-Policy.
    site = live(headers={"content-type": "application/octet-stream"})
    site.paths["/"] = Response(200, b"<!DOCTYPE html>", {"content-type": "text/html"})

    assert verify_deploy.problems(SITE, COMMIT, get=site) == []
    assert verify_deploy.problems(SITE, COMMIT, swa=True, get=site) == [
        "/healthz: content type is application/octet-stream, not JSON",
        "/version: content type is application/octet-stream, not JSON",
        "/: no Content-Security-Policy header (is the config applied?)",
    ]


def test_swa_reports_a_page_that_does_not_load() -> None:
    site = live()
    site.paths["/"] = Response(503)
    assert verify_deploy.problems(SITE, COMMIT, swa=True, get=site) == ["/: HTTP 503"]


def test_cli_exit_status_follows_the_checks(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(verify_deploy, "fetch", live())
    monkeypatch.setattr(verify_deploy.time, "sleep", lambda _: None)

    assert verify_deploy.main([SITE, "--commit", COMMIT, "--swa"]) == 0
    assert capsys.readouterr().out.startswith(f"verified {SITE}: ")

    assert verify_deploy.main([SITE, "--commit", "bbbbbbb2222222", "--attempts", "2"]) == 1
    out = capsys.readouterr().out
    assert "attempt 2/2: /version: commit is" in out and "NOT verified" in out


@pytest.mark.parametrize("argv", [["site.example.org"], [SITE, "--attempts", "0"]])
def test_cli_rejects_unusable_arguments(argv: list[str]) -> None:
    with pytest.raises(SystemExit) as exit_info:
        verify_deploy.main(argv)
    assert exit_info.value.code == 2
