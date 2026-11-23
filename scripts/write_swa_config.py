#!/usr/bin/env python3
"""Write Azure Static Web Apps' config and the 404 page into web/dist.

Production is hosted on Azure Static Web Apps (docs/deploy.md, ADR 0002),
which reads `staticwebapp.config.json` from the root of the deployed folder.
The file is generated, not committed, because the Content-Security-Policy
must name a `'sha256-…'` hash for every inline `<script>` the build really
ships: this step reads the built `index.html`, hashes each one, and writes

    web/dist/staticwebapp.config.json
        globalHeaders   the CSP, HSTS, nosniff, Referrer-Policy and
                        Permissions-Policy (plus X-Robots-Tag: noindex on a
                        build that is not production)
        routes          cache rules, first match wins: /version and /healthz
                        answer as JSON and are never stored; the engine
                        scripts (/assets/js/*) and data bundles (/data/*) are
                        not content-hashed, so they revalidate; Vite's hashed
                        output elsewhere under /assets/* is immutable; the
                        page itself revalidates
        responseOverrides  a real 404 for unknown paths (the app routes by
                        hash, so only / is a page)
    web/dist/404.html   copied from infra/azure/404.html

It runs after the vite build and after scripts/write_build_info.py
(`make swa-config`; .github/workflows/azure-swa.yml runs it after
`make web-test`). GitHub Pages ignores both files, and `make web-test` does
not write them, so the Pages fallback is unchanged.

Build variables, read from the process environment (not from .env files):
    VITE_POSTHOG_HOST  the PostHog ingestion host. A posthog.com host is
                       covered by the policy's https://*.posthog.com; any
                       other https origin (a reverse proxy) is added to
                       connect-src. No analytics host is ever a script
                       source: the library ships inside the app's own bundle
                       (web/src/analytics/client.ts).
    VITE_APP_ENV       production | staging | preview. Anything but
                       production (or unset) is kept out of search indexes,
                       the same rule vite.config.mts applies to the page.

Usage:
    python3 scripts/write_swa_config.py                  # into web/dist
    python3 scripts/write_swa_config.py --out DIR        # into DIR
    python3 scripts/write_swa_config.py --root DIR       # read DIR/infra/azure/404.html

stdlib only: this runs in the deploy workflow's build environment (pyyaml only).
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
from collections.abc import Mapping, Sequence
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))

from write_build_info import ROUTES as PROBES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

CONFIG_NAME = "staticwebapp.config.json"
NOT_FOUND_NAME = "404.html"
NOT_FOUND_SOURCE = Path("infra") / "azure" / NOT_FOUND_NAME

# Static Web Apps rejects a larger config file.
MAX_CONFIG_BYTES = 20 * 1024

# PostHog Cloud: the ingestion hosts and the app itself. Events, flags,
# surveys and replays are sent there (connect-src); survey images may come
# from there (img-src). Scripts never do: posthog-js and its extensions are
# bundled into the app's own chunk, so script-src stays this origin only.
POSTHOG = "https://*.posthog.com"

NO_STORE = "no-store"
REVALIDATE = "no-cache"
IMMUTABLE = "public, max-age=31536000, immutable"

# One year, this host only. `includeSubDomains` and `preload` are deliberate,
# hard-to-undo steps for a domain that is not chosen yet (docs/deploy.md).
HSTS = "max-age=31536000"

# The trainer uses none of these device features. Clipboard, fullscreen and
# audio are left alone: the Reference door and the feedback widget copy text.
PERMISSIONS_POLICY = ", ".join(
    f"{feature}=()"
    for feature in (
        "accelerometer",
        "camera",
        "display-capture",
        "geolocation",
        "gyroscope",
        "magnetometer",
        "microphone",
        "midi",
        "payment",
        "usb",
    )
)


class SwaConfigError(RuntimeError):
    """A build input is missing or unusable, so the build must stop."""


class _InlineScripts(HTMLParser):
    """Collect the text of every <script> element that has no `src`."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.sources: list[str] = []
        self._parts: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script":
            external = any(name == "src" for name, _ in attrs)
            self._parts = None if external else []

    def handle_data(self, data: str) -> None:
        if self._parts is not None:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._parts is not None:
            self.sources.append("".join(self._parts))
            self._parts = None


def inline_scripts(html: str) -> list[str]:
    """The source of each inline <script> in `html`, in document order.

    Newlines are normalized the way a browser's HTML parser does before it
    hashes a script, so a CRLF checkout yields the same hash as the page.
    Empty scripts are dropped: there is nothing to run.
    """
    parser = _InlineScripts()
    parser.feed(html.replace("\r\n", "\n").replace("\r", "\n"))
    parser.close()
    return [source for source in parser.sources if source.strip()]


def script_hash(source: str) -> str:
    """The CSP source expression that allows exactly this inline script."""
    digest = hashlib.sha256(source.encode("utf-8")).digest()
    return f"'sha256-{base64.b64encode(digest).decode('ascii')}'"


def script_hashes(html: str) -> list[str]:
    """One hash per distinct inline script, in document order.

    Every inline <script> is hashed, data blocks (JSON-LD) included: a hash
    for a block the browser never runs allows nothing.
    """
    return list(dict.fromkeys(script_hash(source) for source in inline_scripts(html)))


def analytics_origin(host: str) -> str | None:
    """The origin to allow beside POSTHOG for this VITE_POSTHOG_HOST, if any.

    None when the host is unset or a subdomain of posthog.com (the wildcard
    covers it). Raises SwaConfigError for anything that is not an https URL:
    the app would switch analytics off without a word (web/src/analytics/
    config.ts), and a policy built from a typo would block it anyway.
    """
    value = host.strip()
    if not value:
        return None
    try:
        parts = urlsplit(value)
        scheme, hostname, port = parts.scheme, (parts.hostname or "").lower(), parts.port
    except ValueError as exc:
        raise SwaConfigError(f"VITE_POSTHOG_HOST is not a usable URL ({value!r}): {exc}") from None
    if scheme != "https" or not hostname:
        raise SwaConfigError(
            f"VITE_POSTHOG_HOST must be an https:// URL (https://us.i.posthog.com): got {value!r}"
        )
    if hostname.endswith(".posthog.com"):
        return None
    if ":" in hostname:
        hostname = f"[{hostname}]"
    return f"https://{hostname}:{port}" if port else f"https://{hostname}"


def content_security_policy(hashes: Sequence[str], analytics: str | None = None) -> str:
    """The policy: same-origin by default, inline scripts by hash, and no
    third-party script at all; PostHog is somewhere to send data, not code."""
    posthog = [POSTHOG, analytics] if analytics else [POSTHOG]
    directives: list[tuple[str, list[str]]] = [
        ("default-src", ["'self'"]),
        ("script-src", ["'self'", *hashes]),
        ("connect-src", ["'self'", *posthog]),
        ("style-src", ["'self'", "'unsafe-inline'"]),
        ("img-src", ["'self'", "data:", "blob:", POSTHOG]),
        ("font-src", ["'self'", "data:"]),
        ("worker-src", ["'self'", "blob:"]),
        ("object-src", ["'none'"]),
        ("base-uri", ["'self'"]),
        ("form-action", ["'self'"]),
        ("frame-ancestors", ["'none'"]),
        ("upgrade-insecure-requests", []),
    ]
    return "; ".join(" ".join([name, *sources]) for name, sources in directives)


def indexable(app_env: str) -> bool:
    """Only production (or a build that names no environment) may be indexed."""
    return app_env.strip() in ("", "production")


def global_headers(csp: str, app_env: str = "") -> dict[str, str]:
    """The headers every response carries."""
    headers = {
        "Content-Security-Policy": csp,
        "Strict-Transport-Security": HSTS,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": PERMISSIONS_POLICY,
    }
    if not indexable(app_env):
        headers["X-Robots-Tag"] = "noindex, nofollow"
    return headers


def routes() -> list[dict[str, object]]:
    """The route rules. ORDER MATTERS: Static Web Apps stops at the first match."""

    def cached(route: str, policy: str, **rule: object) -> dict[str, object]:
        return {"route": route, **rule, "headers": {"Cache-Control": policy}}

    rules: list[dict[str, object]] = []
    # /version and /healthz are extensionless files: answer them from their
    # .json twins so they carry a JSON content type, and never store either.
    for route, names in PROBES.items():
        twin = "/" + next(name for name in names if name.endswith(".json"))
        rules.append(cached(route, NO_STORE, rewrite=twin))
        rules.append(cached(twin, NO_STORE))
    rules += [
        # Not content-hashed, so they must revalidate. These two sit ABOVE
        # /assets/* on purpose: /assets/js/ would match it as well.
        cached("/assets/js/*", REVALIDATE),
        cached("/data/*", REVALIDATE),
        # Vite's output: the file name carries the content hash.
        cached("/assets/*", IMMUTABLE),
        cached("/", REVALIDATE),
        cached("/index.html", REVALIDATE),
    ]
    return rules


def build_config(html: str, env: Mapping[str, str] | None = None) -> dict[str, object]:
    """The whole staticwebapp.config.json for a built index.html."""
    env = os.environ if env is None else env
    csp = content_security_policy(
        script_hashes(html), analytics_origin(env.get("VITE_POSTHOG_HOST", ""))
    )
    return {
        "routes": routes(),
        "responseOverrides": {"404": {"rewrite": f"/{NOT_FOUND_NAME}"}},
        "globalHeaders": global_headers(csp, env.get("VITE_APP_ENV", "")),
    }


def write(out: Path, not_found: Path, env: Mapping[str, str] | None = None) -> list[Path]:
    """Write the config and the 404 page into `out` (the built site). Returns the paths."""
    index = out / "index.html"
    if not index.is_file():
        raise SwaConfigError(f"{index} not found: run the vite build first (make web-bundle)")
    try:
        page = not_found.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise SwaConfigError(f"{not_found} not found: it is the 404 page") from None
    if inline_scripts(page):
        raise SwaConfigError(f"{not_found} has an inline <script>: the policy would block it")

    config = build_config(index.read_text(encoding="utf-8"), env)
    text = json.dumps(config, indent=2) + "\n"
    size = len(text.encode("utf-8"))
    if size > MAX_CONFIG_BYTES:
        raise SwaConfigError(
            f"{CONFIG_NAME} would be {size} bytes: Static Web Apps allows {MAX_CONFIG_BYTES}"
        )

    written = [out / CONFIG_NAME, out / NOT_FOUND_NAME]
    written[0].write_text(text, encoding="utf-8")
    written[1].write_text(page, encoding="utf-8")
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Write staticwebapp.config.json and 404.html into web/dist."
    )
    parser.add_argument("--root", type=Path, default=ROOT, help="repo root (default: this repo)")
    parser.add_argument("--out", type=Path, help="built site directory (default: ROOT/web/dist)")
    args = parser.parse_args(argv)
    out = args.out or args.root / "web" / "dist"
    try:
        written = write(out, args.root / NOT_FOUND_SOURCE)
    except SwaConfigError as exc:
        print(f"write_swa_config: {exc}", file=sys.stderr)
        return 1
    config = json.loads(written[0].read_text(encoding="utf-8"))
    policy = config["globalHeaders"]["Content-Security-Policy"]
    names = ", ".join(path.name for path in written)
    print(f"swa config: {policy.count('sha256-')} inline script hash(es) -> {out} ({names})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
