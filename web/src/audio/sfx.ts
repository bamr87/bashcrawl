// The SFX catalogue: one short synth phrase per thing that can happen.
import { arp, click, tone } from "./synth";

export type SfxName =
    | "key" | "xp" | "quest" | "levelup" | "damage" | "heal" | "item" | "warp" | "climb" | "rewind"
    | "unlock" | "lesson" | "objective" | "skill" | "error" | "tab" | "poweron" | "celebrate";

// Note frequencies (Hz).
const C5 = 523.25, D5 = 587.33, E5 = 659.25, FS5 = 739.99, G5 = 783.99, A5 = 880, B5 = 987.77;
const C6 = 1046.5, CS6 = 1108.73, D6 = 1174.66, E6 = 1318.51, G6 = 1567.98, A6 = 1760, C7 = 2093.0, E7 = 2637.02;

export const SFX: Record<SfxName, () => void> = {
    key: () => click(),
    xp: () => arp([C6, E6, G6], { type: "sine", dur: 0.09, gap: 0.045, vol: 0.06 }),
    quest: () => {
        arp([G5, C6, E6, G6], { type: "triangle", dur: 0.14, gap: 0.09, vol: 0.08 });
        tone(C7, { type: "sine", dur: 0.4, vol: 0.03, delay: 0.36 });
    },
    levelup: () => {
        arp([C5, E5, G5, C6, E6, G6], { type: "square", dur: 0.12, gap: 0.07, vol: 0.06 });
        tone(C6, { type: "triangle", dur: 0.6, vol: 0.05, delay: 0.45 });
        tone(G6, { type: "triangle", dur: 0.6, vol: 0.04, delay: 0.45 });
    },
    damage: () => {
        tone(160, { type: "sawtooth", dur: 0.22, vol: 0.12, slideTo: 60 });
        tone(90, { type: "square", dur: 0.04, vol: 0.08 });
    },
    heal: () => {
        tone(660, { type: "sine", dur: 0.18, vol: 0.06, slideTo: 990 });
        tone(E6, { type: "sine", dur: 0.12, vol: 0.05, delay: 0.18 });
    },
    item: () => {
        tone(A6, { type: "triangle", dur: 0.06, vol: 0.06 });
        tone(E7, { type: "triangle", dur: 0.09, vol: 0.05, delay: 0.06 });
    },
    warp: () => tone(300, { type: "sine", dur: 0.22, vol: 0.05, slideTo: 1200 }),
    climb: () => tone(400, { type: "sine", dur: 0.2, vol: 0.05, slideTo: 800 }),
    rewind: () => tone(900, { type: "sine", dur: 0.2, vol: 0.05, slideTo: 300 }),
    unlock: () => arp([D5, FS5, A5, D6], { type: "triangle", dur: 0.16, gap: 0.11, vol: 0.07 }),
    lesson: () => {
        arp([C5, E5, G5, C6], { type: "triangle", dur: 0.12, gap: 0.08, vol: 0.06 });
        tone(E6, { type: "sine", dur: 0.5, vol: 0.03, delay: 0.32 });
    },
    objective: () => {
        tone(A5, { type: "sine", dur: 0.07, vol: 0.05 });
        tone(CS6, { type: "sine", dur: 0.11, vol: 0.05, delay: 0.07 });
    },
    skill: () => {
        tone(B5, { type: "triangle", dur: 0.08, vol: 0.05 });
        tone(E6, { type: "triangle", dur: 0.12, vol: 0.05, delay: 0.08 });
    },
    error: () => {
        tone(110, { type: "square", dur: 0.09, vol: 0.05 });
        tone(110, { type: "square", dur: 0.09, vol: 0.05, delay: 0.15 });
    },
    tab: () => tone(740, { type: "sine", dur: 0.04, vol: 0.04 }),
    poweron: () => {
        tone(55, { type: "sine", dur: 0.7, vol: 0.05, slideTo: 440 });
        tone(A5, { type: "triangle", dur: 0.2, vol: 0.04, delay: 0.5 });
    },
    celebrate: () => SFX.levelup(),
};

export function play(name: SfxName): void {
    const fn = SFX[name];
    if (fn) fn();
}
