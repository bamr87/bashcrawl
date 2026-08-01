"use strict";
// agentwatch — a TermForge dashboard that monitors AI agent tasks and work.
//
// The dashboard is a TaskSource projected into the terminal three ways at
// once: as commands (`board`, `agent <id>`, `feed`), as live read-only VFS
// files (`cat agents/forge`, `grep -r failed .`, `cat feed | tail -3` — the
// whole posix toolkit works on live data), and over any host (TTY, telnet).
//
//   TaskSource = {
//       agents() -> [{ id, name, status, task, progress, detail, updated }],
//       events(limit) -> [{ ts, agent, kind, text }],
//   }
//   status ∈ pending | in_progress | completed | failed | blocked
//   progress ∈ 0..100 or null; kind is a Line-protocol display kind.
//
// Two sources ship built in:
//   - demoSource(): a deterministic simulated fleet — state advances one step
//     every read (no wall clock, no randomness), so `cat agents/forge` twice
//     visibly progresses and tests replay exactly.
//   - jsonlSource(dir): an adapter for this repo's real agent telemetry — the
//     playtest recorder's JSONL session logs (logs/sessions/**). Each session
//     is an agent; commands, quests, struggles and content gaps become task
//     state and feed events.
//
// createApp({ source }) takes a TaskSource directly; createApp({ dataDir })
// reads JSONL logs from that directory; neither means the demo fleet.

const TermForge = require("../../node/index.js");

const STATUS_META = {
    pending: { icon: "○", kind: "dim", label: "pending" },
    in_progress: { icon: "▶", kind: "info", label: "in_progress" },
    completed: { icon: "✔", kind: "success", label: "completed" },
    failed: { icon: "✖", kind: "error", label: "failed" },
    blocked: { icon: "⏸", kind: "magic", label: "blocked" },
};

function bar(progress) {
    if (progress == null) return "──────────";
    const filled = Math.round(Math.max(0, Math.min(100, progress)) / 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
}

const pad = (text, width) => String(text ?? "").padEnd(width).slice(0, width);

// ── Demo source: a deterministic ticking fleet ──────────────────────────

function demoSource() {
    let step = 0;
    const FLEET = [
        { id: "atlas", name: "Atlas (research)", task: "Map the payments codebase", start: 55, speed: 3 },
        { id: "forge", name: "Forge (implement)", task: "Extract billing service", start: 20, speed: 5 },
        { id: "sentry", name: "Sentry (review)", task: "Adversarial review of PR #42", start: 0, speed: 4, waitFor: 6 },
        { id: "probe", name: "Probe (tests)", task: "Reproduce flaky checkout test", start: 65, speed: 0, failAt: 4 },
        { id: "scribe", name: "Scribe (docs)", task: "Write migration runbook", start: 0, speed: 0, blocked: "waiting on Forge" },
    ];
    const SCRIPT = [
        { agent: "atlas", kind: "info", text: "opened src/payments/ — 214 files in scope" },
        { agent: "forge", kind: "output", text: "$ git checkout -b extract-billing" },
        { agent: "probe", kind: "output", text: "$ npm test -- checkout.spec (attempt 3/5)" },
        { agent: "atlas", kind: "success", text: "dependency map complete: 12 modules, 3 cycles" },
        { agent: "probe", kind: "error", text: "flake reproduced — race in cart teardown" },
        { agent: "forge", kind: "output", text: "$ node --test billing/ … 41 passing" },
        { agent: "sentry", kind: "info", text: "review started: 18 findings queued for verification" },
        { agent: "probe", kind: "error", text: "task failed: fix exceeds scope, escalating to human" },
        { agent: "forge", kind: "success", text: "billing service extracted — 0 imports left behind" },
        { agent: "sentry", kind: "magic", text: "2 findings confirmed, 16 refuted by verifiers" },
        { agent: "atlas", kind: "success", text: "handoff brief posted to Forge and Scribe" },
        { agent: "scribe", kind: "info", text: "unblocked — drafting runbook from Atlas's brief" },
    ];

    function tick() {
        step += 1;
    }

    return {
        agents() {
            tick();
            return FLEET.map((a) => {
                let progress = Math.min(100, a.start + step * a.speed);
                let status = "in_progress";
                if (a.blocked) { status = "blocked"; progress = 0; }
                else if (a.waitFor != null && step < a.waitFor) { status = "pending"; progress = 0; }
                else if (a.failAt != null && step >= a.failAt) { status = "failed"; progress = a.start; }
                else if (progress >= 100) status = "completed";
                return {
                    id: a.id,
                    name: a.name,
                    status,
                    task: a.blocked && status === "blocked" ? `${a.task} (${a.blocked})` : a.task,
                    progress: status === "pending" ? null : progress,
                    detail: `simulated step ${step}`,
                    updated: `step ${step}`,
                };
            });
        },
        events(limit = 12) {
            const visible = SCRIPT.slice(0, Math.min(SCRIPT.length, 4 + step));
            return visible.slice(-limit).map((e, i) => ({ ts: `t+${i}`, ...e }));
        },
    };
}

// ── JSONL source: this repo's real agent playtest telemetry ─────────────

function jsonlSource(dir) {
    const fs = require("node:fs");
    const path = require("node:path");

    function readEvents() {
        const events = [];
        const walk = (d) => {
            let entries;
            try {
                entries = fs.readdirSync(d, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                const full = path.join(d, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name.endsWith(".jsonl")) {
                    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
                        if (!line.trim()) continue;
                        try {
                            events.push(JSON.parse(line));
                        } catch { /* skip malformed telemetry lines */ }
                    }
                }
            }
        };
        walk(dir);
        return events.filter((e) => e && e.sid && e.event);
    }

    const EVENT_KINDS = {
        session_start: "info",
        session_end: "info",
        room_enter: "info",
        discovery: "magic",
        quest_complete: "success",
        struggle: "error",
        content_gap: "error",
    };

    function describe(e) {
        switch (e.event) {
            case "command": return `$ ${e.command}${e.outcome === "ERROR" ? "  (error)" : ""}`;
            case "room_enter": return `entered ${e.room}`;
            case "discovery": return `discovered ${e.command} in ${e.room}`;
            case "quest_complete": return `quest complete: ${e.quest_title || e.quest_id}`;
            case "struggle": return `struggling in ${e.room} (${e.kind || "repeat"})`;
            case "content_gap": return `content gap: ${e.reason || e.detail || "unspecified"}`;
            case "session_start": return `session started (${e.mode || "playtest"})`;
            case "session_end": return `session ended: ${e.rooms_visited ?? "?"} rooms, ${e.quests_completed ?? "?"} quests`;
            default: return e.event;
        }
    }

    return {
        agents() {
            const bySid = new Map();
            for (const e of readEvents()) {
                if (!bySid.has(e.sid)) bySid.set(e.sid, []);
                bySid.get(e.sid).push(e);
            }
            return [...bySid.entries()].map(([sid, events]) => {
                const last = events[events.length - 1];
                const end = events.find((e) => e.event === "session_end");
                const quests = events.filter((e) => e.event === "quest_complete").length;
                const gaps = events.filter((e) => e.event === "content_gap").length;
                const commands = events.filter((e) => e.event === "command").length;
                const status = end ? (gaps > 0 ? "blocked" : "completed") : "in_progress";
                return {
                    id: sid.slice(0, 12),
                    name: `playtest ${sid.slice(0, 12)}`,
                    status,
                    task: end
                        ? `finished in ${end.final_cwd || end.room || last.room || "?"}`
                        : `playing: ${describe(last)}`,
                    progress: Math.min(100, quests * 13),
                    detail: `${commands} commands · ${quests} quests · ${gaps} content gaps`,
                    updated: last.ts || "?",
                };
            });
        },
        events(limit = 12) {
            const all = readEvents();
            return all.slice(-limit).map((e) => ({
                ts: e.ts || "?",
                agent: e.sid.slice(0, 12),
                kind: e.event === "command" && e.outcome === "ERROR" ? "error" : (EVENT_KINDS[e.event] || "output"),
                text: describe(e),
            }));
        },
    };
}

// ── The dashboard pack + provider wiring ────────────────────────────────

const README = [
    "AGENTWATCH — AI agent tasks and work, on a TermForge filesystem",
    "",
    "Commands:",
    "    board            the fleet at a glance (status, task, progress)",
    "    agent <id>       one agent in detail, with its recent activity",
    "    feed [n]         the last n activity events (default 12)",
    "",
    "Everything is also a live file — the posix toolkit works on agent state:",
    "    ls agents                cat agents/forge",
    "    grep -r failed .         cat feed | tail -3",
    "",
    "Every read recomputes from the task source. Try `board` twice.",
].join("\n");

function agentCard(a) {
    const meta = STATUS_META[a.status] || STATUS_META.pending;
    return [
        `${a.name}  [${meta.label}]`,
        `  task:      ${a.task}`,
        `  progress:  ${bar(a.progress)} ${a.progress == null ? "—" : `${a.progress}%`}`,
        `  detail:    ${a.detail}`,
        `  updated:   ${a.updated}`,
    ].join("\n");
}

function watchPack(source) {
    return {
        name: "agentwatch",
        commands: {
            board() {
                const agents = source.agents();
                const lines = [
                    { kind: "banner", text: "AGENT BOARD" },
                    { kind: "dim", text: `  ${pad("AGENT", 12)} ${pad("STATUS", 13)} ${pad("PROGRESS", 12)} TASK` },
                ];
                for (const a of agents) {
                    const meta = STATUS_META[a.status] || STATUS_META.pending;
                    lines.push({
                        kind: meta.kind,
                        text: `${meta.icon} ${pad(a.id, 12)} ${pad(meta.label, 13)} ${bar(a.progress)} ${a.task}`,
                    });
                }
                const done = agents.filter((a) => a.status === "completed").length;
                const bad = agents.filter((a) => a.status === "failed").length;
                lines.push({ kind: "dim", text: `  ${agents.length} agents · ${done} completed · ${bad} failed — 'agent <id>' for detail, 'feed' for activity` });
                return lines;
            },

            agent(args) {
                const id = (args[0] || "").toLowerCase();
                if (!id) return [{ kind: "error", text: "Usage: agent <id>  (see `board` or `ls agents`)" }];
                const found = source.agents().find((a) => a.id.toLowerCase() === id);
                if (!found) return [{ kind: "error", text: `No such agent: ${id}` }];
                const meta = STATUS_META[found.status] || STATUS_META.pending;
                const lines = [{ kind: meta.kind, text: agentCard(found) }];
                const recent = source.events(50).filter((e) => e.agent === found.id).slice(-5);
                if (recent.length) {
                    lines.push({ kind: "dim", text: "  recent activity:" });
                    for (const e of recent) lines.push({ kind: e.kind, text: `    ${e.text}` });
                }
                return lines;
            },

            feed(args) {
                const limit = Number(args[0]) > 0 ? Number(args[0]) : 12;
                const events = source.events(limit);
                if (!events.length) return [{ kind: "dim", text: "No agent activity yet." }];
                return events.map((e) => ({ kind: e.kind, text: `[${pad(e.agent, 12)}] ${e.text}` }));
            },

            help() {
                return [
                    { kind: "info", text: "agentwatch: board · agent <id> · feed [n] — live files under agents/ and feed." },
                    { kind: "dim", text: "cat readme for the tour; the posix toolkit works on all of it." },
                ];
            },
        },
        meta: {
            board: { summary: "the agent fleet at a glance", usage: "board" },
            agent: { summary: "one agent in detail", usage: "agent <id>" },
            feed: { summary: "recent agent activity", usage: "feed [n]" },
            help: { summary: "agentwatch help", usage: "help" },
        },
    };
}

function agentsProvider(source) {
    const prefix = "/agentwatch/agents";
    return {
        prefix,
        isDir: (p) => p === prefix,
        list: (p) => (p === prefix
            ? source.agents().map((a) => ({ name: a.id, type: "file", hidden: false }))
            : null),
        read: (p) => {
            if (!p.startsWith(prefix + "/")) return null;
            const id = p.slice(prefix.length + 1);
            const found = source.agents().find((a) => a.id === id);
            return found ? `${agentCard(found)}\n` : null;
        },
    };
}

function feedProvider(source) {
    const prefix = "/agentwatch/feed";
    return {
        prefix,
        isDir: () => false,
        list: () => null,
        read: (p) => (p === prefix
            ? source.events(20).map((e) => `[${e.agent}] ${e.text}`).join("\n")
            : null),
    };
}

function createApp(options = {}) {
    const source = options.source
        || (options.dataDir ? jsonlSource(options.dataDir) : demoSource());

    return {
        id: "agentwatch",
        name: "agentwatch",

        createSession() {
            const shell = new TermForge.Shell({
                world: {
                    root: "/agentwatch",
                    directories: {
                        "/agentwatch": [{ name: "readme", type: "file", hidden: false }],
                    },
                    files: { "/agentwatch/readme": README },
                },
                packs: [TermForge.packs.posix, watchPack(source)],
                uiText: { figletDefault: "AGENTWATCH" },
            });
            shell.vfs.addProvider(agentsProvider(source));
            shell.vfs.addProvider(feedProvider(source));
            return {
                runtime: shell,
                banner: [
                    { kind: "banner", text: "AGENTWATCH" },
                    { kind: "info", text: "AI agent tasks and work, live. Type: board · feed · agent <id> · cat readme" },
                ],
                onControl() {},
            };
        },
    };
}

module.exports = { createApp, demoSource, jsonlSource };
