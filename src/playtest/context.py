"""Structured turn context for agent playtests.

Built from the live sandbox filesystem plus the bash session snapshot — no extra
shell probes — so it still works while an encounter is blocked on ``read``.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

_SCROLL_CAP = 12000


def norm_room_path(path: str) -> str:
    """Strip leading dots on path components so ``.chapel`` matches ``chapel``."""
    parts: List[str] = []
    for part in str(path or "").replace("\\", "/").split("/"):
        if part.startswith(".") and part not in (".", ".."):
            part = part[1:]
        if part and part not in (".", ".."):
            parts.append(part)
    return "/".join(parts)


def load_room_index(game_dir: Path) -> Dict[str, Dict[str, Any]]:
    """Index ``rooms.yaml`` by normalized path and by registry key."""
    yaml_path = Path(game_dir) / "src" / "help" / "data" / "rooms.yaml"
    if not yaml_path.is_file():
        return {}
    try:
        import yaml
    except ImportError:
        return {}
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8", errors="replace")) or {}
    rooms = data.get("rooms") or {}
    index: Dict[str, Dict[str, Any]] = {}
    for key, spec in rooms.items():
        if not isinstance(spec, dict):
            continue
        packed = {**spec, "key": key}
        index[str(key)] = packed
        raw_path = str(spec.get("path") or key)
        index[norm_room_path(raw_path)] = packed
    return index


def inspect_room(room_dir: Path) -> Dict[str, Any]:
    """Classify visible/hidden entries in a room directory (ls -F semantics)."""
    exits: List[str] = []
    encounters: List[str] = []
    files: List[str] = []
    portals: List[str] = []
    visible: List[Dict[str, str]] = []
    hidden: List[Dict[str, str]] = []
    listing: List[str] = []
    scroll_text: Optional[str] = None
    scroll_present = False

    if not room_dir.is_dir():
        return {
            "exists": False,
            "exits": exits,
            "encounters": encounters,
            "files": files,
            "portals": portals,
            "visible": visible,
            "hidden": hidden,
            "listing": listing,
            "scroll_present": False,
            "scroll": None,
        }

    for entry in sorted(room_dir.iterdir(), key=lambda p: p.name.lower()):
        name = entry.name
        is_hidden = name.startswith(".")
        if entry.is_symlink():
            kind = "portal"
            marker = "@"
        elif entry.is_dir():
            kind = "room"
            marker = "/"
        elif os.access(entry, os.X_OK) and entry.is_file():
            kind = "encounter"
            marker = "*"
        elif name == "scroll" and entry.is_file():
            kind = "scroll"
            marker = ""
        else:
            kind = "file"
            marker = ""
        rec = {"name": name, "kind": kind}
        if is_hidden:
            hidden.append(rec)
            continue
        visible.append(rec)
        listing.append(f"{name}{marker}")
        if kind == "room":
            exits.append(name)
        elif kind == "encounter":
            encounters.append(name)
        elif kind == "portal":
            portals.append(name)
        elif kind == "scroll":
            scroll_present = True
            try:
                text = entry.read_text(encoding="utf-8", errors="replace")
            except OSError:
                text = ""
            if len(text) > _SCROLL_CAP:
                text = text[:_SCROLL_CAP] + "\n… [scroll truncated]"
            scroll_text = text
        else:
            files.append(name)

    return {
        "exists": True,
        "exits": exits,
        "encounters": encounters,
        "files": files,
        "portals": portals,
        "visible": visible,
        "hidden": hidden,
        "listing": listing,
        "scroll_present": scroll_present,
        "scroll": scroll_text,
    }


def build_turn(
    *,
    game_dir: Path,
    snapshot: Dict[str, Any],
    rooms: Optional[Dict[str, Dict[str, Any]]] = None,
    last_output: str = "",
    last_command: str = "",
    turn: int = 0,
    include_scroll: bool = False,
) -> Dict[str, Any]:
    """Assemble one agent-facing turn packet from session snapshot + disk."""
    cwd = str(snapshot.get("cwd") or "")
    room_dir = Path(game_dir) / cwd if cwd else Path(game_dir)
    inspected = inspect_room(room_dir)
    spec = (rooms or {}).get(norm_room_path(cwd)) or (rooms or {}).get(Path(cwd).name) or {}
    hp = snapshot.get("hp")
    packet: Dict[str, Any] = {
        "turn": turn,
        "location": cwd,
        "room_key": spec.get("key"),
        "room_title": spec.get("title"),
        "room_description": spec.get("description"),
        "context_hint": spec.get("context_hint"),
        "teaches": list(spec.get("teaches") or []),
        "next_steps": spec.get("next_steps"),
        "essential_commands": list(spec.get("essential_commands") or []),
        "health": hp,
        "inventory": snapshot.get("inventory") or "",
        "awaiting_input": bool(snapshot.get("awaiting_input")),
        "exits": inspected["exits"],
        "encounters": inspected["encounters"],
        "files": inspected["files"],
        "portals": inspected["portals"],
        "listing": inspected["listing"],
        "hidden": [h["name"] for h in inspected["hidden"]],
        "scroll_present": inspected["scroll_present"],
        "last_command": last_command,
        "output": last_output,
    }
    if include_scroll:
        packet["scroll"] = inspected["scroll"]
    return packet


def render_compact(packet: Dict[str, Any]) -> str:
    """Human-readable HUD without dumping the full scroll."""
    hp = packet.get("health")
    hp_txt = "unknown" if hp is None else str(hp)
    inv = packet.get("inventory") or "(empty)"
    listing = ", ".join(packet.get("listing") or []) or "(empty)"
    lines = [
        f"Turn     : {packet.get('turn', 0)}",
        f"Location : {packet.get('location') or '?'}",
    ]
    title = packet.get("room_title")
    if title:
        lines.append(f"Room     : {title}")
    lines.append(f"Health   : {hp_txt}")
    lines.append(f"Inventory: {inv}")
    lines.append(f"Here     : {listing}")
    if packet.get("awaiting_input"):
        lines.append(
            "The game is waiting for a prompt answer (usually y or n). "
            "Do not type a new shell command."
        )
    else:
        teaches = packet.get("teaches") or []
        if teaches:
            lines.append("Teaches  : " + "; ".join(str(t) for t in teaches))
        next_steps = packet.get("next_steps")
        if next_steps:
            lines.append(f"Next     : {next_steps}")
    if packet.get("scroll_present"):
        lines.append("Scroll   : present (cat scroll, or bashcrawl_state for the full text)")
    lines.append("")
    body = (packet.get("output") or "").strip()
    lines.append(body if body else "(no new output — try 'ls' or 'cat scroll')")
    return "\n".join(lines)


def render_full(packet: Dict[str, Any]) -> str:
    """Compact HUD plus the room scroll when present."""
    text = render_compact(packet)
    scroll = packet.get("scroll")
    if scroll:
        text += "\n\n--- scroll ---\n" + scroll.rstrip() + "\n--- end scroll ---"
    return text
