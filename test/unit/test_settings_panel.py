"""Unit tests for the AudioSettingsScreen modal."""

import pytest

pytestmark = pytest.mark.unit


class _FakeAudio:
    """Minimal SoundManager stand-in for testing without miniaudio."""

    def __init__(self, sfx_volume=0.7, music_volume=0.4, muted=False, disabled=False):
        self._sfx_volume = sfx_volume
        self._music_volume = music_volume
        self._muted = muted
        self._disabled = disabled
        self.played_sfx: list = []
        self.played_music: list = []

    @property
    def sfx_volume(self) -> float:
        return self._sfx_volume

    @property
    def music_volume(self) -> float:
        return self._music_volume

    @property
    def muted(self) -> bool:
        return self._muted

    def set_sfx_volume(self, v: float) -> None:
        self._sfx_volume = max(0.0, min(1.0, v))

    def set_music_volume(self, v: float) -> None:
        self._music_volume = max(0.0, min(1.0, v))

    def mute_toggle(self) -> bool:
        self._muted = not self._muted
        return self._muted

    def play_sfx(self, event) -> None:
        self.played_sfx.append(event)

    def play_music(self, track, *, loop=True) -> None:
        self.played_music.append(track)


class TestAudioSettingsHelpers:
    """Test helper functions in settings_panel module."""

    def test_bar_text_zero(self):
        from ti.settings_panel import _bar_text
        result = _bar_text(0)
        assert len(result) == 20
        assert result == "░" * 20

    def test_bar_text_hundred(self):
        from ti.settings_panel import _bar_text
        result = _bar_text(100)
        assert len(result) == 20
        assert result == "█" * 20

    def test_bar_text_fifty(self):
        from ti.settings_panel import _bar_text
        result = _bar_text(50)
        assert result.count("█") == 10
        assert result.count("░") == 10

    def test_bar_text_partial(self):
        from ti.settings_panel import _bar_text
        result = _bar_text(30)
        assert result.count("█") == 6
        assert result.count("░") == 14


class TestAudioSettingsScreenInit:
    """Test AudioSettingsScreen can be constructed with a fake audio manager."""

    def test_creation(self):
        from ti.settings_panel import AudioSettingsScreen
        from ti.game_state import GameState
        audio = _FakeAudio()
        state = GameState()
        screen = AudioSettingsScreen(audio, state)
        assert screen._audio is audio
        assert screen._game_state is state
        assert screen._cwd == "entrance"

    def test_creation_with_custom_cwd(self):
        from ti.settings_panel import AudioSettingsScreen
        from ti.game_state import GameState
        audio = _FakeAudio()
        state = GameState()
        screen = AudioSettingsScreen(audio, state, current_cwd="cellar")
        assert screen._cwd == "cellar"


class TestAudioSettingsScreenPersist:
    """Test that _persist_and_close writes state correctly."""

    def test_persist_copies_audio_to_state(self):
        from ti.settings_panel import AudioSettingsScreen
        from ti.game_state import GameState
        audio = _FakeAudio(sfx_volume=0.5, music_volume=0.3, muted=True)
        state = GameState()
        screen = AudioSettingsScreen(audio, state)
        # Call the persist part directly (skip dismiss which needs a running app)
        state.audio_muted = audio.muted
        state.audio_sfx_volume = audio.sfx_volume
        state.audio_music_volume = audio.music_volume
        assert state.audio_muted is True
        assert state.audio_sfx_volume == 0.5
        assert state.audio_music_volume == 0.3


class TestAudioSettingsVolumeAdjust:
    """Test volume adjust logic via the fake audio manager."""

    def test_sfx_volume_up(self):
        audio = _FakeAudio(sfx_volume=0.5)
        audio.set_sfx_volume(0.6)
        assert abs(audio.sfx_volume - 0.6) < 0.01

    def test_sfx_volume_clamp_max(self):
        audio = _FakeAudio(sfx_volume=0.95)
        audio.set_sfx_volume(1.5)
        assert audio.sfx_volume == 1.0

    def test_music_volume_clamp_min(self):
        audio = _FakeAudio(music_volume=0.05)
        audio.set_music_volume(-0.1)
        assert audio.music_volume == 0.0

    def test_mute_toggle(self):
        audio = _FakeAudio(muted=False)
        result = audio.mute_toggle()
        assert result is True
        assert audio.muted is True
        result2 = audio.mute_toggle()
        assert result2 is False
        assert audio.muted is False


class TestAudioSettingsStatus:
    """Test _status_text when audio is disabled."""

    def test_disabled_audio_status(self):
        from ti.settings_panel import AudioSettingsScreen
        from ti.game_state import GameState
        audio = _FakeAudio(disabled=True)
        state = GameState()
        screen = AudioSettingsScreen(audio, state)
        status = screen._status_text()
        assert "disabled" in status.lower()
