// The one preferences form: theme, sound, effects, screen shake, text speed,
// text size, CRT. Shown as a step of hero creation and in the Options
// dialog; every control writes its store straight away.
import { useId } from "react";

import { setSound, useSound } from "../audio/sound-store";
import { available, tone, unlock } from "../audio/synth";
import { setTheme, THEME_LABELS, useTheme, type ThemePref } from "../theme/theme-store";
import { setCrt, useCrt } from "./crt-store";
import { EFFECTS_LEVELS, setSettings, TEXT_SIZES, TEXT_SPEEDS, useSettings, type EffectsLevel, type TextSize, type TextSpeed } from "./settings-store";

interface SegmentedProps<T extends string> {
    label: string;
    hint?: string;
    value: T;
    options: readonly T[];
    labels: Record<T, string>;
    onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, hint, value, options, labels, onChange }: SegmentedProps<T>) {
    const id = useId();
    return (
        <div className="bc-opt">
            <div className="bc-opt-head">
                <span id={id} className="bc-opt-label">{label}</span>
                {hint && <span className="bc-opt-hint">{hint}</span>}
            </div>
            <div className="bc-seg" role="radiogroup" aria-labelledby={id}>
                {options.map((option) => (
                    <button key={option} type="button" role="radio" aria-checked={option === value} className="bc-seg-btn" onClick={() => onChange(option)}>
                        {labels[option]}
                    </button>
                ))}
            </div>
        </div>
    );
}

interface ToggleProps {
    label: string;
    hint?: string;
    on: boolean;
    disabled?: boolean;
    onChange: (on: boolean) => void;
}

function Toggle({ label, hint, on, disabled, onChange }: ToggleProps) {
    const id = useId();
    return (
        <div className="bc-opt">
            <div className="bc-opt-head">
                <span id={id} className="bc-opt-label">{label}</span>
                {hint && <span className="bc-opt-hint">{hint}</span>}
            </div>
            <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="bc-switch" disabled={disabled} onClick={() => onChange(!on)}>
                <span className="bc-visually-hidden">{on ? "On" : "Off"}</span>
            </button>
        </div>
    );
}

const THEME_ORDER: readonly ThemePref[] = ["dark", "light", "auto"];
const EFFECTS_LABELS: Record<EffectsLevel, string> = { full: "Full", light: "Light", off: "Off" };
const SPEED_LABELS: Record<TextSpeed, string> = { instant: "Instant", normal: "Normal", slow: "Slow" };
const SIZE_LABELS: Record<TextSize, string> = { small: "Small", normal: "Normal", large: "Large" };

export function SettingsForm() {
    const theme = useTheme();
    const sound = useSound();
    const crt = useCrt();
    const settings = useSettings();

    // Turning sound on is the gesture that unlocks the audio context.
    function onSound(next: boolean) {
        setSound(next);
        if (next) {
            unlock();
            tone(880, { type: "sine", dur: 0.08, vol: 0.05 });
            tone(1320, { type: "sine", dur: 0.1, vol: 0.05, delay: 0.08 });
        }
    }

    return (
        <div className="bc-settings">
            <Segmented label="Theme" hint="Torch-lit or parchment" value={theme.pref} options={THEME_ORDER} labels={THEME_LABELS} onChange={setTheme} />
            {available() && <Toggle label="Sound" hint="Chiptune effects, synthesized — no files" on={sound.on} onChange={onSound} />}
            <Segmented label="Effects" hint="Particles, flashes, title cards" value={settings.effects} options={EFFECTS_LEVELS} labels={EFFECTS_LABELS} onChange={(effects) => setSettings({ effects })} />
            <Toggle label="Screen shake" hint="On damage and big moments" on={settings.shake} disabled={settings.effects === "off"} onChange={(shake) => setSettings({ shake })} />
            <Segmented label="Text speed" hint="How a scroll unrolls" value={settings.textSpeed} options={TEXT_SPEEDS} labels={SPEED_LABELS} onChange={(textSpeed) => setSettings({ textSpeed })} />
            <Segmented label="Text size" value={settings.textSize} options={TEXT_SIZES} labels={SIZE_LABELS} onChange={(textSize) => setSettings({ textSize })} />
            <Toggle label="CRT scanlines" hint="A retro overlay" on={crt.on} onChange={setCrt} />
        </div>
    );
}
