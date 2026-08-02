"use strict";
// procwatch — a ~150-line demo of TermForge as a dev/monitoring tool, NOT a
// game: live host metrics mapped into the virtual filesystem by a read-only
// VFS provider, plus one custom command pack, browsable with the ordinary
// posix toolkit (ls, cat, grep, pipes) on any host (TTY, telnet, tests).
//
//   /procwatch/readme            how to use
//   /procwatch/sys/hostname      one metric per virtual file, computed on read
//   /procwatch/sys/platform
//   /procwatch/sys/uptime
//   /procwatch/sys/loadavg
//   /procwatch/sys/memory
//   sys                          one-screen dashboard command
//
// The metric source is injectable: the default reads node:os, MOCK_SOURCE
// pins fixed values (tests, browser demos — anywhere without node:os).

const TermForge = require("../../node/index.js");

const MOCK_SOURCE = Object.freeze({
    hostname: () => "demo-host",
    platform: () => "demo-os 1.0",
    uptimeSeconds: () => 4242,
    loadavg: () => [0.42, 0.4, 0.35],
    memory: () => ({ totalBytes: 8 * 1024 ** 3, freeBytes: 3 * 1024 ** 3 }),
});

function osSource() {
    const os = require("node:os");
    return {
        hostname: () => os.hostname(),
        platform: () => `${os.platform()} ${os.release()}`,
        uptimeSeconds: () => Math.floor(os.uptime()),
        loadavg: () => os.loadavg(),
        memory: () => ({ totalBytes: os.totalmem(), freeBytes: os.freemem() }),
    };
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m (${seconds}s)`;
}

function formatMemory(mem) {
    const gib = (n) => (n / 1024 ** 3).toFixed(2);
    const used = mem.totalBytes - mem.freeBytes;
    const pct = mem.totalBytes ? Math.round((used / mem.totalBytes) * 100) : 0;
    return `used ${gib(used)} GiB / ${gib(mem.totalBytes)} GiB (${pct}%)`;
}

const METRICS = {
    hostname: (src) => src.hostname(),
    platform: (src) => src.platform(),
    uptime: (src) => formatUptime(src.uptimeSeconds()),
    loadavg: (src) => src.loadavg().map((n) => n.toFixed(2)).join(" "),
    memory: (src) => formatMemory(src.memory()),
};

const README = [
    "PROCWATCH — live host metrics on a TermForge filesystem",
    "",
    "Every file under sys/ is computed the moment you read it:",
    "    ls sys",
    "    cat sys/loadavg",
    "    grep -r GiB .",
    "    cat sys/uptime | rev        (pipes work on live data too)",
    "",
    "The `sys` command prints the whole dashboard at once.",
].join("\n");

function sysProvider(source) {
    const prefix = "/procwatch/sys";
    return {
        prefix,
        isDir: (p) => p === prefix,
        list: (p) => (p === prefix
            ? Object.keys(METRICS).map((name) => ({ name, type: "file", hidden: false }))
            : null),
        read: (p) => {
            const name = p.startsWith(prefix + "/") ? p.slice(prefix.length + 1) : null;
            return METRICS[name] ? METRICS[name](source) : null;
        },
    };
}

function procPack(source) {
    return {
        name: "procwatch",
        commands: {
            sys() {
                const pad = (label) => `  ${(label + ":").padEnd(11)}`;
                return [
                    { kind: "banner", text: "PROCWATCH" },
                    { kind: "output", text: `${pad("host")}${METRICS.hostname(source)}` },
                    { kind: "output", text: `${pad("platform")}${METRICS.platform(source)}` },
                    { kind: "output", text: `${pad("uptime")}${METRICS.uptime(source)}` },
                    { kind: "output", text: `${pad("load")}${METRICS.loadavg(source)}` },
                    { kind: "output", text: `${pad("memory")}${METRICS.memory(source)}` },
                    { kind: "dim", text: "  (each sys/ file recomputes on read — try cat sys/loadavg)" },
                ];
            },
            help() {
                return [
                    { kind: "info", text: "procwatch: sys = dashboard · ls/cat/grep browse live files under sys/." },
                    { kind: "dim", text: "cat readme for the tour." },
                ];
            },
        },
        meta: {
            sys: { summary: "print the live host dashboard", usage: "sys" },
            help: { summary: "procwatch help", usage: "help" },
        },
    };
}

function createApp(options = {}) {
    const source = options.source || osSource();

    return {
        id: "procwatch",
        name: "procwatch",

        createSession() {
            const shell = new TermForge.Shell({
                world: {
                    root: "/procwatch",
                    directories: {
                        "/procwatch": [{ name: "readme", type: "file", hidden: false }],
                    },
                    files: { "/procwatch/readme": README },
                },
                packs: [TermForge.packs.posix, procPack(source)],
            });
            shell.vfs.addProvider(sysProvider(source));
            return {
                runtime: shell,
                banner: [
                    { kind: "banner", text: "PROCWATCH" },
                    { kind: "info", text: "Live host metrics as a filesystem. Type: sys · ls sys · cat readme" },
                ],
                onControl() {},
            };
        },
    };
}

module.exports = { createApp, MOCK_SOURCE };
