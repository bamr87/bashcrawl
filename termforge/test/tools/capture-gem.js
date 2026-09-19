"use strict";
// Replay DAEMON STORM headless and rasterize its framebuffer to PNG.
//
//   node termforge/test/tools/capture-gem.js [--tty-raw FILE --tty-size 100x30]
//
// Writes docs/termforge/gem/ (png + capture.json). The shots come straight
// from session.pixels() — the exact frame the terminal would show, upscaled,
// with the status and help rows drawn in the same 3×5 pixel font. --tty-raw
// decodes the last frame out of a raw byte dump from a real PTY session
// (test/integration/test_tty_host.py records one). Not part of CI.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PixelBuffer } = require("../../node/pixels.js");
const {
    createGemSession,
    createKonamiWatcher,
    isSecretLine,
    grantGemReward,
    tokenFromEvent,
    KONAMI,
    GEM_ITEM,
    WAVE_XP,
    WIN_XP,
} = require("../../node/gem.js");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const OUT = path.join(ROOT, "docs", "termforge", "gem");
const COLS = 100;
const ROWS = 30;
const SCALE = 6;
const BAR = [14, 16, 24];
const ESC = "\u001b";

function stripSgr(text) {
    return text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
}

/** Frame + status/help rows → RGB image (field ×SCALE, bar text ×2). */
function raster(pixels, status, help) {
    const bar = 16;
    const width = pixels.w * SCALE;
    const height = pixels.h * SCALE + bar * 2;
    const img = new PixelBuffer(width, height);
    img.rect(0, 0, width, bar, BAR);
    img.rect(0, height - bar, width, bar, BAR);
    const plain = (t) => t.replace(/│/g, "|").replace(/←/g, "<").replace(/→/g, ">").replace(/↑/g, "^");
    img.text(4, 3, plain(status), [200, 230, 255], 2);
    img.text(4, height - bar + 3, plain(help), [120, 140, 170], 2);
    for (let y = 0; y < pixels.h; y += 1) {
        for (let x = 0; x < pixels.w; x += 1) {
            const i = (y * pixels.w + x) * 3;
            if (pixels.data[i] === 0 && pixels.data[i + 1] === 0 && pixels.data[i + 2] === 0) continue;
            img.rect(x * SCALE, bar + y * SCALE, SCALE, SCALE, [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]]);
        }
    }
    return { buf: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), width, height };
}

function writePng(name, img) {
    const ppm = path.join(OUT, `${name}.ppm`);
    const png = path.join(OUT, `${name}.png`);
    fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${img.width} ${img.height}\n255\n`), img.buf]));
    const r = spawnSync("sips", ["-s", "format", "png", ppm, "--out", png], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`sips failed: ${r.stderr || r.stdout}`);
    fs.unlinkSync(ppm);
    return png;
}

/**
 * Decode half-block ANSI rows (what PixelScreen writes) back into pixels.
 * Only the rows addressed with CSI n;1H are considered; row 1 and the last
 * row are the text bars.
 */
function decodeTtyFrame(raw, cols, rows) {
    let text = raw.toString("utf8");
    // Stop at the HUD's return (it erases the screen after the last overlay
    // status write) so the decoded frame is the storm's final paint.
    const lastTitle = text.lastIndexOf("DAEMON STORM");
    const cut = text.lastIndexOf(`${ESC}[2J`);
    if (lastTitle >= 0 && cut > lastTitle) text = text.slice(0, cut);
    const pixels = new PixelBuffer(cols, (rows - 2) * 2);
    let status = "";
    let help = "";
    const re = /\u001b\[(\d+);1H/g;
    const marks = [];
    let m;
    while ((m = re.exec(text))) marks.push({ row: Number(m[1]), start: m.index + m[0].length, index: m.index });
    // Keep the last occurrence of every row (the final frame), in row order.
    const last = new Map();
    for (let i = 0; i < marks.length; i += 1) {
        const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
        last.set(marks[i].row, text.slice(marks[i].start, end));
    }
    for (const [row, slice] of last) {
        if (row === 1) { status = stripSgr(slice).replace(/\u001b\[2K/g, "").trim(); continue; }
        if (row === rows) { help = stripSgr(slice).replace(/\u001b\[2K/g, "").trim(); continue; }
        if (row < 2 || row >= rows) continue;
        const cy = row - 2;
        let fg = null;
        let bg = null;
        let x = 0;
        for (let i = 0; i < slice.length && x < cols;) {
            if (slice[i] === ESC && slice[i + 1] === "[") {
                const end = slice.indexOf("m", i);
                if (end < 0) break;
                const body = slice.slice(i + 2, end).split(";").map(Number);
                if (body[0] === 0 || Number.isNaN(body[0])) { fg = null; bg = null; }
                else if (body[0] === 39) fg = null;
                else if (body[0] === 38 && body[1] === 2) fg = [body[2], body[3], body[4]];
                else if (body[0] === 48 && body[1] === 2) bg = [body[2], body[3], body[4]];
                i = end + 1;
                continue;
            }
            const ch = slice[i];
            const cp = slice.codePointAt(i);
            i += cp > 0xffff ? 2 : 1;
            if (ch === "\r" || ch === "\n") break;
            let top = null;
            let bot = null;
            if (ch === "▀") { top = fg; bot = bg; }
            else if (ch === "▄") { top = bg; bot = fg; }
            else if (ch === "█") { top = fg; bot = fg; }
            if (top) pixels.set(x, cy * 2, top);
            if (bot) pixels.set(x, cy * 2 + 1, bot);
            x += 1;
        }
    }
    return { pixels, status, help };
}

// ── scripted replay ────────────────────────────────────────────────────────

function makeSession(log) {
    let bytes = 0;
    let statusRow = "";
    let helpRow = "";
    const session = createGemSession({
        write: (chunk) => {
            bytes += chunk.length;
            const m1 = /\u001b\[1;1H\u001b\[2K([^\u001b]*(?:\u001b\[[0-9;]*m[^\u001b]*)*)/.exec(chunk);
            if (m1) statusRow = stripSgr(m1[1]).trim();
            const m2 = new RegExp(`\\u001b\\[${ROWS};1H\\u001b\\[2K([^\\u001b]*(?:\\u001b\\[[0-9;]*m[^\\u001b]*)*)`).exec(chunk);
            if (m2) helpRow = stripSgr(m2[1]).trim();
        },
        cols: COLS,
        rows: ROWS,
        seed: 42,
        animate: false,
        onQuit: (result) => { log.quit = result; },
    });
    return { session, text: () => ({ status: statusRow, help: helpRow }), bytes: () => bytes };
}

function shoot(session) {
    session.feed({ type: "char", ch: " " });
}

function move(session, dir, n) {
    for (let i = 0; i < n; i += 1) session.feed({ type: "arrow", dir });
}

function ticks(session, n) {
    for (let i = 0; i < n; i += 1) session.tick();
}

/**
 * Steer under the lowest enemy and fire, sidestepping any bolt about to land
 * on the ship, until the wave is done or `maxTicks` pass.
 */
function autoplay(session, maxTicks) {
    let t = 0;
    while (t < maxTicks && session.state === "play") {
        const snap = session.snapshot();
        const px = snap.player.x;
        const threat = session.boltList().find((b) => b.y > snap.player.y - 14 && b.x >= px - 1 && b.x <= px + 7);
        if (threat) {
            move(session, threat.x >= px + 3 ? "left" : "right", 2);
        } else {
            const enemies = session.enemyList();
            if (enemies.length) {
                const lowest = enemies.reduce((a, e) => (e.y > a.y ? e : a), enemies[0]);
                const targetX = lowest.x + Math.floor(lowest.w / 2) - 3;
                if (Math.abs(targetX - px) > 1) move(session, targetX > px ? "right" : "left", 1);
                if (t % 4 === 0) shoot(session);
            }
        }
        session.tick();
        t += 1;
    }
    return t;
}

function untilState(session, state, maxTicks) {
    for (let i = 0; i < maxTicks && session.state !== state; i += 1) session.tick();
    return session.state === state;
}

function main() {
    const argv = process.argv.slice(2);
    fs.mkdirSync(OUT, { recursive: true });
    const log = { seed: 42, cols: COLS, rows: ROWS, shots: [], checks: {} };
    const { session, text, bytes } = makeSession(log);

    const shot = (name, caption) => {
        const t = text();
        const img = raster(session.pixels(), t.status, t.help);
        const png = writePng(name, img);
        const st = fs.statSync(png);
        log.shots.push({ name, file: `${name}.png`, bytes: st.size, caption, snapshot: session.snapshot(), status: t.status });
    };

    session.start();
    ticks(session, 6);
    shot("01-title", "Title screen: pixel-font logo, a demo formation bobbing, blinking PRESS SPACE.");

    shoot(session); // start
    ticks(session, 8);
    shot("02-wave-banner", "WAVE 1 banner with the signal name; the formation and shields are already in place.");

    untilState(session, "play", 60);
    autoplay(session, 60);
    shot("03-first-contact", "Early SIGHUP: bullets with trails, an explosion, bolts falling on the shields.");

    autoplay(session, 260);
    log.midWave = session.snapshot();
    shot("04-mid-wave", "Mid-wave: eroded shields, a thinned formation moving faster.");

    // Force a hit to show the segfault state.
    session.cheat("hit", "bolt");
    ticks(session, 3);
    shot("05-segfault", "Player hit: white flash fading, shake, SEGMENTATION FAULT blinking, one shell lost.");

    untilState(session, "play", 60); // respawn
    session.cheat("drop", "sudo");
    ticks(session, 14); // fall onto the player
    autoplay(session, 6);
    log.sudo = session.snapshot();
    shot("06-sudo", "sudo picked up: the prompt turns gold and fires three signals at once.");

    session.cheat("killAll");
    ticks(session, 2);
    shot("07-wave-cleared", "Wave cleared: bonus pids counted, remaining bullets still flying.");

    untilState(session, "banner", 60);
    untilState(session, "play", 60);
    // Kill the first fork to show the split.
    const fork = session.enemyList().find((e) => e.kind === "fork");
    if (fork) session.cheat("killAt", [fork.x, fork.y]);
    ticks(session, 6);
    log.forkSplit = session.snapshot();
    shot("08-fork-bomb", "A fork killed in SIGINT: two forklets break formation and hunt on their own.");

    session.cheat("killAll");
    session.tick();                      // → clear
    untilState(session, "play", 120);   // → banner → wave 3 play
    log.wave3 = session.snapshot();
    session.cheat("killAll");
    session.tick();                      // → clear
    untilState(session, "victory", 120);
    ticks(session, 6);
    shot("09-victory", "All three waves cleared: SYSTEM RESTORED with fireworks.");
    ticks(session, 70);
    log.afterVictory = session.snapshot();

    // A losing run for KERNEL PANIC.
    const lossLog = {};
    const loss = makeSession(lossLog);
    loss.session.start();
    shoot(loss.session);
    ticks(loss.session, 40);
    for (let i = 0; i < 3; i += 1) {
        loss.session.cheat("hit", "bolt");
        ticks(loss.session, 40);
    }
    ticks(loss.session, 4);
    {
        const t = loss.text();
        const img = raster(loss.session.pixels(), t.status, t.help);
        const png = writePng("10-kernel-panic", img);
        log.shots.push({ name: "10-kernel-panic", file: "10-kernel-panic.png", bytes: fs.statSync(png).size, caption: "Three shells gone: KERNEL PANIC, then the HUD returns with only the waves you cleared paid out.", snapshot: loss.session.snapshot(), status: t.status });
    }
    ticks(loss.session, 70);
    log.lossQuit = lossLog.quit;

    const rawIdx = argv.indexOf("--tty-raw");
    if (rawIdx >= 0 && argv[rawIdx + 1]) {
        const sizeIdx = argv.indexOf("--tty-size");
        const m = sizeIdx >= 0 ? /^(\d+)x(\d+)$/.exec(argv[sizeIdx + 1] || "") : null;
        const size = m ? { cols: Number(m[1]), rows: Number(m[2]) } : { cols: COLS, rows: ROWS };
        const raw = fs.readFileSync(argv[rawIdx + 1]);
        const frame = decodeTtyFrame(raw, size.cols, size.rows);
        const png = writePng("11-tty-live", raster(frame.pixels, frame.status, frame.help));
        log.shots.push({ name: "11-tty-live", file: "11-tty-live.png", bytes: fs.statSync(png).size, caption: `Last frame decoded from a real ${size.cols}x${size.rows} PTY byte stream.`, status: frame.status });
        log.ttyRaw = { file: path.basename(argv[rawIdx + 1]), bytes: raw.length, ...size, status: frame.status };
    }

    const runtime = { state: { xp: 12, inventory: ["amulet"], flags: {} } };
    log.reward = grantGemReward(runtime, log.quit);
    log.rewardAgain = grantGemReward(runtime, log.quit);
    log.rewardState = runtime.state;
    log.bytes = bytes();

    let konamiHits = 0;
    const watcher = createKonamiWatcher(() => { konamiHits += 1; });
    for (const tok of KONAMI) watcher.feed(tok);
    log.checks = {
        xyzzy: isSecretLine("xyzzy"),
        plugh: isSecretLine("PLUGH"),
        ls: isSecretLine("ls"),
        konamiHits,
        tokens: { up: tokenFromEvent({ type: "histPrev" }), left: tokenFromEvent({ type: "arrow", dir: "left" }) },
        gemItem: GEM_ITEM,
        waveXp: WAVE_XP,
        winXp: WIN_XP,
        pngCount: log.shots.length,
    };

    fs.writeFileSync(path.join(OUT, "capture.json"), `${JSON.stringify(log, null, 2)}\n`);
    process.stdout.write(`captured ${log.shots.length} screenshots -> ${OUT}\n`);
    process.stdout.write(`${JSON.stringify({ midWave: log.midWave, quit: log.quit, lossQuit: log.lossQuit, reward: log.reward, rewardAgain: log.rewardAgain, checks: log.checks }, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { raster, decodeTtyFrame, OUT, COLS, ROWS };
