"use strict";
// Telnet host tests: codec state machine units, then a real loopback
// integration — server on an ephemeral port, scripted client sockets, both
// negotiated and raw modes, session caps and idle timeout.

const test = require("node:test");
const assert = require("node:assert");
const net = require("node:net");
const codecMod = require("../node/telnet-codec.js");
const { createTelnetServer, DEFAULTS } = require("../node/host-telnet.js");
const procwatch = require("../apps/procwatch/index.js");

const { createTelnetCodec, IAC, DO, DONT, WILL, WONT, SB, SE, IP, OPT_ECHO, OPT_SGA, OPT_NAWS } = codecMod;

// ── codec units ──────────────────────────────────────────────────────────

function makeCodec() {
    const got = { data: "", naws: null, interrupts: 0 };
    const codec = createTelnetCodec({
        onData: (t) => { got.data += t; },
        onNaws: (w, h) => { got.naws = [w, h]; },
        onInterrupt: () => { got.interrupts += 1; },
    });
    return { codec, got };
}

test("codec: opening negotiation burst", () => {
    assert.deepStrictEqual([...codecMod.opening()], [
        IAC, WILL, OPT_ECHO, IAC, WILL, OPT_SGA, IAC, DO, OPT_SGA, IAC, DO, OPT_NAWS,
    ]);
});

test("codec: accepts our options silently, refuses everything else", () => {
    const { codec } = makeCodec();
    assert.strictEqual(codec.feed(Buffer.from([IAC, DO, OPT_ECHO, IAC, WILL, OPT_NAWS])), null);
    assert.deepStrictEqual([...codec.feed(Buffer.from([IAC, DO, 34]))], [IAC, WONT, 34]);
    assert.deepStrictEqual([...codec.feed(Buffer.from([IAC, WILL, 24]))], [IAC, DONT, 24]);
    assert.strictEqual(codec.feed(Buffer.from([IAC, DONT, 99, IAC, WONT, 99])), null,
        "refusals acknowledged silently");
});

test("codec: data path — IAC IAC literal, interrupt, split chunks", () => {
    const { codec, got } = makeCodec();
    codec.feed(Buffer.from([0x68, 0x69, IAC]));
    codec.feed(Buffer.from([IAC]));            // escaped 0xFF split across chunks
    codec.feed(Buffer.from([IAC, IP, 0x21]));
    assert.strictEqual(got.interrupts, 1);
    // The unescaped 0xFF is not valid standalone UTF-8, so it decodes to the
    // replacement character — what matters is it reached the data path.
    assert.strictEqual(got.data, "hi�!");
});

test("codec: NAWS subnegotiation and unknown-SB skip", () => {
    const { codec, got } = makeCodec();
    codec.feed(Buffer.from([IAC, SB, OPT_NAWS, 0, 120, 0, 40, IAC, SE]));
    assert.deepStrictEqual(got.naws, [120, 40]);
    codec.feed(Buffer.from([IAC, SB, 24, 1, 2, 3, IAC, SE, 0x78]));
    assert.strictEqual(got.data, "x", "unknown subnegotiation swallowed wholesale");
});

// ── loopback integration ─────────────────────────────────────────────────

function startServer(opts = {}) {
    const app = procwatch.createApp({ source: procwatch.MOCK_SOURCE });
    const server = createTelnetServer(app, { ...DEFAULTS, ...opts });
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
    });
}

function connect(port) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, "127.0.0.1", () => resolve(socket));
        socket.on("error", reject);
    });
}

function collect(socket) {
    const chunks = [];
    socket.on("data", (buf) => chunks.push(buf));
    return () => Buffer.concat(chunks);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(read, predicate, timeoutMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (predicate(read())) return;
        await wait(20);
    }
    throw new Error(`timed out waiting; got: ${JSON.stringify(read().toString("utf8").slice(-200))}`);
}

test("negotiated session: opening IAC burst, prompt, command round-trip with SGR", async () => {
    const { server, port } = await startServer();
    const socket = await connect(port);
    try {
        const read = collect(socket);
        await waitFor(read, (buf) => buf.includes("$ "));
        const bytes = read();
        assert.deepStrictEqual([...bytes.slice(0, 12)], [...codecMod.opening()],
            "server opens with the negotiation burst");
        const text = bytes.toString("utf8");
        assert.match(text, /PROCWATCH/);
        assert.match(text, /\/procwatch \$ $/);

        socket.write(Buffer.from([IAC, SB, OPT_NAWS, 0, 100, 0, 30, IAC, SE]));
        socket.write("pwd\r\n");
        await waitFor(read, (buf) => buf.toString("utf8").includes("/procwatch\r\n"));
        socket.write("cat sys/loadavg\r\n");
        await waitFor(read, (buf) => buf.toString("utf8").includes("0.42 0.40 0.35"));
        socket.write("nonsense\r\n");
        await waitFor(read, (buf) => buf.toString("utf8").includes("[31mUnknown command"));
    } finally {
        socket.destroy();
        await new Promise((resolve) => server.close(resolve));
    }
});

test("raw session: nc-style line loop, no IAC anywhere", async () => {
    const { server, port } = await startServer({ raw: true });
    const socket = await connect(port);
    try {
        const read = collect(socket);
        await waitFor(read, (buf) => buf.includes("$ "));
        assert.ok(!read().includes(0xff), "raw mode never emits IAC");
        socket.write("sys\n");
        await waitFor(read, (buf) => buf.toString("utf8").includes("demo-host"));
        socket.write("echo over > sys/loadavg\n");
        await waitFor(read, (buf) => buf.toString("utf8").includes("read-only"));
    } finally {
        socket.destroy();
        await new Promise((resolve) => server.close(resolve));
    }
});

test("session cap: second connection is refused politely", async () => {
    const { server, port } = await startServer({ raw: true, maxSessions: 1 });
    const first = await connect(port);
    try {
        const readFirst = collect(first);
        await waitFor(readFirst, (buf) => buf.includes("$ "));
        const second = await connect(port);
        const readSecond = collect(second);
        await waitFor(readSecond, (buf) => buf.toString("utf8").includes("server full"));
    } finally {
        first.destroy();
        await new Promise((resolve) => server.close(resolve));
    }
});

test("idle timeout kicks a silent session", async () => {
    const { server, port } = await startServer({ raw: true, idleTimeout: 1 });
    const socket = await connect(port);
    try {
        const read = collect(socket);
        const closed = new Promise((resolve) => socket.on("close", resolve));
        await closed;
        assert.match(read().toString("utf8"), /idle timeout/);
    } finally {
        socket.destroy();
        await new Promise((resolve) => server.close(resolve));
    }
});

test("codec: UTF-8 survives every chunk boundary", () => {
    const { codec, got } = makeCodec();
    const text = "echo café 界 😀\r\n";
    for (const byte of Buffer.from(text)) codec.feed(Buffer.from([byte]));
    assert.equal(got.data, text);
});

test("codec: oversized escaped subnegotiation is discarded and decoding resumes", () => {
    const { codec, got } = makeCodec();
    codec.feed(Buffer.from([IAC, SB, 24]));
    for (let i = 0; i < 10000; i++) codec.feed(Buffer.from([IAC, IAC]));
    codec.feed(Buffer.from([IAC, SE, ...Buffer.from("pwd\r\n")]));
    assert.equal(got.data, "pwd\r\n");
});

for (const raw of [true, false]) {
    test(`telnet raw=${raw}: limits unfinished lines and accepts large batches of short commands`, async () => {
        const { server, port } = await startServer({ raw });
        const socket = await connect(port);
        try {
            const read = collect(socket);
            await waitFor(read, (buf) => buf.includes("$ "));
            socket.write("echo batch\r\n".repeat(400) + "echo batch-finished\r\n");
            await waitFor(read, (buf) => buf.includes("batch-finished"));
            socket.write("x".repeat(4097));
            await waitFor(read, (buf) => buf.includes("line too long"));
            assert.ok(!read().includes("Unknown command: x"));
        } finally {
            socket.destroy();
            await new Promise((resolve) => server.close(resolve));
        }
    });
}

test("codec: interrupt is delivered between preceding and following text", () => {
    const seen = [];
    const codec = createTelnetCodec({ onData: (text) => seen.push(text), onInterrupt: () => seen.push("interrupt") });
    codec.feed(Buffer.from([97, 98, IAC, IP, 99]));
    assert.deepEqual(seen, ["ab", "interrupt", "c"]);
});

for (const raw of [true, false]) {
    test(`bashcrawl raw=${raw}: portable saves cross TCP chunk boundaries`, async () => {
        const app = require("../apps/bashcrawl.js").createApp();
        const source = app.createSession();
        source.runtime.state.envVars.NOTE = "café 界 😀".repeat(1000);
        const token = source.runtime.execute("save export")[0].text;
        assert.ok(token.length > 4096);
        const server = createTelnetServer(app, { ...DEFAULTS, raw });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const socket = await connect(server.address().port);
        try {
            const read = collect(socket);
            await waitFor(read, (buf) => buf.includes("$ "));
            const line = `save import ${token}\r\n`;
            for (let offset = 0; offset < line.length; offset += 997) {
                socket.write(line.slice(offset, offset + 997));
            }
            await waitFor(read, (buf) => buf.includes("Progress imported."));
            socket.write("echo $NOTE | wc -c\r\n");
            await waitFor(read, (buf) => buf.includes("14000"));
            socket.write("save\r\n");
            await waitFor(read, (buf) => buf.includes("This session is temporary."));
            assert.ok(!read().includes("Saved in your browser"));
        } finally {
            socket.destroy();
            await new Promise((resolve) => server.close(resolve));
        }
    });
}
