"use strict";
// App-descriptor tests: procwatch (the custom-tool story, via core only) and
// the bashcrawl app (the real game runtime loaded under node).

const test = require("node:test");
const assert = require("node:assert");
const procwatch = require("../apps/procwatch/index.js");
const bashcrawl = require("../apps/bashcrawl.js");

function textOf(outputs) {
    return outputs.map((o) => o.text ?? "").join("\n");
}

test("procwatch: provider-backed files, dashboard command, live pipes", () => {
    const app = procwatch.createApp({ source: procwatch.MOCK_SOURCE });
    const session = app.createSession({ width: 80 });
    const rt = session.runtime;

    assert.strictEqual(textOf(rt.execute("pwd")), "/procwatch");
    assert.strictEqual(textOf(rt.execute("ls -F")), "readme  sys/");
    assert.strictEqual(textOf(rt.execute("ls sys")), "hostname  loadavg  memory  platform  uptime");
    assert.strictEqual(textOf(rt.execute("cat sys/loadavg")), "0.42 0.40 0.35");
    assert.strictEqual(textOf(rt.execute("cat sys/hostname")), "demo-host");
    assert.match(textOf(rt.execute("sys")), /host: {6}demo-host/);
    assert.match(textOf(rt.execute("sys")), /memory: {4}used 5\.00 GiB \/ 8\.00 GiB \(63%\)/);
    // The posix toolkit works over live provider data.
    assert.strictEqual(textOf(rt.execute("cat sys/uptime | rev")), ")s2424( m01 h1 d0");
    assert.match(textOf(rt.execute("grep -r GiB .")), /sys\/memory:used 5\.00 GiB/);
    // Providers are read-only.
    const denied = rt.execute("echo x > sys/uptime");
    assert.strictEqual(denied[0].kind, "error");
    assert.match(denied[0].text, /read-only/);
    // Completions include the custom pack.
    assert.ok(rt.completions("sy").includes("sys"));
});

test("procwatch: metric files recompute on every read", () => {
    let calls = 0;
    const source = { ...procwatch.MOCK_SOURCE, loadavg: () => { calls += 1; return [calls, 0, 0]; } };
    const rt = procwatch.createApp({ source }).createSession({}).runtime;
    assert.match(textOf(rt.execute("cat sys/loadavg")), /^1\.00/);
    assert.match(textOf(rt.execute("cat sys/loadavg")), /^2\.00/);
});

test("bashcrawl app: the real game runtime plays under node", () => {
    const app = bashcrawl.createApp();
    const session = app.createSession({ width: 80 });
    const rt = session.runtime;

    assert.ok(session.banner.length >= 2);
    assert.strictEqual(textOf(rt.execute("pwd")).split("\n")[0], "/entrance");
    assert.match(textOf(rt.execute("cd cellar")), /Moved to \/entrance\/cellar/);
    const loot = textOf(rt.execute("./treasure"));
    assert.match(loot, /amulet/);
    assert.ok(rt.state.inventory.includes("amulet"));
    assert.match(textOf(rt.execute("echo $I")), /amulet/);
    // The 74-command manifest is live (validator parity from the JS side).
    assert.ok(Object.keys(rt.handlers).length >= 74);

    // Control routing: reset replaces the session runtime.
    const before = session.runtime;
    session.onControl("reset");
    assert.notStrictEqual(session.runtime, before);
    assert.strictEqual(session.runtime.state.xp, 0);
});
