"use strict";
// TermForge hidden gem — DAEMON STORM, a pixel shooter inside the TTY HUD.
//
// Not a listed command. The TUI unlocks it via the Konami sequence or the
// classic Adventure words `xyzzy` / `plugh`. Rogue processes descend on the
// shell in formation; you are the prompt, and every shot is a signal.
//
// Everything below the one-line status bar is a PixelBuffer (pixels.js): the
// terminal's half-block cells give a cols×(2·rows) 24-bit framebuffer, so
// sprites, particles, a pixel font, shields that erode pixel by pixel, and
// CRT scanlines all fit in plain ANSI.
//
// The world is simulated at a fixed 50 ms tick with a seeded RNG, so a run
// is a pure function of (seed, cols, rows, key events) — tests and the doc
// capture replay it; the host only owns the timer.
//
//   ROGUE PROCESSES
//     zombie   Z-shaped, top row, 30 pids     — slow, worth the most
//     daemon   crab-shaped, middle rows, 20   — the bulk of every wave
//     fork     ring-shaped, bottom row, 40    — a fork bomb: killing one
//              spawns two forklets that leave the formation and hunt free
//   POWER-UPS (dropped by daemons)
//     sudo     triple shot for a while
//     nice     the whole formation runs at half speed
//   WAVES      SIGHUP → SIGINT → SIGKILL. Clear all three to restore the system.

const { PixelBuffer, PixelScreen, scaleColor, mixColor } = require("./pixels.js");

const ESC = "\u001b";
const CSI = `${ESC}[`;
const KONAMI = Object.freeze(["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"]);
const SECRET_WORDS = new Set(["xyzzy", "plugh"]);

const TICK_MS = 50;
const DT = TICK_MS / 1000;
const MIN_COLS = 60;
const MIN_ROWS = 14;
const GEM_ITEM = "kill_switch";
const WAVE_XP = 20;
const WIN_XP = 40;

const COLOR = Object.freeze({
    ship: [80, 255, 120],
    shipCore: [220, 255, 240],
    bullet: [200, 255, 255],
    bulletHead: [255, 255, 255],
    bolt: [255, 80, 80],
    boltHead: [255, 200, 160],
    zombie: [190, 150, 255],
    daemon: [255, 150, 60],
    fork: [255, 80, 220],
    forklet: [255, 150, 240],
    shield: [70, 200, 100],
    shieldDim: [40, 130, 70],
    sudo: [255, 220, 80],
    nice: [90, 180, 255],
    text: [200, 230, 255],
    title: [120, 255, 170],
    warn: [255, 120, 120],
    star: [110, 120, 150],
    starFar: [60, 65, 90],
});

const SPRITES = Object.freeze({
    ship: {
        frames: [["...o...", "..#o#..", ".#####.", "###.###"]],
        pal: { "#": COLOR.ship, o: COLOR.shipCore },
    },
    zombie: {
        frames: [
            ["######", "....#.", "..##..", ".#....", "######"],
            ["######", "...#..", "..##..", "..#...", "######"],
        ],
        pal: { "#": COLOR.zombie },
        points: 30,
    },
    daemon: {
        frames: [
            ["..#..#..", ".######.", "##.##.##", "########", "#.#..#.#"],
            ["..#..#..", ".######.", "##.##.##", "########", ".#....#."],
        ],
        pal: { "#": COLOR.daemon },
        points: 20,
    },
    fork: {
        frames: [
            ["..##..", ".#..#.", "#....#", ".#..#.", "..##.."],
            [".####.", "#....#", "#....#", "#....#", ".####."],
        ],
        pal: { "#": COLOR.fork },
        points: 40,
    },
    forklet: {
        frames: [
            [".##.", "#..#", ".##."],
            ["####", "#..#", "####"],
        ],
        pal: { "#": COLOR.forklet },
        points: 10,
    },
});

const SHIELD_SHAPE = Object.freeze([
    ".########.",
    "##########",
    "##########",
    "###....###",
    "###....###",
]);

const WAVES = Object.freeze([
    { name: "SIGHUP", rows: ["zombie", "daemon", "daemon"], speed: 9, fire: 0.5 },
    { name: "SIGINT", rows: ["zombie", "daemon", "daemon", "fork"], speed: 12, fire: 0.75 },
    { name: "SIGKILL", rows: ["zombie", "zombie", "daemon", "daemon", "fork"], speed: 15, fire: 1.0 },
]);

const PLAYER_SPEED = 52;      // px/s while a move key is held (auto-repeat)
const MOVE_HOLD = 0.14;       // s a keypress keeps the ship moving
const BULLET_SPEED = 90;
const FIRE_COOLDOWN = 0.16;
const MAX_BULLETS = 2;
const POWER_SECONDS = 7;
const DROP_CHANCE = 0.09;
const BOLT_BASE_SPEED = 26;
const RESPAWN_SECONDS = 1.4;
const INVULN_SECONDS = 1.6;
const BANNER_SECONDS = 1.6;
const END_SECONDS = 3.0;
const LIVES = 3;
const STARS = 42;

// ── unlock helpers ───────────────────────────────────────────────────────────

function isSecretLine(line) {
    return SECRET_WORDS.has(String(line || "").trim().toLowerCase());
}

function tokenFromEvent(ev) {
    if (!ev) return null;
    if (ev.type === "histPrev") return "up";
    if (ev.type === "histNext") return "down";
    if (ev.type === "arrow") return ev.dir || null;
    if (ev.type === "char") {
        const ch = String(ev.ch || "").toLowerCase();
        return ch.length === 1 ? ch : null;
    }
    return null;
}

function createKonamiWatcher(onUnlock) {
    let i = 0;
    return {
        feed(token) {
            if (!token) return false;
            if (token === KONAMI[i]) {
                i += 1;
                if (i === KONAMI.length) {
                    i = 0;
                    if (typeof onUnlock === "function") onUnlock();
                    return true;
                }
                return false;
            }
            i = token === KONAMI[0] ? 1 : 0;
            return false;
        },
        reset() { i = 0; },
        get index() { return i; },
    };
}

/**
 * XP the dungeon pays for a run: WAVE_XP per wave cleared beyond the session's
 * previous best, plus WIN_XP and the kill_switch the first time the storm is
 * beaten. Losing after new waves still pays for those waves; replaying pays
 * nothing until you get further.
 */
function gemRewardXp(result, previousWaves) {
    const waves = Math.max(0, Math.min(WAVES.length, Number((result && result.waves) || 0)));
    const prev = Math.max(0, Number(previousWaves || 0));
    return Math.max(0, waves - prev) * WAVE_XP;
}

function grantGemReward(runtime, result) {
    if (!runtime || !runtime.state) return { granted: false };
    const s = runtime.state;
    s.flags = s.flags || {};
    const prevWaves = Number(s.flags.daemon_storm_waves || 0);
    const won = Boolean(result && result.won);
    const firstWin = won && !s.flags.daemon_storm;
    let xp = gemRewardXp(result, prevWaves);
    if (firstWin) xp += WIN_XP;
    const waves = Math.max(prevWaves, Math.min(WAVES.length, Number((result && result.waves) || 0)));
    if (xp === 0 && !firstWin) return { granted: false, already: true, waves };
    s.flags.daemon_storm_waves = waves;
    s.xp = (s.xp || 0) + xp;
    let item = null;
    if (firstWin) {
        s.flags.daemon_storm = true;
        if (Array.isArray(s.inventory) && !s.inventory.includes(GEM_ITEM)) s.inventory.push(GEM_ITEM);
        item = GEM_ITEM;
    }
    return { granted: true, xp, item, waves, firstWin };
}

// ── deterministic RNG ────────────────────────────────────────────────────────

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── the game ─────────────────────────────────────────────────────────────────

class DaemonStorm {
    constructor(options) {
        const opts = options || {};
        if (typeof opts.write !== "function") throw new Error("createGemSession requires options.write");
        this._write = opts.write;
        this.color = opts.color !== false;
        this.cols = opts.cols || 80;
        this.rows = opts.rows || 24;
        this.onQuit = opts.onQuit || (() => {});
        this.animate = Boolean(opts.animate);
        this.intervalMs = opts.intervalMs || TICK_MS;
        this.seed = opts.seed == null ? (Date.now() >>> 0) : (Number(opts.seed) >>> 0);
        this.rng = mulberry32(this.seed);
        this._timer = null;
        this._closed = false;
        this.crt = opts.crt !== false;
        this.tickCount = 0;
        this.time = 0;
        this.score = 0;
        this.best = Number(opts.best || 0);
        this.lives = LIVES;
        this.wave = 0;              // index into WAVES of the wave in progress
        this.wavesCleared = 0;
        this.kills = 0;
        this.shots = 0;
        this.state = "title";       // title | banner | play | respawn | clear | victory | gameover | tooSmall
        this.stateTime = 0;
        this.enemies = [];
        this.bullets = [];
        this.bolts = [];
        this.particles = [];
        this.drops = [];
        this.stars = [];
        this.shield = new Set();
        this.formation = { x: 0, y: 0, dir: 1, speed: 0, pulse: 0 };
        this.player = { x: 0, y: 0, vx: 0, hold: 0, cooldown: 0, invuln: 0, alive: true };
        this.power = { sudo: 0, nice: 0 };
        this.shake = 0;
        this.flash = 0;
        this.frame = 0;
        this._layout();
        this._seedStars();
    }

    // ── layout ──────────────────────────────────────────────────────────────

    _layout() {
        this.W = Math.max(1, this.cols);
        this.H = Math.max(2, (this.rows - 2) * 2);
        this.world = new PixelBuffer(this.W, this.H);
        this.frameBuf = new PixelBuffer(this.W, this.H);
        this.screen = new PixelScreen({ write: this._write, top: 2, color: this.color });
        this.tooSmall = this.cols < MIN_COLS || this.rows < MIN_ROWS;
        if (this.tooSmall) this.state = "tooSmall";
        this.player.y = this.H - 6;
        this.player.x = Math.min(Math.max(this.player.x || Math.floor(this.W / 2) - 3, 0), this.W - 7);
        this.shieldY = this.H - 16;
    }

    _seedStars() {
        this.stars = [];
        for (let i = 0; i < STARS; i += 1) {
            this.stars.push({
                x: this.rng() * this.W,
                y: this.rng() * this.H,
                far: this.rng() < 0.6,
            });
        }
    }

    _buildShields() {
        this.shield = new Set();
        const count = this.W >= 96 ? 4 : 3;
        const span = this.W / (count + 1);
        for (let i = 1; i <= count; i += 1) {
            const ox = Math.round(span * i - SHIELD_SHAPE[0].length / 2);
            for (let r = 0; r < SHIELD_SHAPE.length; r += 1) {
                for (let c = 0; c < SHIELD_SHAPE[r].length; c += 1) {
                    if (SHIELD_SHAPE[r][c] === "#") this.shield.add(`${ox + c},${this.shieldY + r}`);
                }
            }
        }
    }

    _spawnWave(index) {
        const def = WAVES[index];
        const colStep = 10;
        const rowStep = 7;
        const cols = Math.max(4, Math.min(11, Math.floor((this.W - 14) / colStep)));
        this.enemies = [];
        for (let r = 0; r < def.rows.length; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                this.enemies.push({
                    kind: def.rows[r], col: c, row: r, free: false,
                    x: 0, y: 0, vx: 0, vy: 0, alive: true, frame: 0,
                });
            }
        }
        this.formationCols = cols;
        this.formationTotal = this.enemies.length;
        this.formation = {
            x: Math.floor((this.W - cols * colStep) / 2),
            y: 8,
            dir: 1,
            speed: def.speed,
            pulse: 0,
            colStep,
            rowStep,
        };
        this._placeFormation();
        this.bolts = [];
        this.drops = [];
    }

    _placeFormation() {
        for (const e of this.enemies) {
            if (e.free || !e.alive) continue;
            const spr = SPRITES[e.kind];
            const w = spr.frames[0][0].length;
            e.x = this.formation.x + e.col * this.formation.colStep + Math.floor((8 - w) / 2);
            e.y = this.formation.y + e.row * this.formation.rowStep;
        }
    }

    _startGame() {
        this.score = 0;
        this.lives = LIVES;
        this.wave = 0;
        this.wavesCleared = 0;
        this.kills = 0;
        this.shots = 0;
        this.bullets = [];
        this.particles = [];
        this.power = { sudo: 0, nice: 0 };
        this.player.x = Math.floor(this.W / 2) - 3;
        this.player.alive = true;
        this.player.invuln = 0;
        this._buildShields();
        this._spawnWave(0);
        this._setState("banner");
    }

    _setState(state) {
        this.state = state;
        this.stateTime = 0;
    }

    // ── input ───────────────────────────────────────────────────────────────

    feed(ev) {
        if (this._closed || !ev) return;
        if (ev.type === "interrupt") {
            this.quit("interrupt");
            return;
        }
        let key = null;
        if (ev.type === "char") key = String(ev.ch || "").toLowerCase();
        else if (ev.type === "arrow") key = ev.dir;
        else if (ev.type === "histPrev") key = "up";
        else if (ev.type === "histNext") key = "down";
        else if (ev.type === "submit") key = "enter";
        if (!key) return;

        if (key === "q") {
            this.quit("quit");
            return;
        }
        if (key === "c") {
            this.crt = !this.crt;
            return;
        }
        if (this.state === "tooSmall") return;
        const fire = key === " " || key === "up" || key === "k" || key === "w" || key === "enter";
        if (this.state === "title") {
            if (fire) this._startGame();
            return;
        }
        if (this.state !== "play") return;
        if (key === "left" || key === "a" || key === "h") this._nudge(-1);
        else if (key === "right" || key === "d" || key === "l") this._nudge(1);
        else if (key === "down" || key === "s" || key === "j") this.player.hold = 0;
        else if (fire) this._fire();
    }

    _nudge(dir) {
        this.player.vx = dir * PLAYER_SPEED;
        this.player.hold = MOVE_HOLD;
        // A tap always moves at least one pixel, even between ticks.
        this.player.x = Math.min(Math.max(this.player.x + dir, 0), this.W - 7);
    }

    _fire() {
        if (!this.player.alive || this.player.cooldown > 0) return;
        const live = this.bullets.length;
        if (live >= MAX_BULLETS + (this.power.sudo > 0 ? 2 : 0)) return;
        const x = this.player.x + 3;
        const y = this.player.y - 1;
        const spread = this.power.sudo > 0 ? [-1, 0, 1] : [0];
        for (const s of spread) {
            this.bullets.push({ x, y, vx: s * 18, vy: -BULLET_SPEED, trail: [] });
        }
        this.shots += 1;
        this.player.cooldown = FIRE_COOLDOWN;
        this._burst(x, y, 3, COLOR.bullet, 18, 0.15);
    }

    // ── simulation ──────────────────────────────────────────────────────────

    tick() {
        if (this._closed) return;
        this.tickCount += 1;
        this.time += DT;
        this.stateTime += DT;
        this.frame = Math.floor(this.time * 2.5) & 1;
        this._updateStars();
        this._updateParticles();
        if (this.shake > 0) this.shake -= DT;
        if (this.flash > 0) this.flash -= DT;

        switch (this.state) {
            case "title":
                this._updateTitle();
                break;
            case "banner":
                if (this.stateTime >= BANNER_SECONDS) this._setState("play");
                break;
            case "play":
                this._updatePlay();
                break;
            case "respawn":
                this._updateBullets();
                this._updateBolts();
                if (this.stateTime >= RESPAWN_SECONDS) {
                    this.player.alive = true;
                    this.player.invuln = INVULN_SECONDS;
                    this.player.x = Math.floor(this.W / 2) - 3;
                    this._setState("play");
                }
                break;
            case "clear":
                this._updateBullets();
                if (this.stateTime >= BANNER_SECONDS) {
                    this.wave += 1;
                    if (this.wave >= WAVES.length) {
                        this._setState("victory");
                    } else {
                        this._spawnWave(this.wave);
                        this._setState("banner");
                    }
                }
                break;
            case "victory":
                if (this.tickCount % 3 === 0) {
                    this._burst(this.rng() * this.W, this.rng() * this.H * 0.6, 14,
                        [COLOR.title, COLOR.sudo, COLOR.bullet, COLOR.fork][this.tickCount % 4], 30, 0.9);
                }
                if (this.stateTime >= END_SECONDS) this.quit("win");
                break;
            case "gameover":
                if (this.stateTime >= END_SECONDS) this.quit("lost");
                break;
            default:
                break;
        }
        if (!this._closed) this.paint();
    }

    _updateTitle() {
        // A demo formation bobs behind the title; it never shoots.
        if (!this.enemies.length) {
            this.enemies = [];
            const kinds = ["zombie", "daemon", "fork", "daemon", "zombie"];
            const total = kinds.length * 10;
            const x0 = Math.floor((this.W - total) / 2);
            kinds.forEach((kind, i) => this.enemies.push({
                kind, col: i, row: 0, free: false, x: x0 + i * 10, y: 0, alive: true, frame: 0, vx: 0, vy: 0,
            }));
        }
        const bob = Math.sin(this.time * 2) * 2;
        this.enemies.forEach((e, i) => { e.y = Math.round(this.H * 0.62 + bob + Math.sin(this.time * 3 + i) * 1.5); });
    }

    _updateStars() {
        for (const s of this.stars) {
            s.y += (s.far ? 3 : 7) * DT;
            if (s.y >= this.H) {
                s.y = 0;
                s.x = this.rng() * this.W;
            }
        }
    }

    _updateParticles() {
        const keep = [];
        for (const p of this.particles) {
            p.life -= DT;
            if (p.life <= 0) continue;
            p.x += p.vx * DT;
            p.y += p.vy * DT;
            p.vx *= 0.94;
            p.vy = p.vy * 0.94 + p.gravity * DT;
            keep.push(p);
        }
        this.particles = keep;
    }

    _updatePlay() {
        const p = this.player;
        if (p.hold > 0) {
            p.hold -= DT;
            p.x = Math.min(Math.max(p.x + p.vx * DT, 0), this.W - 7);
        } else {
            p.vx = 0;
        }
        if (p.cooldown > 0) p.cooldown -= DT;
        if (p.invuln > 0) p.invuln -= DT;
        if (this.power.sudo > 0) this.power.sudo -= DT;
        if (this.power.nice > 0) this.power.nice -= DT;

        this._updateFormation();
        this._updateFree();
        this._updateBullets();
        this._enemyFire();
        this._updateBolts();
        this._updateDrops();
        this._collide();

        const alive = this.enemies.filter((e) => e.alive);
        if (!alive.length) {
            this.wavesCleared = this.wave + 1;
            const bonus = 100 * (this.wave + 1) + this.lives * 50;
            this.score += bonus;
            this.best = Math.max(this.best, this.score);
            this._setState("clear");
            return;
        }
        for (const e of alive) {
            if (e.y + this._height(e) >= p.y) {
                this._playerHit("overrun");
                break;
            }
        }
    }

    _height(e) {
        return SPRITES[e.kind].frames[0].length;
    }

    _width(e) {
        return SPRITES[e.kind].frames[0][0].length;
    }

    _updateFormation() {
        const members = this.enemies.filter((e) => e.alive && !e.free);
        if (!members.length) return;
        const f = this.formation;
        const remaining = members.length / this.formationTotal;
        let speed = f.speed * (1 + 2.2 * (1 - remaining));
        if (this.power.nice > 0) speed *= 0.5;
        f.x += f.dir * speed * DT;
        this._placeFormation();
        let minX = Infinity;
        let maxX = -Infinity;
        for (const e of members) {
            minX = Math.min(minX, e.x);
            maxX = Math.max(maxX, e.x + this._width(e));
        }
        if ((f.dir > 0 && maxX >= this.W - 1) || (f.dir < 0 && minX <= 1)) {
            f.dir *= -1;
            f.y += 3;
            f.x += f.dir * 1;
            this._placeFormation();
        }
        // Enemies chew through shields on contact.
        for (const e of members) this._eraseShield(e.x, e.y, this._width(e), this._height(e));
    }

    _updateFree() {
        for (const e of this.enemies) {
            if (!e.alive || !e.free) continue;
            const w = this._width(e);
            e.x += e.vx * DT * (this.power.nice > 0 ? 0.5 : 1);
            e.y += e.vy * DT;
            if (e.x <= 0) { e.x = 0; e.vx = Math.abs(e.vx); }
            if (e.x + w >= this.W) { e.x = this.W - w; e.vx = -Math.abs(e.vx); }
            this._eraseShield(e.x, e.y, w, this._height(e));
        }
    }

    _updateBullets() {
        const keep = [];
        for (const b of this.bullets) {
            b.trail.unshift([b.x, b.y]);
            if (b.trail.length > 4) b.trail.length = 4;
            b.x += b.vx * DT;
            b.y += b.vy * DT;
            if (b.y < -3 || b.x < 0 || b.x >= this.W) continue;
            keep.push(b);
        }
        this.bullets = keep;
    }

    _enemyFire() {
        const def = WAVES[this.wave];
        if (this.rng() > def.fire * DT * 1.8) return;
        // Bottom-most alive member per formation column, plus every forklet.
        const bottom = new Map();
        for (const e of this.enemies) {
            if (!e.alive) continue;
            if (e.free) {
                if (this.rng() < 0.25) bottom.set(`free${e.col}${e.row}${e.x}`, e);
                continue;
            }
            const cur = bottom.get(e.col);
            if (!cur || e.row > cur.row) bottom.set(e.col, e);
        }
        const shooters = Array.from(bottom.values());
        if (!shooters.length) return;
        const s = shooters[Math.floor(this.rng() * shooters.length)];
        this.bolts.push({
            x: s.x + Math.floor(this._width(s) / 2),
            y: s.y + this._height(s),
            vy: BOLT_BASE_SPEED + 5 * this.wave + this.rng() * 6,
        });
    }

    _updateBolts() {
        const keep = [];
        for (const b of this.bolts) {
            b.y += b.vy * DT;
            if (b.y >= this.H) continue;
            keep.push(b);
        }
        this.bolts = keep;
    }

    _updateDrops() {
        const keep = [];
        for (const d of this.drops) {
            d.y += 14 * DT;
            if (d.y >= this.H) continue;
            keep.push(d);
        }
        this.drops = keep;
    }

    _collide() {
        const p = this.player;
        // bullets → enemies / shields
        const survivors = [];
        for (const b of this.bullets) {
            let hit = false;
            const bx = Math.round(b.x);
            const by = Math.round(b.y);
            for (const e of this.enemies) {
                if (!e.alive) continue;
                const w = this._width(e);
                const h = this._height(e);
                if (bx >= Math.round(e.x) && bx < Math.round(e.x) + w && by >= Math.round(e.y) - 1 && by < Math.round(e.y) + h) {
                    this._killEnemy(e);
                    hit = true;
                    break;
                }
            }
            if (!hit && this._shieldAt(bx, by)) {
                this._eraseShield(bx - 1, by - 1, 3, 2);
                this._burst(bx, by, 4, COLOR.shield, 12, 0.3);
                hit = true;
            }
            if (!hit) survivors.push(b);
        }
        this.bullets = survivors;

        // bolts → shields / player
        const keep = [];
        for (const b of this.bolts) {
            const bx = Math.round(b.x);
            const by = Math.round(b.y);
            if (this._shieldAt(bx, by) || this._shieldAt(bx, by + 1)) {
                this._eraseShield(bx - 1, by, 3, 2);
                this._burst(bx, by, 4, COLOR.bolt, 12, 0.3);
                continue;
            }
            if (p.alive && p.invuln <= 0 && bx >= p.x && bx < p.x + 7 && by + 1 >= p.y && by < p.y + 4) {
                this._playerHit("bolt");
                continue;
            }
            keep.push(b);
        }
        this.bolts = keep;

        // drops → player
        const drops = [];
        for (const d of this.drops) {
            if (p.alive && d.x + 5 > p.x && d.x < p.x + 7 && d.y + 5 > p.y && d.y < p.y + 4) {
                this.power[d.kind] = POWER_SECONDS;
                this.score += 50;
                this._burst(d.x + 2, d.y + 2, 12, d.kind === "sudo" ? COLOR.sudo : COLOR.nice, 26, 0.5);
                continue;
            }
            drops.push(d);
        }
        this.drops = drops;
    }

    _killEnemy(e) {
        const spr = SPRITES[e.kind];
        e.alive = false;
        this.kills += 1;
        this.score += spr.points;
        this.best = Math.max(this.best, this.score);
        const cx = e.x + this._width(e) / 2;
        const cy = e.y + this._height(e) / 2;
        this._burst(cx, cy, e.kind === "fork" ? 18 : 10, spr.pal["#"], 34, 0.6);
        if (e.kind === "fork") {
            // fork(): two children leave the formation and hunt on their own.
            for (const dir of [-1, 1]) {
                this.enemies.push({
                    kind: "forklet", col: e.col, row: e.row, free: true,
                    x: cx + dir * 3 - 2, y: e.y + 1, vx: dir * 24, vy: 3.5, alive: true, frame: 0,
                });
            }
            this.formationTotal += 2;
        } else if (e.kind === "daemon" && this.rng() < DROP_CHANCE) {
            this.drops.push({ x: Math.round(cx) - 2, y: e.y, kind: this.rng() < 0.5 ? "sudo" : "nice" });
        }
    }

    _playerHit(cause) {
        const p = this.player;
        if (!p.alive) return;
        p.alive = false;
        this.lives -= 1;
        this.shake = 0.35;
        this.flash = 0.12;
        this._burst(p.x + 3, p.y + 2, 26, COLOR.ship, 40, 0.9);
        this._burst(p.x + 3, p.y + 2, 10, COLOR.shipCore, 24, 0.6);
        this.lastHit = cause;
        if (cause === "overrun") {
            // Push the storm back up so the respawn has room to breathe.
            this.formation.y = Math.max(8, this.formation.y - 14);
            for (const e of this.enemies) if (e.free) e.y = Math.max(8, e.y - 14);
            this._placeFormation();
        }
        this.bolts = [];
        if (this.lives <= 0) {
            this._setState("gameover");
        } else {
            this._setState("respawn");
        }
    }

    _shieldAt(x, y) {
        return this.shield.has(`${x},${y}`);
    }

    _eraseShield(x, y, w, h) {
        const x0 = Math.round(x);
        const y0 = Math.round(y);
        let erased = 0;
        for (let py = y0; py < y0 + h; py += 1) {
            for (let px = x0; px < x0 + w; px += 1) {
                if (this.shield.delete(`${px},${py}`)) erased += 1;
            }
        }
        return erased;
    }

    _burst(x, y, n, color, speed, life) {
        for (let i = 0; i < n; i += 1) {
            const a = this.rng() * Math.PI * 2;
            const v = speed * (0.3 + this.rng() * 0.7);
            this.particles.push({
                x, y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                gravity: 6,
                life: life * (0.5 + this.rng() * 0.5),
                ttl: life,
                color,
            });
        }
    }

    // ── painting ────────────────────────────────────────────────────────────

    _statusLine() {
        const def = WAVES[Math.min(this.wave, WAVES.length - 1)];
        const parts = [];
        const sgr = (code, text) => (this.color ? `${CSI}${code}m${text}${CSI}0m` : text);
        parts.push(sgr("1;32", "DAEMON STORM"));
        if (this.state === "title") {
            parts.push(sgr("2", "a hidden gem"));
            parts.push(`best ${this.best}`);
        } else if (this.state === "tooSmall") {
            parts.push(sgr("31", `needs ${MIN_COLS}x${MIN_ROWS}`));
        } else {
            parts.push(`wave ${Math.min(this.wave + 1, WAVES.length)}/${WAVES.length} ${sgr("36", def.name)}`);
            parts.push(`pids ${this.score}`);
            parts.push(`shells ${sgr("33", "$".repeat(Math.max(0, this.lives)))}${sgr("2", ".".repeat(Math.max(0, LIVES - this.lives)))}`);
            if (this.power.sudo > 0) parts.push(sgr("1;33", `sudo ${Math.ceil(this.power.sudo)}s`));
            if (this.power.nice > 0) parts.push(sgr("1;34", `nice ${Math.ceil(this.power.nice)}s`));
        }
        return parts.join(sgr("2", "  │  "));
    }

    _helpLine() {
        const sgr = (code, text) => (this.color ? `${CSI}${code}m${text}${CSI}0m` : text);
        if (this.state === "title") return sgr("2", "space starts   ←→ / a d move   space fires   c toggles scanlines   q leaves");
        return sgr("2", "←→ / a d move   space / ↑ fire   c scanlines   q leaves");
    }

    paint() {
        const w = this.world;
        w.clear();
        if (this.state === "tooSmall") {
            this._centerText(w, Math.floor(this.H / 2) - 6, "DAEMON STORM", COLOR.title, 1);
            this._centerText(w, Math.floor(this.H / 2) + 1, `NEEDS ${MIN_COLS}X${MIN_ROWS}`, COLOR.warn, 1);
        } else {
            this._paintStars(w);
            this._paintShields(w);
            this._paintEnemies(w);
            this._paintDrops(w);
            this._paintBolts(w);
            this._paintBullets(w);
            this._paintPlayer(w);
            this._paintParticles(w);
            this._paintOverlay(w);
        }
        // Compose: shake offset, flash, scanlines.
        const f = this.frameBuf;
        if (this.flash > 0) f.clear(scaleColor([255, 255, 255], Math.min(1, this.flash * 5)));
        else f.clear();
        let ox = 0;
        let oy = 0;
        if (this.shake > 0) {
            ox = Math.round((this.rng() - 0.5) * 4 * Math.min(1, this.shake * 4));
            oy = Math.round((this.rng() - 0.5) * 2 * Math.min(1, this.shake * 4));
        }
        f.blit(w, ox, oy);
        if (this.crt) f.scanlines(0.82);

        const parts = [`${CSI}?25l`, `${CSI}1;1H${CSI}2K${this._statusLine()}`];
        parts.push(`${CSI}${this.rows};1H${CSI}2K${this._helpLine()}`);
        this._write(parts.join(""));
        this.screen.present(f);
    }

    _centerText(buf, y, str, color, scale) {
        const tw = PixelBuffer.textWidth(str, scale);
        return buf.text(Math.floor((this.W - tw) / 2), y, str, color, scale);
    }

    /** Largest of the requested scales whose text fits the field with a margin. */
    _fitScale(str, want) {
        for (let k = want; k > 1; k -= 1) {
            if (PixelBuffer.textWidth(str, k) <= this.W - 6) return k;
        }
        return 1;
    }

    /**
     * A terminal-dialog banner: near-black backdrop with a 1-px rule in the
     * text colour, so words stay legible over whatever is flying underneath.
     */
    _banner(buf, y, str, color, scale) {
        const k = this._fitScale(str, scale);
        const tw = PixelBuffer.textWidth(str, k);
        const th = 5 * k;
        const pad = 2;
        const x0 = Math.floor((this.W - tw) / 2) - pad;
        const y0 = Math.round(y) - pad;
        buf.rect(x0 - 1, y0 - 1, tw + pad * 2 + 2, th + pad * 2 + 2, scaleColor(color, 0.35));
        buf.rect(x0, y0, tw + pad * 2, th + pad * 2, [6, 6, 12]);
        buf.text(x0 + pad, y0 + pad, str, color, k);
        return th + pad * 2 + 2;
    }

    _paintStars(buf) {
        for (const s of this.stars) buf.set(s.x, s.y, s.far ? COLOR.starFar : COLOR.star);
    }

    _paintShields(buf) {
        for (const key of this.shield) {
            const [x, y] = key.split(",").map(Number);
            buf.set(x, y, (x + y) % 2 ? COLOR.shield : COLOR.shieldDim);
        }
    }

    _paintEnemies(buf) {
        for (const e of this.enemies) {
            if (!e.alive) continue;
            const spr = SPRITES[e.kind];
            const frame = spr.frames[(this.frame + (e.free ? 1 : 0)) % spr.frames.length];
            buf.sprite(e.x, e.y, frame, spr.pal);
        }
    }

    _paintDrops(buf) {
        for (const d of this.drops) {
            const c = d.kind === "sudo" ? COLOR.sudo : COLOR.nice;
            const on = this.tickCount % 6 < 4;
            buf.sprite(d.x, d.y, ["#####", "#...#", "#...#", "#...#", "#####"], { "#": on ? c : scaleColor(c, 0.5) });
            buf.text(d.x + 1, d.y + 0, d.kind === "sudo" ? "S" : "N", c, 1);
        }
    }

    _paintBolts(buf) {
        for (const b of this.bolts) {
            buf.set(b.x, b.y, COLOR.boltHead);
            buf.set(b.x, b.y + 1, COLOR.bolt);
            buf.add(b.x - 1, b.y + 1, [50, 10, 10]);
            buf.add(b.x + 1, b.y + 1, [50, 10, 10]);
        }
    }

    _paintBullets(buf) {
        for (const b of this.bullets) {
            b.trail.forEach(([tx, ty], i) => buf.set(tx, ty, scaleColor(COLOR.bullet, 0.55 - i * 0.12)));
            buf.set(b.x, b.y, COLOR.bulletHead);
            buf.set(b.x, b.y + 1, COLOR.bullet);
            buf.add(b.x - 1, b.y, [20, 50, 60]);
            buf.add(b.x + 1, b.y, [20, 50, 60]);
        }
    }

    _paintPlayer(buf) {
        const p = this.player;
        if (this.state === "title" || this.state === "tooSmall") return;
        if (!p.alive) return;
        if (p.invuln > 0 && this.tickCount % 4 < 2) return;
        const spr = SPRITES.ship;
        const pal = this.power.sudo > 0 ? { "#": COLOR.sudo, o: COLOR.shipCore } : spr.pal;
        buf.sprite(p.x, p.y, spr.frames[0], pal);
        // engine flicker
        buf.set(p.x + 3, p.y + 4, this.tickCount % 2 ? [255, 200, 120] : [255, 120, 60]);
    }

    _paintParticles(buf) {
        for (const p of this.particles) {
            const k = Math.max(0, p.life / p.ttl);
            buf.add(p.x, p.y, scaleColor(p.color, 0.25 + 0.75 * k));
        }
    }

    _paintOverlay(buf) {
        const mid = Math.floor(this.H / 2);
        const blink = this.tickCount % 16 < 10;
        switch (this.state) {
            case "title": {
                const scale = this._fitScale("DAEMON STORM", 2);
                const y = Math.floor(this.H * 0.16);
                this._centerText(buf, y, "DAEMON STORM", COLOR.title, scale);
                this._centerText(buf, y + 6 * scale + 2, "ROGUE PROCESSES DESCEND ON THE SHELL", COLOR.text, 1);
                this._centerText(buf, y + 6 * scale + 9, "YOU ARE THE PROMPT. EVERY SHOT IS A SIGNAL.", scaleColor(COLOR.text, 0.7), 1);
                if (blink) this._centerText(buf, this.H * 0.8, "PRESS SPACE", COLOR.sudo, 1);
                break;
            }
            case "banner": {
                const def = WAVES[this.wave];
                const h = this._banner(buf, mid - 10, `WAVE ${this.wave + 1}`, COLOR.title, 2);
                this._banner(buf, mid - 10 + h + 1, `KILL -${def.name.slice(3)} INCOMING`, COLOR.warn, 1);
                break;
            }
            case "respawn":
                if (blink) this._banner(buf, mid - 3, "SEGMENTATION FAULT", COLOR.warn, 1);
                break;
            case "clear": {
                const h = this._banner(buf, mid - 8, `WAVE ${this.wave + 1} CLEARED`, COLOR.title, 1);
                this._banner(buf, mid - 8 + h + 1, `+${100 * (this.wave + 1) + this.lives * 50} PIDS REAPED`, COLOR.sudo, 1);
                break;
            }
            case "victory": {
                const h = this._banner(buf, mid - 12, "SYSTEM RESTORED", COLOR.title, 2);
                this._banner(buf, mid - 12 + h + 1, `${this.score} PIDS REAPED`, COLOR.sudo, 1);
                break;
            }
            case "gameover": {
                const h = this._banner(buf, mid - 12, "KERNEL PANIC", COLOR.warn, 2);
                this._banner(buf, mid - 12 + h + 1, `${this.score} PIDS REAPED  -  WAVE ${this.wave + 1}`, COLOR.text, 1);
                break;
            }
            default:
                break;
        }
    }

    // ── lifecycle ───────────────────────────────────────────────────────────

    start() {
        this._write(`${CSI}?25l${CSI}2J`);
        this.screen.invalidate();
        this.paint();
        if (this.animate) {
            this._timer = setInterval(() => this.tick(), this.intervalMs);
        }
    }

    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    quit(reason) {
        if (this._closed) return;
        this._closed = true;
        this.stop();
        this.onQuit({
            won: reason === "win",
            waves: this.wavesCleared,
            score: this.score,
            best: this.best,
            kills: this.kills,
            shots: this.shots,
            reason: reason || "quit",
        });
    }

    resize(cols, rows) {
        this.cols = cols || this.cols;
        this.rows = rows || this.rows;
        const wasTooSmall = this.tooSmall;
        this._layout();
        if (!this.tooSmall && wasTooSmall) this._setState("title");
        this._seedStars();
        if (this.state !== "title" && this.state !== "tooSmall") {
            this._buildShields();
            this.formation.x = Math.min(this.formation.x, Math.max(0, this.W - this.formationCols * this.formation.colStep));
            this._placeFormation();
        }
        if (!this._closed) {
            this._write(`${CSI}2J`);
            this.screen.invalidate();
            this.paint();
        }
    }

    snapshot() {
        const alive = this.enemies.filter((e) => e.alive);
        return {
            seed: this.seed,
            cols: this.cols,
            rows: this.rows,
            W: this.W,
            H: this.H,
            state: this.state,
            tickCount: this.tickCount,
            wave: this.wave,
            waveName: WAVES[Math.min(this.wave, WAVES.length - 1)].name,
            wavesCleared: this.wavesCleared,
            score: this.score,
            best: this.best,
            lives: this.lives,
            kills: this.kills,
            shots: this.shots,
            enemies: alive.length,
            free: alive.filter((e) => e.free).length,
            bullets: this.bullets.length,
            bolts: this.bolts.length,
            particles: this.particles.length,
            drops: this.drops.length,
            shieldPixels: this.shield.size,
            player: { x: Math.round(this.player.x), y: this.player.y, alive: this.player.alive, invuln: this.player.invuln > 0 },
            power: { sudo: this.power.sudo > 0, nice: this.power.nice > 0 },
            formation: { x: Math.round(this.formation.x), y: this.formation.y, dir: this.formation.dir },
            crt: this.crt,
            closed: this._closed,
        };
    }

    /** Test hook: positions of living enemies. */
    enemyList() {
        return this.enemies.filter((e) => e.alive).map((e) => ({
            kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), free: e.free, w: this._width(e), h: this._height(e),
        }));
    }

    /** Test hook: falling bolts. */
    boltList() {
        return this.bolts.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) }));
    }

    /** Test hook: cheats that make deterministic scenarios cheap. */
    cheat(name, arg) {
        switch (name) {
            case "killAll":
                for (const e of this.enemies) if (e.alive && e.kind !== "forklet") this._killEnemy(e);
                for (const e of this.enemies) if (e.alive) this._killEnemy(e);
                return true;
            case "killAt": {
                const e = this.enemies.find((x) => x.alive && Math.round(x.x) === arg[0] && Math.round(x.y) === arg[1]);
                if (e) this._killEnemy(e);
                return Boolean(e);
            }
            case "hit":
                this._playerHit(arg || "bolt");
                return true;
            case "bolt":
                this.bolts.push({ x: this.player.x + 3, y: this.player.y - 2, vy: 40 });
                return true;
            case "drop":
                this.drops.push({ x: this.player.x + 1, y: this.player.y - 6, kind: arg || "sudo" });
                return true;
            case "formationY":
                this.formation.y = arg;
                this._placeFormation();
                return true;
            default:
                return false;
        }
    }

    /** The composed frame (post shake/scanlines) — what present() encodes. */
    pixels() {
        return this.frameBuf;
    }
}

function createGemSession(options) {
    const game = new DaemonStorm(options);
    return {
        start: () => game.start(),
        stop: () => game.stop(),
        tick: () => game.tick(),
        feed: (ev) => game.feed(ev),
        paint: () => game.paint(),
        resize: (c, r) => game.resize(c, r),
        snapshot: () => game.snapshot(),
        enemyList: () => game.enemyList(),
        boltList: () => game.boltList(),
        cheat: (name, arg) => game.cheat(name, arg),
        pixels: () => game.pixels(),
        quit: (reason) => game.quit(reason),
        get state() { return game.state; },
        get closed() { return game._closed; },
    };
}

module.exports = {
    createGemSession,
    createKonamiWatcher,
    tokenFromEvent,
    isSecretLine,
    grantGemReward,
    gemRewardXp,
    KONAMI,
    SECRET_WORDS,
    GEM_ITEM,
    WAVE_XP,
    WIN_XP,
    WAVES,
    SPRITES,
    TICK_MS,
    MIN_COLS,
    MIN_ROWS,
};
