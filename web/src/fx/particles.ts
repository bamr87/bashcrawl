// The particle system behind the effects canvas: a fixed pool in typed
// arrays (no allocation per frame), six kinds of particle, and a room wipe.
// Pure logic — FxCanvas owns the canvas, the clock and the colours.
import type { Point } from "./anchors";

export type ParticleKind = "orb" | "spark" | "confetti" | "ember" | "glint" | "ring";

const KIND_ID: Record<ParticleKind, number> = { orb: 1, spark: 2, confetti: 3, ember: 4, glint: 5, ring: 6 };

export interface EmitOptions {
    from: Point;
    /** Orbs steer to this point and call onArrive when they get there. */
    to?: Point;
    count?: number;
    /** CSS colours (already resolved); one is picked per particle. */
    colors: string[];
    spread?: number;
    speed?: number;
    ttl?: number;
    size?: number;
    onArrive?: () => void;
    random?: () => number;
}

interface Group {
    onArrive?: () => void;
}

export class ParticleSystem {
    readonly max: number;
    private x: Float32Array;
    private y: Float32Array;
    private vx: Float32Array;
    private vy: Float32Array;
    private tx: Float32Array;
    private ty: Float32Array;
    private life: Float32Array;
    private ttl: Float32Array;
    private size: Float32Array;
    private rot: Float32Array;
    private vr: Float32Array;
    private kind: Uint8Array;
    private alive: Uint8Array;
    private group: Int32Array;
    private color: string[];
    private free: number[] = [];
    private order: number[] = [];
    private groups = new Map<number, Group>();
    private nextGroup = 1;
    count = 0;

    constructor(max = 768) {
        this.max = max;
        this.x = new Float32Array(max);
        this.y = new Float32Array(max);
        this.vx = new Float32Array(max);
        this.vy = new Float32Array(max);
        this.tx = new Float32Array(max);
        this.ty = new Float32Array(max);
        this.life = new Float32Array(max);
        this.ttl = new Float32Array(max);
        this.size = new Float32Array(max);
        this.rot = new Float32Array(max);
        this.vr = new Float32Array(max);
        this.kind = new Uint8Array(max);
        this.alive = new Uint8Array(max);
        this.group = new Int32Array(max);
        this.color = new Array<string>(max).fill("");
        for (let i = max - 1; i >= 0; i--) this.free.push(i);
    }

    private allocate(): number {
        let index = this.free.pop();
        if (index === undefined) {
            // Full: recycle the oldest.
            index = this.order.shift() as number;
            this.release(index, false);
            index = this.free.pop() as number;
        }
        this.alive[index] = 1;
        this.order.push(index);
        this.count++;
        return index;
    }

    private release(index: number, unlink = true): void {
        if (!this.alive[index]) return;
        this.alive[index] = 0;
        this.count--;
        this.free.push(index);
        if (unlink) {
            const at = this.order.indexOf(index);
            if (at >= 0) this.order.splice(at, 1);
        }
    }

    emit(kind: ParticleKind, options: EmitOptions): number {
        const rnd = options.random ?? Math.random;
        const count = Math.max(0, Math.min(this.max, Math.round(options.count ?? 12)));
        const spread = options.spread ?? 60;
        const speed = options.speed ?? 180;
        const groupId = this.nextGroup++;
        this.groups.set(groupId, { onArrive: options.onArrive });
        for (let n = 0; n < count; n++) {
            const i = this.allocate();
            const angle = rnd() * Math.PI * 2;
            const mag = speed * (0.4 + rnd() * 0.8);
            this.kind[i] = KIND_ID[kind];
            this.group[i] = groupId;
            this.color[i] = options.colors[Math.floor(rnd() * options.colors.length)] ?? options.colors[0] ?? "";
            this.life[i] = 0;
            this.rot[i] = rnd() * Math.PI * 2;
            this.vr[i] = (rnd() - 0.5) * 8;
            this.size[i] = options.size ?? (kind === "confetti" ? 4 + rnd() * 4 : kind === "orb" ? 3 + rnd() * 2 : 2 + rnd() * 2);
            switch (kind) {
                case "orb":
                    this.x[i] = options.from.x + (rnd() - 0.5) * spread * 0.5;
                    this.y[i] = options.from.y + (rnd() - 0.5) * spread * 0.5;
                    this.vx[i] = Math.cos(angle) * mag;
                    this.vy[i] = Math.sin(angle) * mag - 60;
                    this.tx[i] = options.to?.x ?? options.from.x;
                    this.ty[i] = options.to?.y ?? options.from.y - 120;
                    this.ttl[i] = options.ttl ?? 2.2;
                    break;
                case "spark":
                    this.x[i] = options.from.x;
                    this.y[i] = options.from.y;
                    this.vx[i] = Math.cos(angle) * mag * 1.4;
                    this.vy[i] = Math.sin(angle) * mag * 1.4;
                    this.ttl[i] = options.ttl ?? 0.5 + rnd() * 0.4;
                    break;
                case "confetti":
                    this.x[i] = options.from.x + (rnd() - 0.5) * spread;
                    this.y[i] = options.from.y - rnd() * 40;
                    this.vx[i] = (rnd() - 0.5) * 120;
                    this.vy[i] = 40 + rnd() * 120;
                    this.ttl[i] = options.ttl ?? 2.4 + rnd() * 0.8;
                    break;
                case "ember":
                    this.x[i] = options.from.x + (rnd() - 0.5) * spread;
                    this.y[i] = options.from.y + (rnd() - 0.5) * 12;
                    this.vx[i] = (rnd() - 0.5) * 30;
                    this.vy[i] = -(30 + rnd() * 50);
                    this.ttl[i] = options.ttl ?? 1.2 + rnd() * 0.8;
                    break;
                case "glint":
                    this.x[i] = options.from.x + (rnd() - 0.5) * spread;
                    this.y[i] = options.from.y + (rnd() - 0.5) * spread * 0.4;
                    this.vx[i] = 0;
                    this.vy[i] = 0;
                    this.size[i] = options.size ?? 5 + rnd() * 5;
                    this.ttl[i] = options.ttl ?? 0.55 + rnd() * 0.3;
                    break;
                case "ring":
                    this.x[i] = options.from.x;
                    this.y[i] = options.from.y;
                    this.vx[i] = 0;
                    this.vy[i] = 0;
                    this.size[i] = options.size ?? 60;
                    this.ttl[i] = options.ttl ?? 0.5;
                    break;
            }
        }
        return count;
    }

    step(dt: number): void {
        const d = Math.min(0.05, Math.max(0, dt));
        if (!d || !this.count) return;
        for (let n = this.order.length - 1; n >= 0; n--) {
            const i = this.order[n];
            this.life[i] += d;
            const k = this.kind[i];
            if (k === KIND_ID.orb) {
                // Steer harder as the orb ages, so it arrives in about 0.6 s.
                const dx = this.tx[i] - this.x[i];
                const dy = this.ty[i] - this.y[i];
                const dist = Math.hypot(dx, dy);
                if (dist < 10 || this.life[i] > this.ttl[i]) {
                    const group = this.groups.get(this.group[i]);
                    this.release(i);
                    group?.onArrive?.();
                    continue;
                }
                const pull = 6 + this.life[i] * 22;
                const tvx = (dx / dist) * 520;
                const tvy = (dy / dist) * 520;
                const blend = 1 - Math.exp(-pull * d);
                this.vx[i] += (tvx - this.vx[i]) * blend;
                this.vy[i] += (tvy - this.vy[i]) * blend;
            } else if (k === KIND_ID.spark) {
                this.vx[i] *= 1 - 3 * d;
                this.vy[i] = this.vy[i] * (1 - 3 * d) + 300 * d;
            } else if (k === KIND_ID.confetti) {
                this.vx[i] += Math.sin(this.life[i] * 6 + i) * 40 * d;
                this.vy[i] = Math.min(220, this.vy[i] + 160 * d);
                this.rot[i] += this.vr[i] * d;
            } else if (k === KIND_ID.ember) {
                this.vx[i] += Math.sin(this.life[i] * 5 + i) * 20 * d;
                this.vy[i] -= 10 * d;
            }
            this.x[i] += this.vx[i] * d;
            this.y[i] += this.vy[i] * d;
            if (k !== KIND_ID.orb && this.life[i] >= this.ttl[i]) this.release(i);
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        for (const i of this.order) {
            const t = Math.min(1, this.life[i] / this.ttl[i]);
            const k = this.kind[i];
            const size = this.size[i];
            ctx.fillStyle = this.color[i];
            ctx.strokeStyle = this.color[i];
            if (k === KIND_ID.orb) {
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.arc(this.x[i], this.y[i], size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.arc(this.x[i] - this.vx[i] * 0.02, this.y[i] - this.vy[i] * 0.02, size * 0.7, 0, Math.PI * 2);
                ctx.fill();
            } else if (k === KIND_ID.spark) {
                ctx.globalAlpha = 1 - t;
                ctx.lineWidth = Math.max(1, size * 0.6);
                ctx.beginPath();
                ctx.moveTo(this.x[i], this.y[i]);
                ctx.lineTo(this.x[i] - this.vx[i] * 0.03, this.y[i] - this.vy[i] * 0.03);
                ctx.stroke();
            } else if (k === KIND_ID.confetti) {
                ctx.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1;
                ctx.save();
                ctx.translate(this.x[i], this.y[i]);
                ctx.rotate(this.rot[i]);
                ctx.fillRect(-size / 2, -size / 4, size, size / 2);
                ctx.restore();
            } else if (k === KIND_ID.ember) {
                ctx.globalAlpha = (1 - t) * (0.6 + 0.4 * Math.sin(this.life[i] * 18 + i));
                ctx.fillRect(this.x[i] - size / 2, this.y[i] - size / 2, size, size);
            } else if (k === KIND_ID.glint) {
                const scale = Math.sin(t * Math.PI);
                ctx.globalAlpha = scale;
                const r = size * scale;
                ctx.beginPath();
                ctx.moveTo(this.x[i], this.y[i] - r);
                ctx.lineTo(this.x[i] + r * 0.25, this.y[i] - r * 0.25);
                ctx.lineTo(this.x[i] + r, this.y[i]);
                ctx.lineTo(this.x[i] + r * 0.25, this.y[i] + r * 0.25);
                ctx.lineTo(this.x[i], this.y[i] + r);
                ctx.lineTo(this.x[i] - r * 0.25, this.y[i] + r * 0.25);
                ctx.lineTo(this.x[i] - r, this.y[i]);
                ctx.lineTo(this.x[i] - r * 0.25, this.y[i] - r * 0.25);
                ctx.closePath();
                ctx.fill();
            } else if (k === KIND_ID.ring) {
                ctx.globalAlpha = 1 - t;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x[i], this.y[i], 6 + size * t, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    clear(): void {
        for (const i of this.order.slice()) this.release(i, false);
        this.order.length = 0;
        this.groups.clear();
    }
}

// ── room wipe: a pixel dissolve over a rectangle, swap in the middle ─────
export interface WipeOptions {
    rect: { x: number; y: number; width: number; height: number };
    color: string;
    cell?: number;
    inMs?: number;
    outMs?: number;
    onSwap?: () => void;
    seed?: number;
}

function hash(seed: number, i: number): number {
    let h = (seed ^ (i * 374761393)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Wipe {
    private elapsed = 0;
    private swapped = false;
    readonly cell: number;
    readonly inMs: number;
    readonly outMs: number;
    readonly seed: number;
    done = false;

    constructor(readonly options: WipeOptions) {
        this.cell = options.cell ?? 14;
        this.inMs = options.inMs ?? 160;
        this.outMs = options.outMs ?? 200;
        this.seed = options.seed ?? Math.floor(Math.random() * 1e9);
    }

    step(dt: number): void {
        this.elapsed += dt * 1000;
        if (!this.swapped && this.elapsed >= this.inMs) {
            this.swapped = true;
            this.options.onSwap?.();
        }
        if (this.elapsed >= this.inMs + this.outMs) this.done = true;
    }

    /** Alpha of cell i at the current time (exposed for tests). */
    alphaAt(i: number): number {
        const h = hash(this.seed, i);
        if (this.elapsed < this.inMs) return Math.max(0, Math.min(1, (this.elapsed / this.inMs - h) / 0.25 + 1));
        const out = (this.elapsed - this.inMs) / this.outMs;
        return Math.max(0, Math.min(1, 1 - (out - h) / 0.25));
    }

    render(ctx: CanvasRenderingContext2D): void {
        const { rect, color } = this.options;
        const cols = Math.ceil(rect.width / this.cell);
        const rows = Math.ceil(rect.height / this.cell);
        ctx.fillStyle = color;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const a = this.alphaAt(r * cols + c);
                if (a <= 0) continue;
                ctx.globalAlpha = a;
                ctx.fillRect(rect.x + c * this.cell, rect.y + r * this.cell, this.cell, this.cell);
            }
        }
        ctx.globalAlpha = 1;
    }
}
