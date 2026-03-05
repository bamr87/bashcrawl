"""Cross-session analytics engine."""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from ..loaders.sessions import SessionStore, Session


@dataclass
class AnalyticsSummary:
    """Aggregate statistics across all sessions."""
    total_sessions: int = 0
    total_events: int = 0
    total_play_time_sec: int = 0
    sessions_by_mode: dict[str, int] = field(default_factory=dict)
    sessions_by_date: dict[str, int] = field(default_factory=dict)
    sessions_by_run_id: dict[str, int] = field(default_factory=dict)

    # Rooms
    top_rooms: list[tuple[str, int]] = field(default_factory=list)
    room_visit_counts: dict[str, int] = field(default_factory=dict)

    # Encounters
    encounter_outcomes: dict[str, dict[str, int]] = field(default_factory=dict)
    items_collected: dict[str, int] = field(default_factory=dict)

    # Deaths
    death_causes: dict[str, int] = field(default_factory=dict)
    total_deaths: int = 0

    # Durations
    duration_min: int = 0
    duration_max: int = 0
    duration_avg: float = 0.0
    duration_histogram: list[dict] = field(default_factory=list)

    # Progression
    completion_funnel: list[dict] = field(default_factory=list)
    avg_rooms_per_session: float = 0.0

    # Test outcomes
    test_outcomes: dict[str, int] = field(default_factory=dict)
    total_tests: int = 0

    # Help requests
    help_subcommands: dict[str, int] = field(default_factory=dict)
    total_help_requests: int = 0

    def to_dict(self) -> dict:
        return {
            "total_sessions": self.total_sessions,
            "total_events": self.total_events,
            "total_play_time_sec": self.total_play_time_sec,
            "total_play_time_min": round(self.total_play_time_sec / 60, 1),
            "sessions_by_mode": self.sessions_by_mode,
            "sessions_by_date": self.sessions_by_date,
            "sessions_by_run_id": self.sessions_by_run_id,
            "top_rooms": [{"room": r, "count": c} for r, c in self.top_rooms],
            "room_visit_counts": self.room_visit_counts,
            "encounter_outcomes": self.encounter_outcomes,
            "items_collected": self.items_collected,
            "death_causes": self.death_causes,
            "total_deaths": self.total_deaths,
            "duration_min": self.duration_min,
            "duration_max": self.duration_max,
            "duration_avg": round(self.duration_avg, 1),
            "duration_histogram": self.duration_histogram,
            "completion_funnel": self.completion_funnel,
            "avg_rooms_per_session": round(self.avg_rooms_per_session, 1),
            "test_outcomes": self.test_outcomes,
            "total_tests": self.total_tests,
            "help_subcommands": self.help_subcommands,
            "total_help_requests": self.total_help_requests,
        }


class AnalyticsEngine:
    """Computes aggregate statistics from a SessionStore."""

    def __init__(self, store: SessionStore):
        self.store = store
        self._cache: AnalyticsSummary | None = None

    def compute(self, sessions: list[Session] | None = None) -> AnalyticsSummary:
        """Compute analytics from the given sessions (or all sessions)."""
        if sessions is None:
            if self._cache is not None:
                return self._cache
            sessions = list(self.store.sessions.values())

        summary = AnalyticsSummary()
        summary.total_sessions = len(sessions)

        mode_counter: Counter = Counter()
        date_counter: Counter = Counter()
        room_counter: Counter = Counter()
        encounter_map: dict[str, Counter] = defaultdict(Counter)
        item_counter: Counter = Counter()
        death_counter: Counter = Counter()
        durations: list[int] = []
        total_rooms = 0
        run_id_counter: Counter = Counter()
        test_outcome_counter: Counter = Counter()
        help_subcmd_counter: Counter = Counter()

        # Funnel rooms (main path)
        funnel_rooms = ["entrance", "cellar", "armoury", "chamber", "hall"]
        funnel_reached: Counter = Counter()

        for s in sessions:
            summary.total_events += s.event_count

            if s.mode:
                mode_counter[s.mode] += 1
            date_counter[s.file_date.isoformat()] += 1

            for room in s.rooms_visited:
                # Normalize room paths to just the last component
                room_name = room.rstrip("/").split("/")[-1] if "/" in room else room
                room_counter[room_name] += 1

            total_rooms += s.rooms_count

            for enc in s.encounters:
                enc_type = enc.get("type", "unknown")
                outcome = enc.get("outcome", "unknown")
                encounter_map[enc_type][outcome] += 1
                item = enc.get("item", "")
                if item:
                    item_counter[item] += 1

            for death in s.deaths:
                cause = death.get("type", "unknown")
                death_counter[cause] += 1
                summary.total_deaths += 1

            if s.duration_sec is not None:
                durations.append(s.duration_sec)
                summary.total_play_time_sec += s.duration_sec

            # Funnel: check which main-path rooms were visited
            visited_names = set()
            for room in s.rooms_visited:
                room_name = room.rstrip("/").split("/")[-1] if "/" in room else room
                visited_names.add(room_name)
            for funnel_room in funnel_rooms:
                if funnel_room in visited_names:
                    funnel_reached[funnel_room] += 1

            # Run ID tracking
            if s.run_id:
                run_id_counter[s.run_id] += 1

            # Test outcomes
            for tr in getattr(s, "test_results", []):
                outcome = tr.get("outcome", "unknown")
                test_outcome_counter[outcome] += 1

            # Help requests
            for hr in getattr(s, "help_requests", []):
                subcmd = hr.get("subcommand", "default")
                help_subcmd_counter[subcmd] += 1

        summary.sessions_by_mode = dict(mode_counter.most_common())
        summary.sessions_by_date = dict(sorted(date_counter.items()))
        summary.sessions_by_run_id = dict(run_id_counter.most_common())
        summary.top_rooms = room_counter.most_common(15)
        summary.room_visit_counts = dict(room_counter)
        summary.encounter_outcomes = {k: dict(v) for k, v in encounter_map.items()}
        summary.items_collected = dict(item_counter.most_common())
        summary.death_causes = dict(death_counter.most_common())

        # Test outcomes
        summary.test_outcomes = dict(test_outcome_counter.most_common())
        summary.total_tests = sum(test_outcome_counter.values())

        # Help requests
        summary.help_subcommands = dict(help_subcmd_counter.most_common())
        summary.total_help_requests = sum(help_subcmd_counter.values())

        if durations:
            summary.duration_min = min(durations)
            summary.duration_max = max(durations)
            summary.duration_avg = sum(durations) / len(durations)
            # Build histogram buckets: 0-5s, 5-10s, 10-30s, 30-60s, 60+s
            buckets = [
                ("0-5s", 0, 5),
                ("5-10s", 5, 10),
                ("10-30s", 10, 30),
                ("30-60s", 30, 60),
                ("60s+", 60, float("inf")),
            ]
            for label, lo, hi in buckets:
                count = sum(1 for d in durations if lo <= d < hi)
                summary.duration_histogram.append({"bucket": label, "count": count})

        if summary.total_sessions > 0:
            summary.avg_rooms_per_session = total_rooms / summary.total_sessions

        # Completion funnel
        for room in funnel_rooms:
            count = funnel_reached.get(room, 0)
            pct = round(100 * count / summary.total_sessions, 1) if summary.total_sessions else 0
            summary.completion_funnel.append({"room": room, "count": count, "pct": pct})

        if sessions is None or len(sessions) == len(self.store.sessions):
            self._cache = summary

        return summary

    def invalidate_cache(self) -> None:
        self._cache = None
