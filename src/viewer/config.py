"""Configuration for the Bashcrawl Observatory viewer."""
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Config:
    """Viewer configuration — all paths derived from game_root."""

    game_root: Path = field(default_factory=lambda: Path("."))
    cache_ttl_seconds: int = 60
    default_per_page: int = 25

    # Derived paths (set in __post_init__)
    logs_dir: Path = field(init=False)
    sessions_dir: Path = field(init=False)
    screenshots_dir: Path = field(init=False)
    feedback_dir: Path = field(init=False)

    def __post_init__(self) -> None:
        self.game_root = Path(self.game_root).resolve()
        self.logs_dir = self.game_root / "logs"
        self.sessions_dir = self.logs_dir / "sessions"
        self.screenshots_dir = self.logs_dir / "screenshots"
        self.feedback_dir = self.logs_dir / "feedback"

    def validate(self) -> list[str]:
        """Return list of validation errors (empty = OK)."""
        errors = []
        if not self.game_root.is_dir():
            errors.append(f"Game root not found: {self.game_root}")
        if not self.logs_dir.is_dir():
            errors.append(f"Logs directory not found: {self.logs_dir}")
        return errors
