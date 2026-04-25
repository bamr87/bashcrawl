"""HTML page routes for Bashcrawl Observatory."""
import json
from pathlib import Path

from flask import Blueprint, render_template, current_app, request, abort

pages_bp = Blueprint("pages", __name__)


@pages_bp.route("/")
def index():
    """Landing page — overview dashboard."""
    session_store = current_app.config["SESSION_STORE"]
    screenshot_store = current_app.config["SCREENSHOT_STORE"]
    analytics = current_app.config["ANALYTICS_ENGINE"]
    feedback_store = current_app.config["FEEDBACK_STORE"]

    summary = analytics.compute()
    recent_sessions = session_store.get_all_sessions()[:10]

    return render_template("index.html",
                           summary=summary,
                           recent_sessions=recent_sessions,
                           feedback_count=len(feedback_store.reports))


@pages_bp.route("/sessions")
def sessions_list():
    """Session log browser — list view."""
    store = current_app.config["SESSION_STORE"]
    mode = request.args.get("mode", None)
    test_outcome = request.args.get("test_outcome", None)
    run_id = request.args.get("run_id", None)
    sort_by = request.args.get("sort", "date")
    order = request.args.get("order", "desc")
    page = int(request.args.get("page", 1))
    has_screenshots = request.args.get("has_screenshots")

    if has_screenshots == "true":
        has_screenshots = True
    elif has_screenshots == "false":
        has_screenshots = False
    else:
        has_screenshots = None

    sessions, total = store.list_sessions(
        mode=mode,
        test_outcome=test_outcome,
        run_id=run_id,
        has_screenshots=has_screenshots,
        sort_by=sort_by,
        order=order,
        page=page,
    )
    modes = store.get_modes()
    outcomes = store.get_outcomes()
    run_ids = store.get_run_ids()
    total_pages = (total + 24) // 25

    return render_template("sessions/list.html",
                           sessions=sessions,
                           total=total,
                           page=page,
                           total_pages=total_pages,
                           modes=modes,
                           outcomes=outcomes,
                           run_ids=run_ids,
                           current_mode=mode,
                           current_outcome=test_outcome,
                           current_run_id=run_id,
                           sort_by=sort_by,
                           order=order)


@pages_bp.route("/sessions/<sid>")
def session_detail(sid):
    """Session detail view — event timeline."""
    store = current_app.config["SESSION_STORE"]
    screenshot_store = current_app.config["SCREENSHOT_STORE"]
    feedback_store = current_app.config["FEEDBACK_STORE"]

    session = store.get(sid)
    if not session:
        abort(404)

    # Find linked screenshots
    linked_screenshots = screenshot_store.find_by_session_sid(sid)
    feedback = feedback_store.get(sid)

    return render_template("sessions/detail.html",
                           session=session,
                           linked_screenshots=linked_screenshots,
                           feedback=feedback)


@pages_bp.route("/screenshots")
def screenshots_index():
    """Screenshot gallery — index of all screenshot sessions."""
    store = current_app.config["SCREENSHOT_STORE"]
    test_name = request.args.get("test_name")
    category = request.args.get("category")
    sort_by = request.args.get("sort", "date")
    page = int(request.args.get("page", 1))

    sessions, total = store.list_sessions(
        test_name=test_name,
        category=category,
        sort_by=sort_by,
        page=page,
    )
    total_pages = (total + 24) // 25
    categories = store.get_categories()

    return render_template("screenshots/index.html",
                           sessions=sessions,
                           total=total,
                           page=page,
                           total_pages=total_pages,
                           search=test_name or "",
                           current_category=category or "",
                           categories=categories)


@pages_bp.route("/screenshots/<dir_name>")
def screenshot_gallery(dir_name):
    """Screenshot gallery — filmstrip view for a single session."""
    store = current_app.config["SCREENSHOT_STORE"]
    ss = store.get(dir_name)
    if not ss:
        abort(404)
    prev_session, next_session = store.get_adjacent_sessions(dir_name)
    return render_template("screenshots/gallery.html",
                           session=ss,
                           prev_session=prev_session,
                           next_session=next_session)


@pages_bp.route("/analytics")
def analytics_dashboard():
    """Cross-session analytics dashboard."""
    analytics = current_app.config["ANALYTICS_ENGINE"]
    summary = analytics.compute()
    return render_template("analytics/dashboard.html", summary=summary)


@pages_bp.route("/feedback")
def feedback_list():
    """Feedback report list."""
    store = current_app.config["FEEDBACK_STORE"]
    reports = store.list_reports()
    return render_template("feedback/list.html", reports=reports)


@pages_bp.route("/feedback/<sid>")
def feedback_detail(sid):
    """Feedback report detail."""
    store = current_app.config["FEEDBACK_STORE"]
    report = store.get(sid)
    if not report:
        abort(404)
    return render_template("feedback/detail.html", report=report)


@pages_bp.route("/map")
def dungeon_map():
    """Interactive dungeon map."""
    analytics = current_app.config["ANALYTICS_ENGINE"]
    summary = analytics.compute()
    return render_template("map/index.html", summary=summary)


@pages_bp.route("/live")
def live_monitor():
    """Real-time session monitor."""
    return render_template("live/index.html")


@pages_bp.route("/live/agent")
def live_agent():
    """AI agent live terminal view."""
    return render_template("live/agent.html")


@pages_bp.route("/walkthrough")
def walkthrough_page():
    """Interactive walkthrough viewer — step-by-step game progression."""
    config = current_app.config["OBSERVATORY_CONFIG"]
    wt_path = config.game_root / "test" / "datasets" / "walkthrough.json"

    data = {}
    if wt_path.exists():
        try:
            with open(wt_path) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    # Check for golden screenshots
    golden_dir = config.game_root / "screenshots"
    golden_shots = []
    if golden_dir.is_dir():
        golden_shots = sorted(p.name for p in golden_dir.glob("*.svg"))

    # Get last passing run info
    passing_meta = {}
    passing_path = config.logs_dir / ".last_passing_run.json"
    if passing_path.exists():
        try:
            passing_meta = json.loads(passing_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass

    return render_template("walkthrough/index.html",
                           walkthrough=data,
                           golden_shots=golden_shots,
                           passing_meta=passing_meta)


@pages_bp.route("/tests")
def tests_dashboard():
    """Test results dashboard — interface breakdown."""
    store = current_app.config["SESSION_STORE"]

    interface_counts = {"tui": 0, "classic": 0, "native": 0, "other": 0}
    interface_passed = {"tui": 0, "classic": 0, "native": 0, "other": 0}

    for session in store.sessions.values():
        test_event = None
        test_result = None
        for ev in session.events:
            if ev.get("type") == "test":
                test_event = ev
            if ev.get("type") == "test_result":
                test_result = ev
        if not test_event:
            continue

        module = test_event.get("test_module", "")
        if "tui_walkthrough" in module:
            iface = "tui"
        elif "classic_walkthrough" in module:
            iface = "classic"
        elif "native_walkthrough" in module:
            iface = "native"
        else:
            iface = "other"

        interface_counts[iface] += 1
        if test_result and test_result.get("outcome") == "passed":
            interface_passed[iface] += 1

    return render_template("tests/dashboard.html",
                           interface_counts=interface_counts,
                           interface_passed=interface_passed)


@pages_bp.route("/demo/intro")
def intro_terminal_demo():
    """Bashcrawl-lite browser terminal demo (pure JavaScript)."""
    return render_template("demo/intro.html")
