"""JSON API endpoints for Bashcrawl Observatory."""
from __future__ import annotations

import json
import os
import time
from datetime import date, datetime
from pathlib import Path
from flask import Blueprint, current_app, jsonify, request, Response

api_bp = Blueprint("api", __name__)


@api_bp.route("/sessions")
def list_sessions():
    store = current_app.config["SESSION_STORE"]
    mode = request.args.get("mode")
    sort_by = request.args.get("sort", "date")
    order = request.args.get("order", "desc")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 25))

    has_screenshots = request.args.get("has_screenshots")
    if has_screenshots == "true":
        has_screenshots = True
    elif has_screenshots == "false":
        has_screenshots = False
    else:
        has_screenshots = None

    min_events = request.args.get("min_events")
    if min_events:
        min_events = int(min_events)

    sessions, total = store.list_sessions(
        mode=mode,
        has_screenshots=has_screenshots,
        min_events=min_events,
        sort_by=sort_by,
        order=order,
        page=page,
        per_page=per_page,
    )

    return jsonify({
        "sessions": [s.to_summary() for s in sessions],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    })


@api_bp.route("/sessions/stats")
def session_stats():
    store = current_app.config["SESSION_STORE"]
    modes = store.get_modes()
    total = len(store.sessions)
    return jsonify({
        "total": total,
        "modes": modes,
    })


@api_bp.route("/sessions/<sid>")
def get_session(sid):
    store = current_app.config["SESSION_STORE"]
    session = store.get(sid)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(session.to_detail())


@api_bp.route("/screenshots")
def list_screenshots():
    store = current_app.config["SCREENSHOT_STORE"]
    test_name = request.args.get("test_name")
    sort_by = request.args.get("sort", "date")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 25))

    sessions, total = store.list_sessions(
        test_name=test_name,
        sort_by=sort_by,
        page=page,
        per_page=per_page,
    )

    return jsonify({
        "sessions": [s.to_summary() for s in sessions],
        "total": total,
        "page": page,
        "total_pages": (total + per_page - 1) // per_page,
    })


@api_bp.route("/screenshots/<dir_name>")
def get_screenshot_session(dir_name):
    store = current_app.config["SCREENSHOT_STORE"]
    ss = store.get(dir_name)
    if not ss:
        return jsonify({"error": "Screenshot session not found"}), 404
    return jsonify(ss.to_detail())


@api_bp.route("/analytics")
def analytics():
    engine = current_app.config["ANALYTICS_ENGINE"]
    summary = engine.compute()
    return jsonify(summary.to_dict())


@api_bp.route("/analytics/rooms")
def analytics_rooms():
    engine = current_app.config["ANALYTICS_ENGINE"]
    summary = engine.compute()
    return jsonify({
        "top_rooms": [{"room": r, "count": c} for r, c in summary.top_rooms],
        "room_visit_counts": summary.room_visit_counts,
    })


@api_bp.route("/analytics/timeline")
def analytics_timeline():
    engine = current_app.config["ANALYTICS_ENGINE"]
    summary = engine.compute()
    return jsonify({"sessions_by_date": summary.sessions_by_date})


@api_bp.route("/analytics/funnel")
def analytics_funnel():
    engine = current_app.config["ANALYTICS_ENGINE"]
    summary = engine.compute()
    return jsonify({"completion_funnel": summary.completion_funnel})


@api_bp.route("/analytics/refresh", methods=["POST"])
def analytics_refresh():
    store = current_app.config["SESSION_STORE"]
    engine = current_app.config["ANALYTICS_ENGINE"]
    new_count = store.refresh()
    engine.invalidate_cache()
    summary = engine.compute()
    return jsonify({
        "ok": True,
        "new_sessions": new_count,
        "total_sessions": summary.total_sessions,
    })


@api_bp.route("/feedback")
def list_feedback():
    store = current_app.config["FEEDBACK_STORE"]
    reports = store.list_reports()
    return jsonify({
        "reports": [r.to_summary() for r in reports],
        "total": len(reports),
    })


@api_bp.route("/feedback/refresh", methods=["POST"])
def feedback_refresh():
    store = current_app.config["FEEDBACK_STORE"]
    new_count = store.refresh()
    return jsonify({"ok": True, "new_reports": new_count, "total": len(store.reports)})


@api_bp.route("/feedback/<sid>")
def get_feedback(sid):
    store = current_app.config["FEEDBACK_STORE"]
    report = store.get(sid)
    if not report:
        return jsonify({"error": "Feedback report not found"}), 404
    return jsonify(report.to_detail())


@api_bp.route("/live/stream")
def live_stream():
    """Server-Sent Events stream for real-time session monitoring."""
    store = current_app.config["SESSION_STORE"]

    def generate():
        last_check = time.time()
        while True:
            new_count = store.refresh()
            if new_count > 0:
                data = json.dumps({"type": "refresh", "new_sessions": new_count})
                yield f"data: {data}\n\n"
            # Heartbeat every 15 seconds
            now = time.time()
            if now - last_check >= 15:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                last_check = now
            time.sleep(2)

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api_bp.route("/live/active")
def live_active():
    """Return recently active sessions."""
    store = current_app.config["SESSION_STORE"]
    # Get sessions from today
    today = date.today()
    recent = [s.to_summary() for s in store.sessions.values()
              if s.file_date == today]
    recent.sort(key=lambda s: s.get("start_time", ""), reverse=True)
    return jsonify({"active": recent[:20]})


# ---------------------------------------------------------------------------
# AI Agent Live View
# ---------------------------------------------------------------------------

def _get_live_log_path() -> Path:
    config = current_app.config["OBSERVATORY_CONFIG"]
    return config.logs_dir / "live_agent.jsonl"


@api_bp.route("/live/agent/status")
def live_agent_status():
    """Return the current live agent session status (latest session_start + stats)."""
    log_path = _get_live_log_path()
    if not log_path.exists():
        return jsonify({"active": False, "events": 0})

    status = {"active": False, "events": 0}
    total = 0
    try:
        with open(log_path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                total += 1
                try:
                    ev = json.loads(line)
                    if ev.get("type") == "session_start":
                        status = {
                            "active": True,
                            "test": ev.get("test", ""),
                            "goal": ev.get("goal", ""),
                            "max_turns": ev.get("max_turns", 0),
                            "max_elapsed": ev.get("max_elapsed", 0),
                            "ts": ev.get("ts", 0),
                            "events": 0,
                        }
                    elif ev.get("type") == "session_end":
                        status["active"] = False
                        status["exit_reason"] = ev.get("exit_reason", "")
                        status["total_turns"] = ev.get("total_turns", 0)
                        status["elapsed"] = ev.get("elapsed", 0)
                        status["rooms_visited"] = ev.get("rooms_visited", [])
                        status["final_inventory"] = ev.get("final_inventory", "")
                        status["final_hp"] = ev.get("final_hp", 0)
                except (json.JSONDecodeError, KeyError):
                    pass
    except OSError:
        pass

    status["events"] = total
    # Mark active if modified in last 30 seconds
    try:
        mtime = log_path.stat().st_mtime
        status["active"] = status.get("active", False) or (time.time() - mtime < 30)
        status["last_modified"] = mtime
    except OSError:
        pass

    return jsonify(status)


@api_bp.route("/live/agent/events")
def live_agent_events():
    """Return the last N events from live_agent.jsonl."""
    log_path = _get_live_log_path()
    limit = int(request.args.get("limit", 100))
    skip = int(request.args.get("skip", 0))

    if not log_path.exists():
        return jsonify({"events": [], "total": 0})

    events = []
    try:
        with open(log_path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except OSError:
        pass

    total = len(events)
    sliced = events[skip:][-limit:]
    return jsonify({"events": sliced, "total": total})


@api_bp.route("/live/agent/stream")
def live_agent_stream():
    """SSE stream that tails live_agent.jsonl and pushes new events to the browser."""
    log_path = _get_live_log_path()

    def generate():
        # Start from the beginning of the file (or past EOF if no active session)
        offset = 0
        heartbeat_at = time.time()

        while True:
            try:
                if log_path.exists():
                    size = log_path.stat().st_size
                    if size > offset:
                        with open(log_path, encoding="utf-8") as fh:
                            fh.seek(offset)
                            chunk = fh.read()
                            offset = fh.tell()
                        for raw_line in chunk.splitlines():
                            raw_line = raw_line.strip()
                            if raw_line:
                                yield f"data: {raw_line}\n\n"
            except OSError:
                pass

            now = time.time()
            if now - heartbeat_at >= 10:
                yield f"data: {json.dumps({'type': 'heartbeat', 'ts': now})}\n\n"
                heartbeat_at = now

            time.sleep(0.5)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
