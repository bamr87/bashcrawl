// Chiptune SFX synthesized on the Web Audio API — no audio files. The
// context is created lazily and unlocked by the first pointer or key
// gesture (browsers require one); every call is a no-op while sound is
// off or the API is missing (older browsers, jsdom).
import { soundOn } from "./sound-store";

export type Wave = OscillatorType;

export interface ToneOptions {
    dur?: number;
    type?: Wave;
    vol?: number;
    slideTo?: number;
    delay?: number;
}

export interface ArpOptions extends ToneOptions {
    gap?: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let lastKey = 0;

function audioContextClass(): (new () => AudioContext) | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = audioContextClass();
    if (!Ctor) return null;
    try {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = 0.15;
        master.connect(ctx.destination);
    } catch {
        ctx = null;
        master = null;
    }
    return ctx;
}

/** Call from a user gesture: creates and resumes the context. */
export function unlock(): void {
    const c = context();
    if (!c) return;
    unlocked = true;
    if (c.state === "suspended") void c.resume();
}

export function available(): boolean {
    return audioContextClass() !== null;
}

export function canPlay(): boolean {
    return soundOn() && unlocked && ctx !== null && ctx.state === "running";
}

export function tone(freq: number, options: ToneOptions = {}): void {
    if (!canPlay() || !ctx || !master) return;
    const { dur = 0.12, type = "square", vol = 0.08, slideTo, delay = 0 } = options;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
}

export function arp(freqs: number[], options: ArpOptions = {}): void {
    const { gap = 0.06, ...rest } = options;
    freqs.forEach((freq, i) => tone(freq, { ...rest, delay: (rest.delay ?? 0) + i * gap }));
}

/** A rate-limited key click for every command. */
export function click(): void {
    const now = performance.now();
    if (now - lastKey < 80) return;
    lastKey = now;
    tone(1200, { dur: 0.018, type: "square", vol: 0.02, slideTo: 900 });
}

let gestureBound = false;
export function bindUnlock(): void {
    if (gestureBound || typeof document === "undefined") return;
    gestureBound = true;
    const onGesture = () => {
        unlock();
        if (unlocked) {
            document.removeEventListener("pointerdown", onGesture);
            document.removeEventListener("keydown", onGesture);
        }
    };
    document.addEventListener("pointerdown", onGesture);
    document.addEventListener("keydown", onGesture);
}
