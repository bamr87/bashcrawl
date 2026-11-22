// Sound on/off, off by default. Turning it on counts as the gesture that
// unlocks the audio context, and plays a confirming blip.
import { Volume2, VolumeX } from "lucide-react";

import { setSound, useSound } from "../audio/sound-store";
import { available, tone, unlock } from "../audio/synth";

export function SoundToggle() {
    const { on } = useSound();
    if (!available()) return null;
    function toggle() {
        const next = !on;
        setSound(next);
        if (next) {
            unlock();
            tone(880, { type: "sine", dur: 0.08, vol: 0.05 });
            tone(1320, { type: "sine", dur: 0.1, vol: 0.05, delay: 0.08 });
        }
    }
    return (
        <button
            type="button"
            className="bc-btn bc-btn-ghost bc-btn-icon bc-action-wide"
            aria-pressed={on}
            onClick={toggle}
            aria-label={on ? "Sound on. Turn sound off" : "Sound off. Turn sound on"}
            title={on ? "Sound effects on" : "Sound effects off"}
        >
            {on ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
        </button>
    );
}
