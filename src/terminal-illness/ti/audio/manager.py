"""SoundManager — non-blocking audio playback using miniaudio.

Provides two independent channels:
- **music**: looping background tracks (one at a time, crossfade on change)
- **sfx**: overlapping one-shot sound effects

Audio pipeline (macOS):
    WAV file → miniaudio.decode_file() → raw PCM samples
    → miniaudio.PlaybackDevice (Core Audio backend) → speakers

miniaudio selects the Core Audio (AudioUnit) backend automatically on
macOS.  This is the native low-level audio API and is fully supported
on macOS Tahoe 26.x and earlier.

Graceful degradation: if ``miniaudio`` is not installed, no audio device
is available, or the asset file is missing, every method silently no-ops.
This guarantees the TUI never crashes due to audio.
"""

from __future__ import annotations

import array
import logging
import struct
import threading
import time
from pathlib import Path
from typing import Optional

from .events import MusicTrack, SoundEvent

log = logging.getLogger(__name__)

# Locate the assets directory (sibling to this module file)
_ASSETS_DIR = Path(__file__).resolve().parent / "assets"
_SFX_DIR = _ASSETS_DIR / "sfx"
_MUSIC_DIR = _ASSETS_DIR / "music"

# Try importing miniaudio — if unavailable, the manager becomes a no-op.
try:
    import miniaudio  # type: ignore[import-untyped]

    _HAS_MINIAUDIO = True
except ImportError:
    _HAS_MINIAUDIO = False
    log.info("miniaudio not installed — audio disabled (TUI will run silently)")


class SoundManager:
    """Centralised audio controller for the Bashcrawl TUI.

    Parameters
    ----------
    disabled:
        Force-disable all audio (e.g. in headless agent mode).
    sfx_volume:
        Initial SFX volume in ``[0.0, 1.0]``.
    music_volume:
        Initial music volume in ``[0.0, 1.0]``.
    muted:
        Start muted if ``True``.
    """

    def __init__(
        self,
        *,
        disabled: bool = False,
        sfx_volume: float = 0.7,
        music_volume: float = 0.4,
        muted: bool = False,
    ) -> None:
        self._disabled = disabled or not _HAS_MINIAUDIO
        self._muted = muted
        self._sfx_volume = max(0.0, min(1.0, sfx_volume))
        self._music_volume = max(0.0, min(1.0, music_volume))
        self._current_track: Optional[MusicTrack] = None
        self._resume_music_track: Optional[MusicTrack] = None
        self._lock = threading.Lock()

        # Active playback devices (managed per-sound / per-music)
        self._music_device: object | None = None
        self._sfx_devices: list[object] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def play_sfx(self, event: SoundEvent) -> None:
        """Play a one-shot sound effect (non-blocking, overlapping OK)."""
        if self._disabled or self._muted:
            return
        path = _SFX_DIR / f"{event.value}.wav"
        if not path.exists():
            path = path.with_suffix(".ogg")
        if not path.exists():
            return
        threading.Thread(target=self._play_file, args=(path, False), daemon=True).start()

    def play_music(self, track: MusicTrack, *, loop: bool = True) -> None:
        """Start a looping background music track, replacing the current one."""
        if self._disabled:
            return
        if track == self._current_track:
            return  # already playing
        self._resume_music_track = None  # explicit new track; discard mute-resume target
        self.stop_music()
        self._current_track = track
        path = _MUSIC_DIR / f"{track.value}.wav"
        if not path.exists():
            path = path.with_suffix(".ogg")
        if not path.exists():
            self._current_track = None
            return
        threading.Thread(target=self._play_music_loop, args=(path,), daemon=True).start()

    def stop_music(self) -> None:
        """Stop the currently playing music track."""
        with self._lock:
            self._current_track = None
            dev = self._music_device
            self._music_device = None
        if dev is not None:
            try:
                dev.close()  # type: ignore[union-attr]
            except Exception:
                pass

    def set_sfx_volume(self, volume: float) -> None:
        self._sfx_volume = max(0.0, min(1.0, volume))

    def set_music_volume(self, volume: float) -> None:
        self._music_volume = max(0.0, min(1.0, volume))

    def set_volume(self, volume: float) -> None:
        """Set both SFX and music volume together."""
        self.set_sfx_volume(volume)
        self.set_music_volume(volume)

    @property
    def sfx_volume(self) -> float:
        return self._sfx_volume

    @property
    def music_volume(self) -> float:
        return self._music_volume

    @property
    def muted(self) -> bool:
        return self._muted

    def mute_toggle(self) -> bool:
        """Toggle mute state. Returns the new muted state."""
        self._muted = not self._muted
        if self._muted:
            # stop_music() clears _current_track; remember what to resume after unmute
            self._resume_music_track = self._current_track
            self.stop_music()
        elif self._resume_music_track is not None:
            track = self._resume_music_track
            self._resume_music_track = None
            self.play_music(track)
        return self._muted

    def shutdown(self) -> None:
        """Stop all playback and release resources."""
        self.stop_music()
        with self._lock:
            for dev in self._sfx_devices:
                try:
                    dev.close()  # type: ignore[union-attr]
                except Exception:
                    pass
            self._sfx_devices.clear()

    # ------------------------------------------------------------------
    # Internal playback helpers (called on daemon threads)
    # ------------------------------------------------------------------

    def _play_file(self, path: Path, loop: bool) -> None:
        """Decode and play an audio file on a background thread."""
        if not _HAS_MINIAUDIO:
            return
        try:
            decoded = miniaudio.decode_file(str(path))
            raw = bytes(miniaudio.ffi.buffer(decoded.samples))
            nchannels = decoded.nchannels
            sample_rate = decoded.sample_rate
            sample_width = decoded.sample_width

            # Apply volume scaling to 16-bit PCM samples correctly
            volume = self._sfx_volume
            if volume < 1.0:
                raw = _scale_pcm_volume(raw, sample_width, volume)

            stream = miniaudio.stream_raw_pcm_memory(
                raw,
                nchannels=nchannels,
                sample_rate=sample_rate,
                sample_width=sample_width,
            )
            device = miniaudio.PlaybackDevice(
                output_format=_sample_format(sample_width),
                nchannels=nchannels,
                sample_rate=sample_rate,
            )
            device.start(stream)
            with self._lock:
                self._sfx_devices.append(device)

            # Wait for playback to finish (duration-based)
            num_samples = len(raw) // (nchannels * sample_width)
            duration = num_samples / sample_rate
            time.sleep(duration + 0.1)

            device.close()
            with self._lock:
                if device in self._sfx_devices:
                    self._sfx_devices.remove(device)
        except Exception as exc:
            log.debug("SFX playback error for %s: %s", path.name, exc)

    def _play_music_loop(self, path: Path) -> None:
        """Decode and loop a music file until stopped.

        Uses a generator that yields PCM frames in a loop, allowing
        miniaudio to pull data continuously without restarting the
        device.  The generator checks _music_device identity on each
        iteration so that stop_music() / play_music(other_track) cause
        an immediate and clean exit.
        """
        if not _HAS_MINIAUDIO:
            return
        try:
            decoded = miniaudio.decode_file(str(path))
            raw = bytes(miniaudio.ffi.buffer(decoded.samples))
            nchannels = decoded.nchannels
            sample_rate = decoded.sample_rate
            sample_width = decoded.sample_width
            num_frames = len(raw) // (nchannels * sample_width)
            duration = num_frames / sample_rate

            # Apply volume scaling
            volume = self._music_volume
            if volume < 1.0:
                raw = _scale_pcm_volume(raw, sample_width, volume)

            device = miniaudio.PlaybackDevice(
                output_format=_sample_format(sample_width),
                nchannels=nchannels,
                sample_rate=sample_rate,
            )
            with self._lock:
                self._music_device = device

            # Start playback once; loop by re-creating the stream after
            # each full play-through.
            while True:
                with self._lock:
                    if self._music_device is not device:
                        break
                if self._muted:
                    time.sleep(0.2)
                    continue
                stream = miniaudio.stream_raw_pcm_memory(
                    raw,
                    nchannels=nchannels,
                    sample_rate=sample_rate,
                    sample_width=sample_width,
                )
                device.start(stream)
                # Sleep in short intervals so we can react to stop quickly
                elapsed = 0.0
                while elapsed < duration:
                    with self._lock:
                        if self._music_device is not device:
                            break
                    time.sleep(min(0.25, duration - elapsed))
                    elapsed += 0.25
                with self._lock:
                    if self._music_device is not device:
                        break

            try:
                device.close()
            except Exception:
                pass
        except Exception as exc:
            log.debug("Music playback error for %s: %s", path.name, exc)


def _scale_pcm_volume(raw: bytes, sample_width: int, volume: float) -> bytes:
    """Scale raw PCM samples by *volume* ∈ [0.0, 1.0].

    Handles 8-bit unsigned and 16/24/32-bit signed PCM correctly.
    """
    if sample_width == 2:
        # 16-bit signed little-endian — the most common WAV format
        fmt = f"<{len(raw) // 2}h"
        samples = struct.unpack(fmt, raw)
        scaled = struct.pack(fmt, *(max(-32768, min(32767, int(s * volume))) for s in samples))
        return scaled
    if sample_width == 1:
        # 8-bit unsigned: centre is 128
        return bytes(max(0, min(255, int((b - 128) * volume) + 128)) for b in raw)
    if sample_width == 4:
        # 32-bit signed little-endian
        fmt = f"<{len(raw) // 4}i"
        samples = struct.unpack(fmt, raw)
        lo, hi = -(1 << 31), (1 << 31) - 1
        return struct.pack(fmt, *(max(lo, min(hi, int(s * volume))) for s in samples))
    # Fallback: return unscaled to avoid corruption
    return raw


def _sample_format(sample_width: int) -> object:
    """Map sample width in bytes to miniaudio sample format."""
    if not _HAS_MINIAUDIO:
        return None
    formats = {
        1: miniaudio.SampleFormat.UNSIGNED8,
        2: miniaudio.SampleFormat.SIGNED16,
        3: miniaudio.SampleFormat.SIGNED24,
        4: miniaudio.SampleFormat.SIGNED32,
    }
    return formats.get(sample_width, miniaudio.SampleFormat.SIGNED16)
