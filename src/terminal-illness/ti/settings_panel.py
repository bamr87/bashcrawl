"""Audio settings modal screen for the Bashcrawl TUI.

Opened via F5 — lets the player adjust SFX/music volume, toggle mute,
and test sound playback.  Settings are applied live and persisted through
the existing GameState save system.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from textual import on
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, Label, ProgressBar, Rule, Static, Switch

from .audio import SoundEvent, MusicTrack, area_track_for

if TYPE_CHECKING:
    from .audio import SoundManager
    from .game_state import GameState

# ---------------------------------------------------------------------------
# CSS (embedded, same pattern as ChatPanel)
# ---------------------------------------------------------------------------

SETTINGS_CSS = """
AudioSettingsScreen {
    align: center middle;
    background: rgba(0,0,0,0.80);
}

#settings-box {
    width: 60;
    height: auto;
    border: double #7c3aed;
    background: #0f0f24;
    padding: 2 4;
}

#settings-title {
    text-align: center;
    color: #c084fc;
    text-style: bold;
    width: 100%;
    margin-bottom: 1;
}

.settings-row {
    height: 3;
    width: 100%;
    align: left middle;
}

.settings-label {
    color: #94a3b8;
    width: 16;
    padding: 0 1;
}

.vol-bar {
    width: 1fr;
    color: #7c3aed;
}

.vol-pct {
    width: 8;
    text-align: right;
    color: #c084fc;
    padding: 0 1;
}

.vol-btn {
    width: 5;
    min-width: 5;
    height: 3;
    margin: 0 0;
}

.test-row {
    height: auto;
    width: 100%;
    margin-top: 1;
    align: center middle;
}

.test-btn {
    margin: 0 1;
}

#settings-status {
    color: #64748b;
    width: 100%;
    text-align: center;
    margin-top: 1;
    margin-bottom: 1;
}

#done-btn {
    width: 100%;
    background: #7c3aed;
    color: white;
    text-style: bold;
    margin-top: 1;
}
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ASSETS_DIR = Path(__file__).resolve().parent / "audio" / "assets"
_SFX_DIR = _ASSETS_DIR / "sfx"
_MUSIC_DIR = _ASSETS_DIR / "music"

VOLUME_STEP = 10  # percentage points per click


def _has_assets() -> bool:
    """Check if any audio asset files exist."""
    for d in (_SFX_DIR, _MUSIC_DIR):
        if d.exists():
            for f in d.iterdir():
                if f.suffix in (".wav", ".ogg"):
                    return True
    return False


def _bar_text(pct: int) -> str:
    """Return a unicode bar visualization for a percentage 0-100."""
    filled = pct // 5  # 20 chars total
    return "█" * filled + "░" * (20 - filled)


# ---------------------------------------------------------------------------
# AudioSettingsScreen
# ---------------------------------------------------------------------------

class AudioSettingsScreen(ModalScreen[None]):
    """Modal screen for audio configuration (F5)."""

    BINDINGS = [
        Binding("escape", "close", "Close", show=False),
    ]

    def __init__(
        self,
        audio: "SoundManager",
        game_state: "GameState",
        current_cwd: str = "entrance",
    ) -> None:
        super().__init__()
        self._audio = audio
        self._game_state = game_state
        self._cwd = current_cwd

    # -- Compose ---------------------------------------------------------

    def compose(self) -> ComposeResult:
        sfx_pct = int(self._audio.sfx_volume * 100)
        music_pct = int(self._audio.music_volume * 100)

        with Vertical(id="settings-box"):
            yield Static(
                "🔊  A U D I O   S E T T I N G S",
                id="settings-title",
            )
            yield Rule()

            # Mute toggle
            with Horizontal(classes="settings-row"):
                yield Label("Mute  ", classes="settings-label")
                yield Switch(
                    value=self._audio.muted,
                    id="mute-switch",
                )

            yield Rule()

            # SFX volume
            yield Label(
                f"  SFX Volume: {_bar_text(sfx_pct)} {sfx_pct}%",
                id="sfx-label",
            )
            with Horizontal(classes="settings-row"):
                yield Button("  −  ", id="sfx-down", classes="vol-btn")
                yield ProgressBar(
                    total=100,
                    show_eta=False,
                    show_percentage=False,
                    id="sfx-bar",
                    classes="vol-bar",
                )
                yield Button("  +  ", id="sfx-up", classes="vol-btn")

            # Music volume
            yield Label(
                f"  Music Volume: {_bar_text(music_pct)} {music_pct}%",
                id="music-label",
            )
            with Horizontal(classes="settings-row"):
                yield Button("  −  ", id="music-down", classes="vol-btn")
                yield ProgressBar(
                    total=100,
                    show_eta=False,
                    show_percentage=False,
                    id="music-bar",
                    classes="vol-bar",
                )
                yield Button("  +  ", id="music-up", classes="vol-btn")

            yield Rule()

            # Test buttons
            with Horizontal(classes="test-row"):
                yield Button(
                    "🔔 Test SFX",
                    id="test-sfx-btn",
                    classes="test-btn",
                    variant="default",
                )
                yield Button(
                    "🎵 Test Music",
                    id="test-music-btn",
                    classes="test-btn",
                    variant="default",
                )

            # Status line
            yield Static(self._status_text(), id="settings-status")

            yield Button("Done", id="done-btn", variant="primary")

    # -- Mount -----------------------------------------------------------

    def on_mount(self) -> None:
        sfx_pct = int(self._audio.sfx_volume * 100)
        music_pct = int(self._audio.music_volume * 100)
        self.query_one("#sfx-bar", ProgressBar).update(progress=sfx_pct)
        self.query_one("#music-bar", ProgressBar).update(progress=music_pct)

    # -- Event handlers --------------------------------------------------

    @on(Switch.Changed, "#mute-switch")
    def _on_mute_changed(self, event: Switch.Changed) -> None:
        # Switch.value True = muted
        if event.value != self._audio.muted:
            self._audio.mute_toggle()

    @on(Button.Pressed, "#sfx-down")
    def _sfx_down(self) -> None:
        self._adjust_volume("sfx", -VOLUME_STEP)

    @on(Button.Pressed, "#sfx-up")
    def _sfx_up(self) -> None:
        self._adjust_volume("sfx", +VOLUME_STEP)

    @on(Button.Pressed, "#music-down")
    def _music_down(self) -> None:
        self._adjust_volume("music", -VOLUME_STEP)

    @on(Button.Pressed, "#music-up")
    def _music_up(self) -> None:
        self._adjust_volume("music", +VOLUME_STEP)

    @on(Button.Pressed, "#test-sfx-btn")
    def _test_sfx(self) -> None:
        self._audio.play_sfx(SoundEvent.TREASURE_PICKUP)

    @on(Button.Pressed, "#test-music-btn")
    def _test_music(self) -> None:
        track = area_track_for(self._cwd)
        self._audio.play_music(track)

    @on(Button.Pressed, "#done-btn")
    def _on_done(self) -> None:
        self._persist_and_close()

    def action_close(self) -> None:
        self._persist_and_close()

    # -- Internal --------------------------------------------------------

    def _adjust_volume(self, channel: str, delta: int) -> None:
        if channel == "sfx":
            current = int(self._audio.sfx_volume * 100)
            new_pct = max(0, min(100, current + delta))
            self._audio.set_sfx_volume(new_pct / 100.0)
            self.query_one("#sfx-bar", ProgressBar).update(progress=new_pct)
            self.query_one("#sfx-label", Label).update(
                f"  SFX Volume: {_bar_text(new_pct)} {new_pct}%"
            )
        else:
            current = int(self._audio.music_volume * 100)
            new_pct = max(0, min(100, current + delta))
            self._audio.set_music_volume(new_pct / 100.0)
            self.query_one("#music-bar", ProgressBar).update(progress=new_pct)
            self.query_one("#music-label", Label).update(
                f"  Music Volume: {_bar_text(new_pct)} {new_pct}%"
            )

    def _persist_and_close(self) -> None:
        """Write current audio state into GameState and dismiss."""
        self._game_state.audio_muted = self._audio.muted
        self._game_state.audio_sfx_volume = self._audio.sfx_volume
        self._game_state.audio_music_volume = self._audio.music_volume
        self.dismiss(None)

    def _status_text(self) -> str:
        """Build the status line showing audio backend info."""
        try:
            from .audio.manager import _HAS_MINIAUDIO
        except ImportError:
            _HAS_MINIAUDIO = False

        if self._audio._disabled:
            return "🔇 Audio disabled (headless / no backend)"

        backend = "miniaudio ✅" if _HAS_MINIAUDIO else "miniaudio ❌"
        assets = "assets ✅" if _has_assets() else "assets ❌ (run: python -m ti.audio.generate_placeholders)"
        return f"{backend}  •  {assets}"
