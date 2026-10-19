// The wardrobe: every part and palette of the sprite as a row of radios,
// plus a random roll and the path's preset. Pure over value/onChange, so
// creation keeps a draft and the profile writes the hero straight away.
import { useId, type CSSProperties, type ReactNode } from "react";

import {
    COMPANION_LABELS, COMPANIONS, DYE_NAMES, EYE_NAMES, HAIR_COLOR_NAMES, HAIR_LABELS, HAIR_STYLES, HEADGEAR_LABELS, HEADGEARS,
    OUTFIT_LABELS, OUTFITS, randomAppearance, ROLE_PRESETS, SKIN_NAMES, TRIM_NAMES, WEAPON_LABELS, WEAPONS, type Appearance,
} from "./appearance";
import { roleMeta, type HeroRole } from "./roles";

function Row({ label, children }: { label: string; children: ReactNode }) {
    const id = useId();
    return (
        <div className="bc-appearance-row">
            <span id={id} className="bc-opt-label">{label}</span>
            <div className="bc-options-strip" role="radiogroup" aria-labelledby={id}>
                {children}
            </div>
        </div>
    );
}

function Swatch({ name, token, on, onPick }: { name: string; token: string; on: boolean; onPick: () => void }) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={name}
            title={name}
            className="bc-swatch bc-swatch-only"
            style={{ "--swatch": `var(${token})` } as CSSProperties}
            onClick={onPick}
        />
    );
}

function Chip({ label, on, onPick }: { label: string; on: boolean; onPick: () => void }) {
    return (
        <button type="button" role="radio" aria-checked={on} className="bc-option-chip" onClick={onPick}>{label}</button>
    );
}

export interface AppearanceEditorProps {
    value: Appearance;
    onChange: (next: Appearance) => void;
    /** Offers the path's preset. */
    role?: HeroRole;
}

export function AppearanceEditor({ value, onChange, role }: AppearanceEditorProps) {
    const set = (patch: Partial<Appearance>) => onChange({ ...value, ...patch });
    return (
        <div className="bc-appearance">
            <div className="bc-appearance-actions">
                <button type="button" className="bc-btn" onClick={() => onChange(randomAppearance())} title="Roll a random look">⚄ Random</button>
                {role && (
                    <button type="button" className="bc-btn" onClick={() => onChange(ROLE_PRESETS[role])}>Preset: {roleMeta(role).title}</button>
                )}
            </div>
            <Row label="Skin">
                {SKIN_NAMES.map((name, i) => <Swatch key={name} name={name} token={`--bc-hero-skin-${i + 1}`} on={value.skin === i} onPick={() => set({ skin: i })} />)}
            </Row>
            <Row label="Eyes">
                {EYE_NAMES.map((name, i) => <Swatch key={name} name={name} token={`--bc-hero-eye-${i + 1}`} on={value.eyes === i} onPick={() => set({ eyes: i })} />)}
            </Row>
            <Row label="Hair">
                {HAIR_STYLES.map((style) => <Chip key={style} label={HAIR_LABELS[style]} on={value.hair === style} onPick={() => set({ hair: style })} />)}
            </Row>
            <Row label="Hair colour">
                {HAIR_COLOR_NAMES.map((name, i) => <Swatch key={name} name={name} token={`--bc-hero-hair-${i + 1}`} on={value.hairColor === i} onPick={() => set({ hairColor: i })} />)}
            </Row>
            <Row label="Headgear">
                {HEADGEARS.map((gear) => <Chip key={gear} label={HEADGEAR_LABELS[gear]} on={value.headgear === gear} onPick={() => set({ headgear: gear })} />)}
            </Row>
            <Row label="Outfit">
                {OUTFITS.map((outfit) => <Chip key={outfit} label={OUTFIT_LABELS[outfit]} on={value.outfit === outfit} onPick={() => set({ outfit })} />)}
            </Row>
            <Row label="Dye">
                {DYE_NAMES.map((name, i) => <Swatch key={name} name={name} token={`--bc-hero-dye-${i + 1}`} on={value.dye === i} onPick={() => set({ dye: i })} />)}
            </Row>
            <Row label="Trim">
                {TRIM_NAMES.map((name, i) => <Swatch key={name} name={name} token={`--bc-hero-trim-${i + 1}`} on={value.trim === i} onPick={() => set({ trim: i })} />)}
            </Row>
            <Row label="Weapon">
                {WEAPONS.map((weapon) => <Chip key={weapon} label={WEAPON_LABELS[weapon]} on={value.weapon === weapon} onPick={() => set({ weapon })} />)}
            </Row>
            <Row label="Cape">
                <Chip label="None" on={value.cape === null} onPick={() => set({ cape: null })} />
                {DYE_NAMES.map((name, i) => <Swatch key={name} name={`${name} cape`} token={`--bc-hero-dye-${i + 1}`} on={value.cape === i} onPick={() => set({ cape: i })} />)}
            </Row>
            <Row label="Companion">
                {COMPANIONS.map((pet) => <Chip key={pet} label={COMPANION_LABELS[pet]} on={value.companion === pet} onPick={() => set({ companion: pet })} />)}
            </Row>
        </div>
    );
}
