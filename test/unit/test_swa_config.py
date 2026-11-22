"""Azure Static Web Apps config written into web/dist (scripts/write_swa_config.py)."""

from __future__ import annotations

import base64
import hashlib
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import write_build_info  # noqa: E402
import write_swa_config  # noqa: E402

NOT_FOUND = ROOT / write_swa_config.NOT_FOUND_SOURCE

# The inline scripts of the fixture page, exactly as a browser would hash them.
THEME = """
        (function () {
            try {
                var pref = localStorage.getItem("theme");
                if (1 < 2 && pref > "") document.documentElement.dataset.theme = pref;
            } catch (e) { /* "</" and <b> are just text in here */ }
        })();
    """
BOOT = 'import("./boot.js");'
LINKED_DATA = '{"@context": "https://schema.org", "@type": "WebSite"}'

# A built page: external scripts (never hashed, even with a body), an inline
# script, a commented-out one, the same inline script twice, a module, a data
# block and an empty element.
PAGE = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Fixture</title>
    <script src="./capture.js" ></script>
    <!-- <script>alert("commented out: not a script")</script> -->
    <script>{THEME}</script>
    <script type="module" crossorigin src="./assets/index-CkzHiA_5.js"></script>
    <script type="application/ld+json">{LINKED_DATA}</script>
</head>
<body>
    <script src="./assets/js/runtime.js">ignored("a src wins over a body");</script>
    <div id="root"></div>
    <script>{THEME}</script>
    <script type="module">{BOOT}</script>
    <script></script>
</body>
</html>
"""


def sha256(source: str) -> str:
    digest = hashlib.sha256(source.encode("utf-8")).digest()
    return f"'sha256-{base64.b64encode(digest).decode('ascii')}'"


def directives(policy: str) -> dict[str, list[str]]:
    """A Content-Security-Policy as {directive: [sources]}, in order."""
    parsed: dict[str, list[str]] = {}
    for part in policy.split("; "):
        name, *sources = part.split(" ")
        parsed[name] = sources
    return parsed


def served(config: dict, path: str) -> dict | None:
    """The route rule Static Web Apps applies to `path`: the first that matches.

    A route is an exact path, or a prefix when it ends in `*`.
    """
    for rule in config["routes"]:
        route = rule["route"]
        if route.endswith("*"):
            if path.startswith(route[:-1]):
                return rule
        elif path == route:
            return rule
    return None


def cache_control(config: dict, path: str) -> str | None:
    rule = served(config, path)
    return rule["headers"]["Cache-Control"] if rule else None


@pytest.fixture
def site(tmp_path: Path) -> Path:
    """A built site holding only the page the writer reads."""
    out = tmp_path / "dist"
    out.mkdir()
    (out / "index.html").write_text(PAGE, encoding="utf-8")
    return out


# ── inline scripts and their hashes ────────────────────────────────────────


def test_inline_scripts_are_found_verbatim() -> None:
    # Document order, the repeated one twice; external, empty and commented-out ones never.
    assert write_swa_config.inline_scripts(PAGE) == [THEME, LINKED_DATA, THEME, BOOT]


def test_one_hash_per_distinct_inline_script() -> None:
    assert write_swa_config.script_hashes(PAGE) == [
        sha256(THEME),
        sha256(LINKED_DATA),
        sha256(BOOT),
    ]


def test_hash_is_the_browsers_sha256_of_the_script_text() -> None:
    # The digest any CSP reference gives for `alert('Hello, world.');`.
    assert (
        write_swa_config.script_hash("alert('Hello, world.');")
        == "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='"
    )


def test_crlf_page_hashes_like_the_lf_page() -> None:
    crlf = PAGE.replace("\n", "\r\n")
    assert write_swa_config.script_hashes(crlf) == write_swa_config.script_hashes(PAGE)


def test_page_without_inline_scripts_has_no_hashes() -> None:
    page = '<html><head><script src="./a.js"></script></head><body></body></html>'
    assert write_swa_config.script_hashes(page) == []
    policy = directives(write_swa_config.content_security_policy([]))
    assert policy["script-src"] == ["'self'"]


# ── the policy ─────────────────────────────────────────────────────────────


def test_policy_carries_every_directive_in_order() -> None:
    hashes = write_swa_config.script_hashes(PAGE)
    policy = write_swa_config.content_security_policy(hashes)
    assert directives(policy) == {
        "default-src": ["'self'"],
        "script-src": ["'self'", *hashes],
        "connect-src": ["'self'", "https://*.posthog.com"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", "https://*.posthog.com"],
        "font-src": ["'self'", "data:"],
        "worker-src": ["'self'", "blob:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": [],
    }
    assert policy.endswith("; upgrade-insecure-requests")
    assert "'unsafe-inline'" not in " ".join(directives(policy)["script-src"])
    assert "unsafe-eval" not in policy
    # posthog-js ships inside the app's bundle: no host may serve it a script.
    assert not [source for source in directives(policy)["script-src"] if source.startswith("http")]


@pytest.mark.parametrize(
    "host",
    [
        "",
        "  ",
        "https://us.i.posthog.com",
        "https://eu.i.posthog.com/",
        "https://US-assets.i.PostHog.com",
    ],
)
def test_posthog_cloud_hosts_need_no_extra_origin(host: str) -> None:
    assert write_swa_config.analytics_origin(host) is None


@pytest.mark.parametrize(
    ("host", "origin"),
    [
        ("https://ph.example.org", "https://ph.example.org"),
        ("https://Ph.Example.org/ingest/", "https://ph.example.org"),
        ("https://ph.example.org:8443/ingest", "https://ph.example.org:8443"),
        # A look-alike is not PostHog, and the bare domain is not a subdomain.
        ("https://notposthog.com", "https://notposthog.com"),
        ("https://posthog.com.example.org", "https://posthog.com.example.org"),
        ("https://posthog.com", "https://posthog.com"),
    ],
)
def test_reverse_proxy_origin_is_allowed_for_connections_only(
    host: str, origin: str
) -> None:
    assert write_swa_config.analytics_origin(host) == origin

    config = write_swa_config.build_config(PAGE, {"VITE_POSTHOG_HOST": host})
    policy = directives(config["globalHeaders"]["Content-Security-Policy"])
    assert policy["connect-src"] == ["'self'", "https://*.posthog.com", origin]
    # Only there: a proxy receives data, it never serves this page a script,
    # and images still come from this site and PostHog Cloud.
    assert origin not in policy["script-src"]
    assert "https://*.posthog.com" not in policy["script-src"]
    assert origin not in policy["img-src"]
    assert origin not in policy["default-src"]


@pytest.mark.parametrize(
    "host",
    ["http://ph.example.org", "ph.example.org", "/ingest", "https://", "https://ph.example.org:x"],
)
def test_unusable_posthog_host_stops_the_build(host: str) -> None:
    with pytest.raises(write_swa_config.SwaConfigError, match="VITE_POSTHOG_HOST"):
        write_swa_config.build_config(PAGE, {"VITE_POSTHOG_HOST": host})


# ── headers ────────────────────────────────────────────────────────────────


def test_global_headers() -> None:
    headers = write_swa_config.build_config(PAGE, {})["globalHeaders"]
    assert sorted(headers) == [
        "Content-Security-Policy",
        "Permissions-Policy",
        "Referrer-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
    ]
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert headers["Strict-Transport-Security"].startswith("max-age=31536000")
    for feature in ("camera", "microphone", "geolocation", "payment"):
        assert f"{feature}=()" in headers["Permissions-Policy"]
    # The Reference door and the feedback widget copy to the clipboard.
    assert "clipboard" not in headers["Permissions-Policy"]


@pytest.mark.parametrize(
    ("app_env", "noindex"),
    [("production", False), ("", False), ("staging", True), ("preview", True)],
)
def test_only_production_may_be_indexed(app_env: str, noindex: bool) -> None:
    headers = write_swa_config.build_config(PAGE, {"VITE_APP_ENV": app_env})["globalHeaders"]
    assert ("X-Robots-Tag" in headers) is noindex
    if noindex:
        assert headers["X-Robots-Tag"] == "noindex, nofollow"


# ── routes ─────────────────────────────────────────────────────────────────


def test_unhashed_engine_and_data_routes_come_before_the_immutable_rule() -> None:
    order = [rule["route"] for rule in write_swa_config.routes()]
    assert order.index("/assets/js/*") < order.index("/assets/*")
    assert order.index("/data/*") < order.index("/assets/*")
    assert len(order) == len(set(order)), "a duplicate route can never match"


@pytest.mark.parametrize(
    ("path", "policy"),
    [
        # The engine's classic scripts and the data bundles are not content-hashed.
        ("/assets/js/runtime.js", "no-cache"),
        ("/assets/js/vendor/termforge/shell.js", "no-cache"),
        ("/assets/js/plugins/arena.js", "no-cache"),
        ("/data/world.json", "no-cache"),
        # Vite's hashed output sits beside assets/js/, not under it.
        ("/assets/index-CkzHiA_5.js", "public, max-age=31536000, immutable"),
        ("/assets/index-Bs612sTa.css", "public, max-age=31536000, immutable"),
        ("/", "no-cache"),
        ("/index.html", "no-cache"),
        ("/version", "no-store"),
        ("/version.json", "no-store"),
        ("/healthz", "no-store"),
        ("/healthz.json", "no-store"),
        # Everything else keeps the platform's default.
        ("/favicon.svg", None),
        ("/fleet-feedback.js", None),
        ("/robots.txt", None),
    ],
)
def test_first_matching_route_sets_the_cache_policy(path: str, policy: str | None) -> None:
    config = write_swa_config.build_config(PAGE, {})
    assert cache_control(config, path) == policy


def test_probes_answer_as_json_from_their_twins() -> None:
    config = write_swa_config.build_config(PAGE, {})
    assert sorted(write_build_info.ROUTES) == ["/healthz", "/version"]
    for route, names in write_build_info.ROUTES.items():
        twin = f"{route}.json"
        assert twin.lstrip("/") in names, "the build must write the file the route points at"
        assert served(config, route)["rewrite"] == twin
        assert "rewrite" not in served(config, twin)


def test_unknown_paths_get_the_404_page_not_the_app() -> None:
    config = write_swa_config.build_config(PAGE, {})
    assert config["responseOverrides"] == {"404": {"rewrite": "/404.html"}}
    # Hash routing: only / is a page, and index.html's relative URLs would
    # break at a deep path, so nothing falls back to it.
    assert "navigationFallback" not in config
    assert served(config, "/learn/navigator") is None
    assert not any(rule["route"] in ("/*", "*") for rule in config["routes"])


# ── the files ──────────────────────────────────────────────────────────────


def test_write_puts_valid_json_and_the_404_page_in_the_site(site: Path) -> None:
    env = {"VITE_POSTHOG_HOST": "https://ph.example.org", "VITE_APP_ENV": "staging"}
    written = write_swa_config.write(site, NOT_FOUND, env)

    assert [path.name for path in written] == ["staticwebapp.config.json", "404.html"]
    text = (site / "staticwebapp.config.json").read_text(encoding="utf-8")
    assert json.loads(text) == write_swa_config.build_config(PAGE, env)
    assert sorted(json.loads(text)) == ["globalHeaders", "responseOverrides", "routes"]
    assert len(text.encode("utf-8")) < write_swa_config.MAX_CONFIG_BYTES
    assert (site / "404.html").read_bytes() == NOT_FOUND.read_bytes()


def test_write_reads_the_build_variables_from_the_environment(
    site: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VITE_POSTHOG_HOST", "https://ph.example.org")
    monkeypatch.setenv("VITE_APP_ENV", "preview")
    write_swa_config.write(site, NOT_FOUND)
    text = (site / "staticwebapp.config.json").read_text(encoding="utf-8")
    headers = json.loads(text)["globalHeaders"]
    assert "https://ph.example.org" in headers["Content-Security-Policy"]
    assert headers["X-Robots-Tag"] == "noindex, nofollow"


def test_write_needs_the_built_page(tmp_path: Path) -> None:
    with pytest.raises(write_swa_config.SwaConfigError, match="vite build"):
        write_swa_config.write(tmp_path, NOT_FOUND)
    assert list(tmp_path.iterdir()) == []


def test_write_needs_the_404_page(site: Path, tmp_path: Path) -> None:
    with pytest.raises(write_swa_config.SwaConfigError, match="404 page"):
        write_swa_config.write(site, tmp_path / "missing.html")
    assert not (site / "staticwebapp.config.json").exists()


def test_write_refuses_a_404_page_the_policy_would_break(site: Path, tmp_path: Path) -> None:
    page = tmp_path / "404.html"
    page.write_text("<html><body><script>history.back()</script></body></html>", encoding="utf-8")
    with pytest.raises(write_swa_config.SwaConfigError, match="inline <script>"):
        write_swa_config.write(site, page)


def test_write_refuses_a_config_static_web_apps_would_reject(
    site: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(write_swa_config, "MAX_CONFIG_BYTES", 64)
    with pytest.raises(write_swa_config.SwaConfigError, match="allows 64"):
        write_swa_config.write(site, NOT_FOUND, {})
    assert not (site / "staticwebapp.config.json").exists()


class _Markup(HTMLParser):
    """The tags and link targets of a page."""

    def __init__(self) -> None:
        super().__init__()
        self.tags: set[str] = set()
        self.hrefs: list[str] = []
        self.fetched: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags.add(tag)
        for name, value in attrs:
            if name == "href" and tag == "a":
                self.hrefs.append(value or "")
            elif name in ("src", "href", "srcset", "action", "data"):
                self.fetched.append(value or "")
            assert not name.startswith("on"), f"inline handler {name}= would be blocked"


def test_the_404_page_is_self_contained() -> None:
    text = NOT_FOUND.read_text(encoding="utf-8")
    page = _Markup()
    page.feed(text)

    assert page.hrefs == ["/"], "one way out: back to the entrance, by an absolute link"
    assert page.fetched == [], "the page may fetch nothing: it is served at any path"
    assert not page.tags & {"script", "link", "img", "iframe", "object", "embed", "base"}
    assert "url(" not in text and "@import" not in text
    assert 'name="robots" content="noindex"' in text


# ── the command line ───────────────────────────────────────────────────────


def test_cli_writes_into_the_site(
    site: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("VITE_POSTHOG_HOST", raising=False)
    monkeypatch.delenv("VITE_APP_ENV", raising=False)
    assert write_swa_config.main(["--out", str(site)]) == 0
    assert "3 inline script hash(es)" in capsys.readouterr().out

    config = json.loads((site / "staticwebapp.config.json").read_text(encoding="utf-8"))
    policy = directives(config["globalHeaders"]["Content-Security-Policy"])
    assert policy["script-src"] == [
        "'self'",
        sha256(THEME),
        sha256(LINKED_DATA),
        sha256(BOOT),
    ]
    assert (site / "404.html").is_file()


def test_cli_reports_a_bad_host_and_writes_nothing(
    site: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("VITE_POSTHOG_HOST", "ph.example.org")
    assert write_swa_config.main(["--out", str(site)]) == 1
    err = capsys.readouterr().err
    assert err.startswith("write_swa_config: ") and "https://" in err
    assert sorted(path.name for path in site.iterdir()) == ["index.html"]


def test_cli_reports_a_missing_build(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert write_swa_config.main(["--out", str(tmp_path / "dist")]) == 1
    assert "run the vite build first" in capsys.readouterr().err
