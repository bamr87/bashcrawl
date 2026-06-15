"""Server-side instrumentation for blank-slate playtests.

When an external agent (e.g. Claude Code) drives the game through the MCP
server, the server is the only Python component that observes every move — so
it owns the audit log. :class:`SessionRecorder` writes one JSONL line per event
using the same schema as ``test/fixtures/log_capture`` (``ts``/``sid``/``event``
+ extras), and classifies each turn so the offline scorer
(``test/analysis/blank_slate_report.py``) needs nothing but this file.

New event types beyond the base schema:

* ``discovery``    — first *productive* use of a new command verb / first room.
* ``struggle``     — an error or a no-progress repeat (a wrong attempt).
* ``content_gap``  — emitted after ``stuck_threshold`` struggles in a row, or
  when the agent calls ``bashcrawl_report_gap`` (``self_reported=True``).
"""

from __future__ import annotations

import json
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

# Outcome of a single command turn.
PROGRESS = "progress"
ERROR = "error"
REPEAT = "repeat"
NEUTRAL = "neutral"

# Categories the playing agent may tag qualitative feedback with
# (see bashcrawl_feedback and the report's "Player feedback" section).
FEEDBACK_CATEGORIES = ("rationale", "unclear", "bug", "enhancement", "note")


def _state_progressed(before: Dict[str, Any], after: Dict[str, Any]) -> bool:
    """True if the snapshot changed in a way a player would call progress."""
    if not before or not after:
        return False
    if after.get("cwd") != before.get("cwd"):
        return True
    if after.get("xp", 0) != before.get("xp", 0):
        return True
    if after.get("inventory", "") != before.get("inventory", ""):
        return True
    if after.get("hp") != before.get("hp"):
        return True
    if list(after.get("completed_quest_ids") or []) != list(
        before.get("completed_quest_ids") or []
    ):
        return True
    # Unlocking a hidden room changes the listing of the current directory.
    if list(after.get("room_items") or []) != list(before.get("room_items") or []):
        return True
    return False


def classify_outcome(
    outputs: List[Dict[str, str]],
    before: Dict[str, Any],
    after: Dict[str, Any],
) -> str:
    """Classify a command turn as error / progress / neutral (no error, no change)."""
    if any((o or {}).get("kind") == "error" for o in (outputs or [])):
        return ERROR
    if _state_progressed(before, after):
        return PROGRESS
    return NEUTRAL


class SessionRecorder:
    """Append-only JSONL recorder + struggle/gap detector for one play session."""

    def __init__(
        self,
        session_id: str,
        log_path: Path,
        *,
        stuck_threshold: int = 3,
        scenario: str = "blank_slate",
    ) -> None:
        self.session_id = session_id
        self.log_path = Path(log_path)
        self.stuck_threshold = max(2, stuck_threshold)
        self.scenario = scenario
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

        self._last_command: Optional[str] = None
        self._struggle_run = 0
        self._gap_open = False  # de-dupe consecutive auto-gaps
        self._known_verbs: set[str] = set()
        self._rooms_seen: set[str] = set()
        self._completed: set[int] = set()
        self._recent: Deque[str] = deque(maxlen=6)
        self._counts: Dict[str, int] = {}

    # -- low-level ---------------------------------------------------------
    def log(self, event: str, **extra: Any) -> None:
        record = {
            "ts": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "sid": self.session_id,
            "event": event,
            **extra,
        }
        with open(self.log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
        self._counts[event] = self._counts.get(event, 0) + 1

    @property
    def counts(self) -> Dict[str, int]:
        return dict(self._counts)

    # -- lifecycle ---------------------------------------------------------
    def start(self, state: Dict[str, Any], **extra: Any) -> None:
        self.log(
            "session_start",
            mode="blank_slate",
            scenario=self.scenario,
            source="mcp_server",
            **extra,
        )
        cwd = (state or {}).get("cwd")
        if cwd:
            self._rooms_seen.add(cwd)
            self.log("room_enter", room=cwd)
        self._completed |= set((state or {}).get("completed_quest_ids") or [])

    def end(self, state: Dict[str, Any], reason: str = "stop") -> None:
        self.log(
            "session_end",
            reason=reason,
            rooms_visited=len(self._rooms_seen),
            quests_completed=sorted(self._completed),
            final_cwd=(state or {}).get("cwd"),
            final_xp=(state or {}).get("xp"),
            final_inventory=(state or {}).get("inventory"),
        )

    # -- per-action recording ---------------------------------------------
    def record_command(
        self,
        command: str,
        outputs: List[Dict[str, str]],
        before: Dict[str, Any],
        after: Dict[str, Any],
    ) -> str:
        """Record one command turn; return its classified outcome."""
        cmd = (command or "").strip()
        verb = cmd.split()[0] if cmd else ""
        self._recent.append(cmd)

        outcome = classify_outcome(outputs, before, after)
        if outcome == NEUTRAL and cmd and cmd == (self._last_command or "").strip():
            outcome = REPEAT

        self.log(
            "command",
            command=command,
            room=(after or {}).get("cwd"),
            outcome=outcome,
            output_preview=_preview(outputs),
        )

        new_room = (after or {}).get("cwd")
        if new_room and new_room not in self._rooms_seen:
            self._rooms_seen.add(new_room)
            self.log("room_enter", room=new_room)

        if outcome == PROGRESS and verb and verb not in self._known_verbs:
            self._known_verbs.add(verb)
            self.log("discovery", command=verb, room=new_room)

        for qid in sorted(set((after or {}).get("completed_quest_ids") or []) - self._completed):
            self._completed.add(qid)
            self.log("quest_complete", quest_id=qid, room=new_room)

        if outcome in (ERROR, REPEAT):
            self._struggle_run += 1
            self.log(
                "struggle",
                command=command,
                room=new_room,
                kind=outcome,
                run=self._struggle_run,
            )
            if self._struggle_run >= self.stuck_threshold and not self._gap_open:
                self._gap_open = True
                self.log(
                    "content_gap",
                    room=new_room,
                    quest_id=(after or {}).get("current_quest_id"),
                    quest_title=(after or {}).get("quest_title"),
                    quest_objective=(after or {}).get("quest_objective"),
                    reason="stuck",
                    detail=f"{self._struggle_run} non-productive attempts in a row",
                    attempted=list(self._recent),
                    self_reported=False,
                )
        elif outcome == PROGRESS:
            self._struggle_run = 0
            self._gap_open = False

        self._last_command = command
        return outcome

    def record_gap(self, reason: str, attempted: Optional[List[str]] = None,
                   state: Optional[Dict[str, Any]] = None) -> None:
        """Record an agent-reported content gap (the screen didn't say what to do)."""
        self.log(
            "content_gap",
            room=(state or {}).get("cwd"),
            quest_id=(state or {}).get("current_quest_id"),
            quest_title=(state or {}).get("quest_title"),
            quest_objective=(state or {}).get("quest_objective"),
            reason=reason,
            attempted=attempted or list(self._recent),
            self_reported=True,
        )
        # An honest self-report resets the auto-detector so we don't double-count.
        self._struggle_run = 0
        self._gap_open = False

    def record_feedback(self, category: str, message: str,
                        state: Optional[Dict[str, Any]] = None) -> str:
        """Record categorized qualitative feedback from the playing agent.

        Distinct from ``record_gap`` (a blocker): this is the agent's running
        commentary used to improve the game — why it chose a command, content
        that was confusing, a bug, or a UI/UX enhancement idea. Returns the
        normalized category actually logged.
        """
        cat = (category or "").strip().lower()
        if cat not in FEEDBACK_CATEGORIES:
            cat = "note"
        self.log(
            "feedback",
            category=cat,
            message=message,
            room=(state or {}).get("cwd"),
            quest_id=(state or {}).get("current_quest_id"),
            quest_objective=(state or {}).get("quest_objective"),
        )
        return cat


def _preview(outputs: List[Dict[str, str]], limit: int = 240) -> str:
    text = " · ".join((o or {}).get("text", "") for o in (outputs or []))
    return text[:limit]
