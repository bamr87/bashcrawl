"use strict";
// DAEMON STORM: unlock helpers, deterministic simulation, rules, reward.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createGemSession,
    createKonamiWatcher,
    tokenFromEvent,
    isSecretLine,
    grantGemReward,
    gemRewardXp,
    KONAMI,
    GEM_ITEM,
    WAVE_XP,
    WIN_XP,
    WAVES,
    MIN_COLS,
} = require("../node/gem.js");

const ESC = "\u001b";

function makeSession(overrides = {}) {
    const frames = [];
    const quits = [];
    const session = createGemSession({
        write: (chunk) => frames.push(chunk),
        cols: 100,
        rows: 30,
        seed: 42,
        animate: false,
        onQuit: (result) => quits.push(result),
        ...overrides,
    });
    return { session, frames, quits };
}

function ticks(session, n) {
    for (let i = 0; i < n; i += 1) session.tick();
}

function startPlaying(session) {
    session.start();
    session.feed({ type: "char", ch: " " });
    ticks(session, 40); // banner → play
    assert.equal(session.state, "play");
}

function strip(text) {
    return text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
}

test("secret lines are the Adventure words, nothing else", () => {
    assert.equal(isSecretLine("xyzzy"), true);
    assert.equal(isSecretLine("  PLUGH  "), true);
    assert.equal(isSecretLine("ls"), false);
    assert.equal(isSecretLine(""), false);
});

test("tokenFromEvent maps history arrows, CSI arrows, and chars", () => {
    assert.equal(tokenFromEvent({ type: "histPrev" }), "up");
    assert.equal(tokenFromEvent({ type: "histNext" }), "down");
    assert.equal(tokenFromEvent({ type: "arrow", dir: "left" }), "left");
    assert.equal(tokenFromEvent({ type: "char", ch: "B" }), "b");
    assert.equal(tokenFromEvent({ type: "submit" }), null);
});

test("Konami watcher fires once on the full sequence and recovers from mistakes", () => {
    let hits = 0;
    const watcher = createKonamiWatcher(() => { hits += 1; });
    for (const tok of KONAMI) watcher.feed(tok);
    assert.equal(hits, 1);
    assert.equal(watcher.index, 0);
    watcher.feed("up");
    watcher.feed("up");
    watcher.feed("up");
    for (const tok of KONAMI.slice(1)) watcher.feed(tok);
    assert.equal(hits, 2, "a repeated first token restarts the match");
});

test("session boots on the title screen with a framebuffer sized to the terminal", () => {
    assert.throws(() => createGemSession({}), /write/);
    const { session, frames } = makeSession();
    session.start();
    const snap = session.snapshot();
    assert.equal(snap.state, "title");
    assert.equal(snap.W, 100);
    assert.equal(snap.H, 56, "(rows - 2) * 2 pixel rows");
    const out = frames.join("");
    assert.ok(out.includes(`${ESC}[2J`), "start erases the HUD");
    assert.ok(strip(out).includes("DAEMON STORM"), "status bar names the game");
    assert.ok(out.includes("▀") || out.includes("▄") || out.includes("█"), "half-block pixels are painted");
    assert.ok(out.includes("38;2;"), "truecolor");
    assert.ok(strip(out).includes("space starts"));
});

test("a small terminal shows the size hint instead of a game", () => {
    const { session, frames } = makeSession({ cols: MIN_COLS - 1, rows: 30 });
    session.start();
    assert.equal(session.state, "tooSmall");
    session.feed({ type: "char", ch: " " });
    assert.equal(session.state, "tooSmall", "cannot start while too small");
    assert.ok(strip(frames.join("")).includes("needs"));
    session.resize(120, 30);
    assert.equal(session.state, "title", "growing the terminal unlocks the title");
});

test("the run is deterministic for a seed", () => {
    const a = makeSession();
    const b = makeSession();
    for (const s of [a.session, b.session]) {
        startPlaying(s);
        for (let i = 0; i < 120; i += 1) {
            if (i % 5 === 0) s.feed({ type: "char", ch: " " });
            s.feed({ type: "arrow", dir: i % 20 < 10 ? "right" : "left" });
            s.tick();
        }
    }
    assert.deepEqual(a.session.snapshot(), b.session.snapshot());
    assert.equal(a.frames.join("").length, b.frames.join("").length);
});

test("space starts wave 1: formation, shields, banner then play", () => {
    const { session, frames } = makeSession();
    session.start();
    session.feed({ type: "char", ch: " " });
    assert.equal(session.state, "banner");
    const snap = session.snapshot();
    assert.equal(snap.wave, 0);
    assert.equal(snap.waveName, "SIGHUP");
    assert.equal(snap.enemies, WAVES[0].rows.length * 8, "8 columns at 100 cols");
    assert.ok(snap.shieldPixels > 100, "four shields at 100 cols");
    assert.equal(snap.lives, 3);
    ticks(session, 40);
    assert.equal(session.state, "play");
    assert.ok(strip(frames.join("")).includes("wave 1/3"));
});

test("movement clamps to the field; firing is rate- and count-limited", () => {
    const { session } = makeSession();
    startPlaying(session);
    for (let i = 0; i < 400; i += 1) session.feed({ type: "arrow", dir: "left" });
    assert.equal(session.snapshot().player.x, 0);
    for (let i = 0; i < 400; i += 1) session.feed({ type: "char", ch: "d" });
    assert.equal(session.snapshot().player.x, 100 - 7);
    session.feed({ type: "char", ch: " " });
    session.feed({ type: "char", ch: " " });
    assert.equal(session.snapshot().bullets, 1, "cooldown blocks the second shot in the same tick");
    ticks(session, 4);
    session.feed({ type: "histPrev" });
    ticks(session, 4);
    session.feed({ type: "char", ch: "k" });
    assert.equal(session.snapshot().bullets, 2, "two signals in flight at most");
    assert.equal(session.snapshot().shots, 2);
});

test("a bullet under an enemy kills it, scores it, and throws particles", () => {
    const { session } = makeSession();
    startPlaying(session);
    const before = session.snapshot();
    const target = session.enemyList().reduce((a, e) => (e.y > a.y ? e : a));
    const x = target.x + Math.floor(target.w / 2) - 3;
    // Walk under it with taps (each tap is at least one pixel).
    for (let i = 0; i < 200 && Math.abs(session.snapshot().player.x - x) > 0; i += 1) {
        session.feed({ type: "arrow", dir: session.snapshot().player.x < x ? "right" : "left" });
    }
    session.feed({ type: "char", ch: " " });
    let killed = false;
    for (let i = 0; i < 40 && !killed; i += 1) {
        session.tick();
        killed = session.snapshot().kills > 0;
        if (i % 4 === 3) session.feed({ type: "char", ch: " " });
    }
    assert.equal(killed, true, "the shot connected");
    const after = session.snapshot();
    assert.ok(after.score >= 20);
    assert.equal(after.enemies, before.enemies - after.kills);
    assert.ok(after.particles > 0, "explosion particles");
});

test("killing a fork spawns two free forklets that stay on the field", () => {
    const { session } = makeSession();
    startPlaying(session);
    session.cheat("killAll");
    ticks(session, 40); // clear banner → wave 2 banner
    ticks(session, 40); // → play
    assert.equal(session.snapshot().wave, 1);
    const fork = session.enemyList().find((e) => e.kind === "fork");
    assert.ok(fork, "SIGINT has a fork row");
    const enemiesBefore = session.snapshot().enemies;
    assert.equal(session.cheat("killAt", [fork.x, fork.y]), true);
    const snap = session.snapshot();
    assert.equal(snap.enemies, enemiesBefore + 1, "one dies, two are born");
    assert.equal(snap.free, 2);
    ticks(session, 60);
    for (const e of session.enemyList().filter((e) => e.free)) {
        assert.ok(e.x >= 0 && e.x + e.w <= 100, "forklets bounce inside the field");
    }
});

test("bolts hit the player: shells drop, segfault, respawn with invulnerability, then kernel panic", () => {
    const { session, quits, frames } = makeSession();
    startPlaying(session);
    session.cheat("bolt");
    let hit = false;
    for (let i = 0; i < 10 && !hit; i += 1) {
        session.tick();
        hit = session.snapshot().lives < 3;
    }
    assert.equal(hit, true, "a bolt above the ship connects");
    assert.equal(session.state, "respawn");
    assert.ok(strip(frames.join("")).includes("shells $$"), "status bar counts shells");
    ticks(session, 30);
    assert.equal(session.state, "play");
    assert.equal(session.snapshot().player.invuln, true);
    session.cheat("bolt");
    ticks(session, 10);
    assert.equal(session.snapshot().lives, 2, "invulnerable right after respawn");
    ticks(session, 30);
    session.cheat("hit");
    ticks(session, 30);
    session.cheat("hit");
    assert.equal(session.state, "gameover");
    ticks(session, 70);
    assert.equal(session.closed, true);
    assert.equal(quits.length, 1);
    assert.equal(quits[0].won, false);
    assert.equal(quits[0].reason, "lost");
    assert.equal(quits[0].waves, 0);
});

test("the formation descends when it reaches the wall and overrunning the prompt costs a shell", () => {
    const { session } = makeSession();
    startPlaying(session);
    const y0 = session.snapshot().formation.y;
    const dir0 = session.snapshot().formation.dir;
    let flipped = false;
    for (let i = 0; i < 400 && !flipped; i += 1) {
        session.tick();
        flipped = session.snapshot().formation.dir !== dir0;
    }
    assert.equal(flipped, true, "the storm reaches a wall and turns");
    assert.ok(session.snapshot().formation.y > y0, "and steps down when it does");

    const fresh = makeSession();
    startPlaying(fresh.session);
    fresh.session.cheat("formationY", 40);
    ticks(fresh.session, 2);
    assert.equal(fresh.session.snapshot().lives, 2, "overrun costs a shell");
    assert.ok(fresh.session.snapshot().formation.y < 40, "the storm is pushed back up");
});

test("power-ups: sudo fires a triple spread, nice halves the formation speed", () => {
    const { session } = makeSession();
    startPlaying(session);
    session.cheat("drop", "sudo");
    ticks(session, 30);
    assert.equal(session.snapshot().power.sudo, true, "the drop fell onto the ship");
    session.feed({ type: "char", ch: " " });
    assert.equal(session.snapshot().bullets, 3);
    // Distance travelled (not displacement: the storm bounces off the walls).
    const travelled = (s, n) => {
        let sum = 0;
        let last = s.snapshot().formation.x;
        for (let i = 0; i < n; i += 1) {
            s.tick();
            const x = s.snapshot().formation.x;
            sum += Math.abs(x - last);
            last = x;
        }
        return sum;
    };
    const nice = makeSession();
    startPlaying(nice.session);
    const plain = travelled(nice.session, 40);
    nice.session.cheat("drop", "nice");
    ticks(nice.session, 30);
    assert.equal(nice.session.snapshot().power.nice, true);
    const slowed = travelled(nice.session, 40);
    assert.ok(slowed < plain * 0.75, `nice slows the storm (${slowed} < ${plain})`);
});

test("clearing every wave restores the system; the result carries waves and score", () => {
    const { session, quits, frames } = makeSession();
    startPlaying(session);
    for (let w = 0; w < WAVES.length; w += 1) {
        session.cheat("killAll");
        session.tick();
        assert.equal(session.state, "clear");
        assert.equal(session.snapshot().wavesCleared, w + 1);
        ticks(session, 40);
        if (w < WAVES.length - 1) {
            assert.equal(session.state, "banner");
            assert.equal(session.snapshot().waveName, WAVES[w + 1].name);
            ticks(session, 40);
        }
    }
    assert.equal(session.state, "victory");
    ticks(session, 70);
    assert.equal(quits.length, 1);
    assert.equal(quits[0].won, true);
    assert.equal(quits[0].waves, 3);
    assert.ok(quits[0].score > 0);
    assert.ok(frames.join("").includes("38;2;"));
});

test("q and ^C leave without a prize; c toggles scanlines", () => {
    const a = makeSession();
    a.session.start();
    a.session.feed({ type: "char", ch: "c" });
    assert.equal(a.session.snapshot().crt, false);
    a.session.feed({ type: "char", ch: "q" });
    assert.equal(a.session.closed, true);
    assert.equal(a.quits[0].won, false);
    assert.equal(a.quits[0].reason, "quit");
    const b = makeSession();
    b.session.start();
    b.session.feed({ type: "interrupt" });
    assert.equal(b.quits[0].reason, "interrupt");
});

test("resize rebuilds the framebuffer and repaints", () => {
    const { session, frames } = makeSession();
    startPlaying(session);
    frames.length = 0;
    session.resize(120, 40);
    const snap = session.snapshot();
    assert.equal(snap.W, 120);
    assert.equal(snap.H, 76);
    assert.ok(frames[0].includes(`${ESC}[2J`));
    assert.ok(snap.player.x <= 120 - 7);
});

test("reward pays per new wave, once, and the kill_switch on the first win", () => {
    assert.equal(gemRewardXp({ waves: 2 }, 0), 2 * WAVE_XP);
    assert.equal(gemRewardXp({ waves: 2 }, 2), 0);
    assert.equal(gemRewardXp({ waves: 9 }, 0), WAVES.length * WAVE_XP, "capped at the wave count");
    assert.equal(gemRewardXp(undefined, 0), 0);

    const runtime = { state: { xp: 10, inventory: [], flags: {} } };
    const loss = grantGemReward(runtime, { won: false, waves: 1 });
    assert.equal(loss.granted, true);
    assert.equal(loss.xp, WAVE_XP);
    assert.equal(loss.item, null);
    assert.equal(runtime.state.xp, 10 + WAVE_XP);
    const same = grantGemReward(runtime, { won: false, waves: 1 });
    assert.equal(same.granted, false, "no pay for repeating a wave");
    const win = grantGemReward(runtime, { won: true, waves: 3 });
    assert.equal(win.granted, true);
    assert.equal(win.xp, 2 * WAVE_XP + WIN_XP);
    assert.equal(win.item, GEM_ITEM);
    assert.equal(win.firstWin, true);
    assert.ok(runtime.state.inventory.includes(GEM_ITEM));
    assert.equal(runtime.state.flags.daemon_storm, true);
    const again = grantGemReward(runtime, { won: true, waves: 3 });
    assert.equal(again.granted, false);
    assert.equal(runtime.state.inventory.filter((i) => i === GEM_ITEM).length, 1);
    assert.equal(runtime.state.xp, 10 + 3 * WAVE_XP + WIN_XP);
    assert.deepEqual(grantGemReward(null, {}), { granted: false });
});
