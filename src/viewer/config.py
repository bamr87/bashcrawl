"""Configuration for the Bashcrawl Observatory viewer."""
from pathlib import Path


class Config:
    """Viewer configuration — all paths derived from game_root."""

    def __init__(self, game_root: str):
        self.game_root = Path(game_root).resolve()
        self.logs_dir = self.game_root / "logs"
        self.sessions_dir = self.logs_dir / "sessions"
        self.screenshots_dir = self.logs_dir / "screenshots"
        self.feedback_dir = self.logs_dir / "feedback"

        # Cache settings
        self.cache_ttl_seconds = 60

        # Pagination
        self.default_per_page = 25

    def validate(self) -> list[str]:
        """Return list of validation errors (empty = OK)."""
        errors = []
        if not self.game_root.is_dir():
            errors.append(f"Game root not found: {self.game_root}")
        if not self.logs_dir.is_dir():
            errors.append(f"Logs directory not found: {self.logs_dir}")
        return errors
