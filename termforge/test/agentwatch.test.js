"use strict";
// agentwatch app tests: the deterministic demo fleet, the live provider
// files, and the JSONL adapter over a synthetic playtest-recorder log.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp, demoSource, jsonlSource } = require("../apps/agentwatch/index.js");

function textOf(outputs) {
    return outputs.map((o) => o.text ?? "").join("\n");
}

test("demo fleet: board, statuses, deterministic tick-per-read", () => {
    const rt = createApp().createSession({}).runtime;
    const first = textOf(rt.execute("board"));
    assert.match(first, /AGENT BOARD/);
    for (const id of ["atlas", "forge", "sentry", "probe", "scribe"]) {
        assert.match(first, new RegExp(id));
    }
    assert.match(first, /blocked/, "the blocked agent shows");
    // Reads advance the simulation deterministically (the card shows the
    // exact percentage, so every read visibly differs).
    const cardA = textOf(rt.execute("cat agents/forge"));
    const cardB = textOf(rt.execute("cat agents/forge"));
    assert.notStrictEqual(cardA, cardB, "each read ticks the fleet");
    assert.match(textOf(rt.execute("board")), /failed/, "probe fails as the script advances");

    // Identical fresh sessions replay identically (no clock, no rng).
    const a = textOf(createApp().createSession({}).runtime.execute("board"));
    const b = textOf(createApp().createSession({}).runtime.execute("board"));
    assert.strictEqual(a, b);
});

test("demo fleet: agent detail, feed, and status-colored kinds", () => {
    const rt = createApp().createSession({}).runtime;
    const detail = rt.execute("agent scribe");
    assert.strictEqual(detail[0].kind, "magic", "blocked agents render in the blocked kind");
    assert.match(textOf(detail), /waiting on Forge/);
    assert.strictEqual(rt.execute("agent nobody")[0].kind, "error");
    const feed = rt.execute("feed 3");
    assert.strictEqual(feed.length, 3);
    assert.ok(feed.every((l) => /^\[/.test(l.text)));
});

test("demo fleet: the dashboard is a live filesystem", () => {
    const rt = createApp().createSession({}).runtime;
    assert.strictEqual(textOf(rt.execute("ls -F")), "agents/  feed  readme",
        "feed mounts as a file, agents as a directory");
    assert.strictEqual(textOf(rt.execute("ls agents")), "atlas  forge  probe  scribe  sentry");
    const card = textOf(rt.execute("cat agents/forge"));
    assert.match(card, /Forge \(implement\)/);
    assert.match(card, /progress: {2}[█░]/);
    assert.match(textOf(rt.execute("cat feed | tail -1")), /^\[/);
    assert.match(textOf(rt.execute("grep -r checkout .")), /probe/);
    const denied = rt.execute("echo x > agents/atlas");
    assert.strictEqual(denied[0].kind, "error");
    // Completions include the dashboard pack.
    assert.ok(rt.completions("boa").includes("board"));
});

test("jsonl adapter: playtest-recorder sessions become agents", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentwatch-"));
    const lines = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
    fs.writeFileSync(path.join(dir, "a1.jsonl"), lines([
        { ts: "T1", sid: "aaaa11112222", event: "session_start", mode: "blank_slate" },
        { ts: "T2", sid: "aaaa11112222", event: "command", command: "pwd", room: "entrance", outcome: "PROGRESS" },
        { ts: "T3", sid: "aaaa11112222", event: "quest_complete", quest_id: 0, quest_title: "Know Thy Place" },
        { ts: "T4", sid: "aaaa11112222", event: "command", command: "frobnicate", room: "entrance", outcome: "ERROR" },
    ]));
    fs.mkdirSync(path.join(dir, "nested"));
    fs.writeFileSync(path.join(dir, "nested", "b2.jsonl"), lines([
        { ts: "T1", sid: "bbbb33334444", event: "session_start", mode: "blank_slate" },
        { ts: "T2", sid: "bbbb33334444", event: "content_gap", room: "cellar", reason: "no_next_step" },
        { ts: "T3", sid: "bbbb33334444", event: "session_end", reason: "done", rooms_visited: 3, quests_completed: 1, final_cwd: "entrance/cellar" },
    ]));
    fs.writeFileSync(path.join(dir, "junk.jsonl"), "not json\n{\"sid\":\"x\"}\n");

    try {
        const source = jsonlSource(dir);
        const agents = source.agents();
        assert.strictEqual(agents.length, 2);
        const running = agents.find((a) => a.id === "aaaa11112222");
        assert.strictEqual(running.status, "in_progress");
        assert.match(running.detail, /2 commands · 1 quests/);
        const ended = agents.find((a) => a.id === "bbbb33334444");
        assert.strictEqual(ended.status, "blocked", "sessions ending with content gaps surface as blocked");
        assert.match(ended.task, /finished in entrance\/cellar/);

        const events = source.events(20);
        assert.ok(events.some((e) => e.kind === "success" && /Know Thy Place/.test(e.text)));
        assert.ok(events.some((e) => e.kind === "error" && /frobnicate/.test(e.text)));
        assert.ok(events.some((e) => e.kind === "error" && /content gap/.test(e.text)));

        // Through the full dashboard app.
        const rt = createApp({ dataDir: dir }).createSession({}).runtime;
        const board = textOf(rt.execute("board"));
        assert.match(board, /aaaa11112222/);
        assert.match(board, /2 agents/);
        assert.match(textOf(rt.execute("cat agents/bbbb33334444")), /1 content gaps/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("demo source object shape matches the TaskSource contract", () => {
    const source = demoSource();
    for (const agent of source.agents()) {
        assert.match(agent.status, /^(pending|in_progress|completed|failed|blocked)$/);
        assert.ok(typeof agent.id === "string" && agent.id);
        assert.ok("task" in agent && "progress" in agent && "updated" in agent);
    }
    for (const event of source.events(5)) {
        assert.ok(event.agent && event.kind && event.text);
    }
});
