"""Resolve walkthrough logical paths to on-disk paths.

Walkthrough keys use logical segments (e.g. ``entrance/chapel/...``) while the
shipped tree may use hidden directories until unlock (e.g.
``entrance/.chapel/...``). Try each segment as ``name`` then ``.name`` when
missing.
"""

from __future__ import annotations

from pathlib import Path


def resolve_logical_path(root: Path, rel: str) -> Path | None:
    """Return a path that exists on disk, or None.

    *rel* uses forward slashes relative to *root* (no leading slash).
    """
    parts = rel.replace("\\", "/").strip("/").split("/")
    if not parts or parts == [""]:
        return None
    cur = root
    for i, part in enumerate(parts):
        is_last = i == len(parts) - 1
        nxt = cur / part
        if is_last:
            if nxt.exists():
                return nxt
            if not part.startswith("."):
                alt = cur / f".{part}"
                if alt.exists():
                    return alt
            return None
        if nxt.is_dir():
            cur = nxt
            continue
        if not part.startswith("."):
            alt = cur / f".{part}"
            if alt.is_dir():
                cur = alt
                continue
        return None
    return cur
