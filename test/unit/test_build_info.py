"""Build identity and health probe written into web/dist (scripts/write_build_info.py)."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import write_build_info  # noqa: E402

NOON_UTC = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)


def _repo(tmp_path: Path, package: object | None, version_file: str | None) -> Path:
    """A throwaway repo root holding only the inputs the writer reads."""
    if package is not None:
        (tmp_path / "package.json").write_text(json.dumps(package), encoding="utf-8")
    if version_file is not None:
        (tmp_path / "VERSION").write_text(version_file, encoding="utf-8")
    return tmp_path


def test_payload_uses_release_pleases_version_and_the_game_version() -> None:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    info = write_build_info.build_info(ROOT, env={"GITHUB_SHA": "c0ffee1"}, now=NOON_UTC)
    assert info == {
        "name": package["name"],
        "version": package["version"],
        "commit": "c0ffee1",
        "built_at": "2026-11-15T12:00:00Z",
        "game_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
    }


def test_built_at_is_utc() -> None:
    five_hours_behind = datetime(2026, 11, 15, 7, 0, tzinfo=timezone(timedelta(hours=-5)))
    info = write_build_info.build_info(ROOT, env={"GIT_SHA": "x"}, now=five_hours_behind)
    assert info["built_at"] == "2026-11-15T12:00:00Z"


def test_commit_prefers_git_sha_then_github_sha() -> None:
    env = {"GIT_SHA": "from-build-arg", "GITHUB_SHA": "from-actions"}
    assert write_build_info._commit(ROOT, env) == "from-build-arg"
    assert write_build_info._commit(ROOT, {"GITHUB_SHA": " from-actions\n"}) == "from-actions"


def test_commit_falls_back_to_git_then_unknown(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []

    def short_head(cmd: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        calls.append(cmd)
        return subprocess.CompletedProcess(cmd, 0, stdout="abc1234\n", stderr="")

    monkeypatch.setattr(write_build_info.subprocess, "run", short_head)
    assert write_build_info._commit(ROOT, {}) == "abc1234"
    assert calls[0][-3:] == ["rev-parse", "--short", "HEAD"]

    def no_git(cmd: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        raise subprocess.CalledProcessError(128, cmd)

    monkeypatch.setattr(write_build_info.subprocess, "run", no_git)
    assert write_build_info._commit(ROOT, {}) == "unknown"


def test_write_answers_every_route(tmp_path: Path) -> None:
    info = write_build_info.build_info(ROOT, env={"GITHUB_SHA": "c0ffee1"}, now=NOON_UTC)
    written = write_build_info.write(tmp_path, info)

    assert sorted(write_build_info.ROUTES) == ["/healthz", "/version"]
    assert sorted(path.name for path in written) == [
        "healthz",
        "healthz.json",
        "version",
        "version.json",
    ]
    for name in ("version", "version.json"):
        assert json.loads((tmp_path / name).read_text(encoding="utf-8")) == info
    for name in ("healthz", "healthz.json"):
        assert json.loads((tmp_path / name).read_text(encoding="utf-8")) == {"status": "ok"}


def test_write_needs_the_built_site(tmp_path: Path) -> None:
    info = write_build_info.build_info(ROOT, env={"GIT_SHA": "x"}, now=NOON_UTC)
    with pytest.raises(write_build_info.BuildInfoError, match="vite build"):
        write_build_info.write(tmp_path / "dist", info)


@pytest.mark.parametrize(
    ("package", "version_file", "message"),
    [
        (None, "3.2.0\n", "package.json not found"),
        ({"name": "bashcrawl"}, "3.2.0\n", 'no "version"'),
        ({"name": "bashcrawl", "version": "  "}, "3.2.0\n", 'no "version"'),
        ({"version": "0.2.1"}, "3.2.0\n", 'no "name"'),
        ({"name": "bashcrawl", "version": "0.2.1"}, None, "VERSION not found"),
        ({"name": "bashcrawl", "version": "0.2.1"}, "\n", "VERSION is empty"),
    ],
)
def test_missing_input_stops_the_build(
    tmp_path: Path, package: object | None, version_file: str | None, message: str
) -> None:
    root = _repo(tmp_path, package, version_file)
    with pytest.raises(write_build_info.BuildInfoError, match=message):
        write_build_info.build_info(root, env={"GIT_SHA": "x"}, now=NOON_UTC)


def test_package_json_must_be_a_json_object(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text("not json", encoding="utf-8")
    with pytest.raises(write_build_info.BuildInfoError, match="not valid JSON"):
        write_build_info.build_info(tmp_path, env={"GIT_SHA": "x"})
    root = _repo(tmp_path, ["bashcrawl"], "3.2.0\n")
    with pytest.raises(write_build_info.BuildInfoError, match="not a JSON object"):
        write_build_info.build_info(root, env={"GIT_SHA": "x"})


def test_cli_reports_a_missing_version_and_writes_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    _repo(root, {"name": "bashcrawl"}, "3.2.0\n")
    out = tmp_path / "dist"
    out.mkdir()

    assert write_build_info.main(["--root", str(root), "--out", str(out)]) == 1
    err = capsys.readouterr().err
    assert err.startswith("write_build_info: ") and 'no "version"' in err
    assert list(out.iterdir()) == []


def test_cli_writes_into_the_site(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("GIT_SHA", "c0ffee1")
    assert write_build_info.main(["--out", str(tmp_path)]) == 0
    assert "c0ffee1" in capsys.readouterr().out

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    info = json.loads((tmp_path / "version.json").read_text(encoding="utf-8"))
    assert info["version"] == package["version"]
    assert info["commit"] == "c0ffee1"
    assert (tmp_path / "healthz").read_text(encoding="utf-8") == '{"status": "ok"}\n'
