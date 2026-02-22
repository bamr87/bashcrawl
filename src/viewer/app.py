"""Flask application factory for Bashcrawl Observatory."""
from flask import Flask
from pathlib import Path

from .config import Config


def create_app(game_root: str) -> Flask:
    """Create and configure the Flask application."""
    config = Config(game_root)

    app = Flask(
        __name__,
        template_folder=str(Path(__file__).parent / "templates"),
        static_folder=str(Path(__file__).parent / "static"),
    )
    app.config["OBSERVATORY_CONFIG"] = config

    # Store data stores on the app for access in routes
    from .loaders.sessions import SessionStore
    from .loaders.screenshots import ScreenshotStore
    from .loaders.feedback import FeedbackStore
    from .analytics.engine import AnalyticsEngine

    session_store = SessionStore(config.sessions_dir)
    screenshot_store = ScreenshotStore(config.screenshots_dir)
    feedback_store = FeedbackStore(config.feedback_dir)
    analytics_engine = AnalyticsEngine(session_store)

    # Load data
    session_store.load_all()
    screenshot_store.load_all()
    feedback_store.load_all()

    # Cross-reference screenshots ↔ sessions
    screenshot_store.cross_reference(session_store)

    app.config["SESSION_STORE"] = session_store
    app.config["SCREENSHOT_STORE"] = screenshot_store
    app.config["FEEDBACK_STORE"] = feedback_store
    app.config["ANALYTICS_ENGINE"] = analytics_engine

    # Register routes
    from .routes.pages import pages_bp
    from .routes.api import api_bp

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp, url_prefix="/api")

    # Template context processors
    @app.context_processor
    def inject_globals():
        return {
            "session_count": len(session_store.sessions),
            "screenshot_session_count": len(screenshot_store.sessions),
        }

    # Serve screenshot SVGs from logs directory
    @app.route("/logs/screenshots/<path:filepath>")
    def serve_screenshot(filepath):
        from flask import send_from_directory
        return send_from_directory(str(config.screenshots_dir), filepath)

    return app
