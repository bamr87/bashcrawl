"use strict";
// The multiplayer hub (termforge/node/hub.js): presence, room and global
// chat, the leaderboard, event announcements, sanitizing and rate limits —
// on bare framework shells, then end-to-end through the telnet host with two
// real loopback clients.

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");

const { Hub, clean } = require("../node/hub.js");
const { Shell } = require("../core/shell.js");
const posix = require("../core/packs/posix.js");
const { createTelnetServer, DEFAULTS } = require("../node/host-telnet.js");
const bashcrawl = require("../apps/bashcrawl.js");

const WORLD = {
    root: "/town",
    directories: { "/town": [{ name: "inn", type: "dir", hidden: false }], "/town/inn": [] },
    files: {},
};

function player(hub, name) {
    const shell = new Shell({ world: WORLD, packs: [posix] });
    shell.state.xp = 0;
    const inbox = [];
    const member = hub.join({ shell, name, deliver: (lines) => inbox.push(...lines.map((l) => l.text)) });
    const run = (line) => shell.execute(line).map((o) => o.text || "").join("\n");
    return { shell, member, inbox, run };
}

test("clean() strips control characters, escape sequences and bidi tricks", () => {
    assert.equal(clean("hi\x1b[2J\x1b]0;pwned\x07 there\r\n\u202eevil", 80), "hi [2J ]0;pwned there evil");
    assert.equal(clean("a".repeat(500), 10), "aaaaaaaaaa");
    assert.equal(clean(null, 5), "");
});

test("who, say (room), emote, shout (global) and top", () => {
    const clock = { t: 0, now() { return this.t; } };
    const hub = new Hub({ clock });
    const alice = player(hub, "alice");
    const bob = player(hub, "bob");
    const cara = player(hub, "cara");
    assert.deepStrictEqual(alice.inbox, ["✦ bob joined.", "✦ cara joined."]);
    alice.inbox.length = 0;
    bob.inbox.length = 0;
    cara.inbox.length = 0;

    cara.run("cd inn");
    assert.deepStrictEqual(alice.inbox, ["← cara leaves."]);
    assert.match(alice.run("who"), /👥 Online — 3[\s\S]*alice +\/town +0 XP +\(you\)[\s\S]*cara +\/town\/inn/);

    assert.equal(alice.run("say hello there"), "💬 You say: hello there");
    assert.deepStrictEqual(bob.inbox.slice(-1), ["💬 alice says: hello there"]);
    assert.ok(!cara.inbox.some((t) => t.includes("hello there")), "say stays in the room");
    assert.match(cara.run("say anyone?"), /No one else is here/);
    alice.run("emote waves");
    assert.deepStrictEqual(bob.inbox.slice(-1), ["✳ alice waves"]);

    cara.run("shout dinner is ready");
    assert.deepStrictEqual(alice.inbox.slice(-1), ["📣 cara shouts: dinner is ready"]);
    assert.deepStrictEqual(bob.inbox.slice(-1), ["📣 cara shouts: dinner is ready"]);

    bob.shell.state.xp = 50;
    cara.shell.state.xp = 20;
    assert.match(alice.run("top"), /1\. bob +50 XP[\s\S]*2\. cara +20 XP[\s\S]*3\. alice +0 XP/);
    assert.match(alice.run("say"), /Usage: say MESSAGE/);
});

test("a chatty member is rate-limited, then recovers", () => {
    const clock = { t: 0, now() { return this.t; } };
    const hub = new Hub({ clock, burst: 2, refillMs: 1000 });
    const a = player(hub, "alice");
    player(hub, "bob");
    assert.match(a.run("shout one"), /You shout/);
    assert.match(a.run("shout two"), /You shout/);
    assert.match(a.run("shout three"), /Slow down/);
    clock.t += 1000;
    assert.match(a.run("shout four"), /You shout/);
});

test("names are validated, unique, and default to guests; renames are announced", () => {
    const hub = new Hub();
    const a = player(hub, "alice");
    const b = player(hub, "Alice");
    assert.equal(b.member.name, "Alice2", "case-insensitive collision gets a suffix");
    const g = player(hub, "\x1b[31mbad name");
    assert.match(g.member.name, /^guest\d+$/);
    assert.match(b.run("name alice"), /taken/);
    assert.match(b.run("name x"), /Names are 2-16/);
    assert.match(b.run("name bard"), /You are bard\./);
    assert.ok(a.inbox.includes("✎ Alice2 is now known as bard."));
    assert.equal(b.run("name"), "You are bard.");
});

test("typed events are announced; leaving cleans up and a rebind moves the plugin", () => {
    const hub = new Hub();
    const a = player(hub, "alice");
    const b = player(hub, "bob");
    b.shell.emit("achievement.unlocked", { id: "x", title: "Polymath", icon: "🧠" });
    b.shell.emit("course.completed", { course: "c", title: "Finding Your Way" });
    b.shell.emit("progress.rank", { index: 1, title: "Apprentice" });
    assert.deepStrictEqual(a.inbox.slice(-3), ["✦ bob earned 🧠 Polymath", "🏆 bob completed the course Finding Your Way!", "★ bob is now Apprentice"]);
    // A host that replaces b's runtime rebinds the member to the new shell.
    const fresh = new Shell({ world: WORLD, packs: [posix] });
    b.member.bind(fresh);
    assert.equal(b.shell.handlers.who, undefined, "the old shell lost the hub commands");
    assert.match(fresh.execute("who")[0].text, /Online — 2/);
    hub.leave(b.member);
    assert.equal(a.inbox.slice(-1)[0], "✦ bob left.");
    assert.equal(hub.list().length, 1);
    assert.equal(fresh.handlers.who, undefined);
});

// ── end to end: two raw clients on one --hub server ──────────────────────

function listen(opts) {
    const app = bashcrawl.createApp();
    const server = createTelnetServer(app, { ...DEFAULTS, raw: true, hub: true, idleTimeout: 0, ...opts });
    return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function client(port) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, "127.0.0.1", () => {
            let text = "";
            socket.on("data", (buf) => { text += buf.toString("utf8"); });
            resolve({
                socket,
                text: () => text,
                send: (line) => socket.write(`${line}\n`),
                waitFor: (pattern, ms = 3000) => new Promise((res, rej) => {
                    const start = Date.now();
                    const tick = () => {
                        if (pattern.test(text)) return res(text);
                        if (Date.now() - start > ms) return rej(new Error(`timed out waiting for ${pattern}; got:\n${text}`));
                        setTimeout(tick, 15);
                    };
                    tick();
                }),
            });
        });
        socket.on("error", reject);
    });
}

test("telnet --hub: two players see each other, chat, and a hostile escape sequence is defused", async () => {
    const server = await listen();
    const { port } = server.address();
    try {
        const a = await client(port);
        await a.waitFor(/Hub mode — you are guest1/);
        const b = await client(port);
        await b.waitFor(/Hub mode — you are guest2/);
        await a.waitFor(/✦ guest2 joined\./);
        a.send("name alice");
        await a.waitFor(/You are alice\./);
        a.send("who");
        await a.waitFor(/Online — 2/);
        b.send("say hi\x1b[2J\x1b]0;owned\x07 friend");
        await a.waitFor(/guest2 says: hi \[2J \]0;owned friend/);
        assert.ok(!a.text().includes("\x1b[2J\x1b]0;owned"), "no raw escape from another client reaches the terminal");
        b.send("cd cellar");
        await a.waitFor(/← guest2 leaves\./);
        b.socket.end();
        await a.waitFor(/✦ guest2 left\./);
        assert.equal(server.termforgeHub.list().length, 1);
        a.socket.end();
    } finally {
        await new Promise((res) => server.close(res));
    }
});

test("telnet without --hub stays isolated: no hub commands", async () => {
    const server = await listen({ hub: false });
    const { port } = server.address();
    try {
        const a = await client(port);
        a.send("who");
        await a.waitFor(/Unknown command: who/);
        assert.equal(server.termforgeHub, null);
        a.socket.end();
    } finally {
        await new Promise((res) => server.close(res));
    }
});
