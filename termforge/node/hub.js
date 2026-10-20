"use strict";
// TermForge hub — shared presence and chat across the sessions of one host
// process: the telnet server's MUD mode (`host-telnet.js --hub`).
//
// Each session joins as a member with a `deliver(lines)` callback (the host
// prints those lines above the member's half-typed prompt). The hub installs
// one TermForge plugin per member — who / say / emote / shout / name / top —
// and watches the member's typed event bus (core/events.js) to announce the
// moments worth sharing: a badge, a finished lesson or course, a rank, an
// unlocked room, and players arriving in or leaving a room.
//
// Brand-neutral: every string is a uiText default the app may override.
// Pure logic, no sockets: hosts own transport, tests drive it directly.
//
// SAFETY. Chat is the one place bytes typed by one client reach another's
// terminal, so text is sanitized before it is stored or delivered: C0/C1
// control characters (ESC included — no injected escape sequences), bidi
// overrides and zero-width characters are removed, whitespace collapses,
// and length is capped. The same filter covers every other string of one
// member that is shown to another — `who` prints a directory a player named
// with `mkdir`, so it is cleaned too. Names are a strict
// [A-Za-z][A-Za-z0-9_-]{1,15}, unique case-insensitively. Each member has a
// token-bucket rate limit for what it broadcasts: chat and renames share one
// lane, room moves have their own (an unannounced move is harmless; a chat
// message is refused with a notice). A member whose `deliver` keeps throwing
// is reported through `onError` and dropped, never silently kept.
// A member sees others' names, locations and XP — nothing else of theirs.

const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{1,15}$/;

/** Strip control/format characters, collapse whitespace, cap length. */
function clean(text, max) {
    return String(text == null ? "" : text).replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const DEFAULT_TEXT = {
    hubWhoTitle: (n) => `👥 Online — ${n}`,
    hubWhoRow: (name, where, xp, you) => `  ${name.padEnd(16)} ${where.padEnd(28)} ${xp}${you ? "  (you)" : ""}`,
    hubTopTitle: "🏆 Leaderboard — players online now",
    hubTopRow: (n, name, xp) => `  ${String(n).padStart(2)}. ${name.padEnd(16)} ${xp} XP`,
    hubSay: (name, text) => `💬 ${name} says: ${text}`,
    hubSaid: (text) => `💬 You say: ${text}`,
    hubAlone: "(No one else is here to hear you. Try shout, or who.)",
    hubEmote: (name, text) => `✳ ${name} ${text}`,
    hubShout: (name, text) => `📣 ${name} shouts: ${text}`,
    hubShouted: (text) => `📣 You shout: ${text}`,
    hubEmpty: (cmd) => `Usage: ${cmd} MESSAGE`,
    hubSlowDown: "Slow down — the hub only carries a few messages every few seconds.",
    hubName: (name) => `You are ${name}.`,
    hubRenamed: (old, name) => `✎ ${old} is now known as ${name}.`,
    hubBadName: "Names are 2-16 letters, digits, - or _, starting with a letter.",
    hubTaken: (name) => `The name ${name} is taken.`,
    hubJoined: (name) => `✦ ${name} joined.`,
    hubLeft: (name) => `✦ ${name} left.`,
    hubArrives: (name) => `→ ${name} arrives.`,
    hubLeaves: (name) => `← ${name} leaves.`,
    hubBadge: (name, icon, title) => `✦ ${name} earned ${icon || "🏅"} ${title}`,
    hubLesson: (name, title) => `🎓 ${name} completed the lesson “${title}”`,
    hubCourse: (name, title) => `🏆 ${name} completed the course ${title}!`,
    hubRank: (name, title) => `★ ${name} is now ${title}`,
    hubReveal: (name, room) => `🔓 ${name} opened ${room}/`,
};

class Hub {
    /**
     * @param {object} [options]
     * @param {number} [options.maxMessage]    chat length cap (default 240)
     * @param {number} [options.burst]         messages (chat, renames) allowed in a burst (default 5)
     * @param {number} [options.presenceBurst] room moves announced in a burst (default 8)
     * @param {number} [options.refillMs]      ms to regain one message or move (default 2000)
     * @param {number} [options.maxFailures]   consecutive failed deliveries before a member is dropped (default 3)
     * @param {(err: Error, member: object) => void} [options.onError]  called when a member's deliver() throws
     * @param {{now: () => number}} [options.clock]
     */
    constructor(options) {
        const opts = options || {};
        this.maxMessage = opts.maxMessage || 240;
        this.burst = opts.burst || 5;
        this.presenceBurst = opts.presenceBurst || 8;
        this.refillMs = opts.refillMs || 2000;
        this.maxFailures = opts.maxFailures || 3;
        this.onError = typeof opts.onError === "function" ? opts.onError : null;
        this.clock = opts.clock || { now: () => Date.now() };
        this.members = new Map();
        this._next = 0;
    }

    /** The member list, oldest first. */
    list() {
        return Array.from(this.members.values());
    }

    nameTaken(name, except) {
        const want = name.toLowerCase();
        return this.list().some((m) => m !== except && m.name.toLowerCase() === want);
    }

    /**
     * Add a session. `deliver(lines)` must print Line records into that
     * session asynchronously. Returns the member; call member.bind(shell)
     * again whenever the host replaces the session's runtime.
     */
    join({ shell, deliver, name }) {
        this._next += 1;
        let base = clean(name, 16);
        if (!NAME_RE.test(base)) base = `guest${this._next}`;
        let unique = base;
        for (let n = 2; this.nameTaken(unique); n += 1) unique = `${base.slice(0, 14)}${n}`;
        const now = this.clock.now();
        const member = {
            id: this._next,
            name: unique,
            shell: null,
            deliver: typeof deliver === "function" ? deliver : () => {},
            lanes: {
                chat: { burst: this.burst, tokens: this.burst, refilledAt: now },
                presence: { burst: this.presenceBurst, tokens: this.presenceBurst, refilledAt: now },
            },
            failures: 0,
            unbind: null,
            bind: (next) => this.bind(member, next),
        };
        this.members.set(member.id, member);
        if (shell) this.bind(member, shell);
        this.announce(member, "all", (s) => s.text("hubJoined", member.name));
        return member;
    }

    /** Attach (or move) a member's plugin + event watch to a shell. */
    bind(member, shell) {
        if (member.unbind) member.unbind();
        member.shell = shell;
        const offs = [];
        const handle = shell.use(this.plugin(member));
        offs.push(() => handle.uninstall());
        if (shell.events) offs.push(shell.events.on("*", (event) => this.observe(member, event)));
        member.unbind = () => { while (offs.length) offs.pop()(); member.unbind = null; };
        return member;
    }

    leave(member) {
        if (!this.members.has(member.id)) return;
        if (member.unbind) member.unbind();
        this.members.delete(member.id);
        this.announce(member, "all", (s) => s.text("hubLeft", member.name));
    }

    /** A member's exact working directory — for scoping, never for display. */
    where(member) {
        return member.shell && member.shell.state ? String(member.shell.state.cwd || "") : "";
    }

    /** The same, safe to print in another member's terminal. */
    whereShown(member) {
        return clean(this.where(member), 48);
    }

    /**
     * Deliver a line to other members. scope: "all", "room" (same cwd as the
     * sender), or a cwd string. `render(shell)` builds the text in each
     * recipient's own copy deck. Returns how many members received it.
     *
     * A throwing `deliver` (a socket that died before its close event, a host
     * bug) never breaks the sender: the failure is reported to `onError`, and
     * after `maxFailures` in a row the member is dropped from the hub.
     */
    announce(from, scope, render, kind) {
        let count = 0;
        const room = scope === "room" ? this.where(from) : scope;
        for (const member of this.list()) {
            if (member === from || !member.shell || !this.members.has(member.id)) continue;
            if (scope !== "all" && this.where(member) !== room) continue;
            try {
                member.deliver([{ kind: kind || "dim", text: render(member.shell) }]);
                member.failures = 0;
                count += 1;
            } catch (err) {
                member.failures += 1;
                if (this.onError) this.onError(err, member);
                if (member.failures >= this.maxFailures) this.leave(member);
            }
        }
        return count;
    }

    /**
     * Token bucket per lane: true when the member may send now. "chat" (the
     * default) covers say/emote/shout and renames; "presence" covers room
     * moves. Both regain one token every refillMs, up to the lane's burst.
     */
    allow(member, lane) {
        const bucket = member.lanes[lane || "chat"];
        if (!bucket) return false;
        const now = this.clock.now();
        const regained = Math.floor((now - bucket.refilledAt) / this.refillMs);
        if (regained > 0) {
            bucket.tokens = Math.min(bucket.burst, bucket.tokens + regained);
            bucket.refilledAt += regained * this.refillMs;
        }
        if (bucket.tokens <= 0) return false;
        bucket.tokens -= 1;
        return true;
    }

    // Typed events worth sharing with everyone, or with a room.
    observe(member, event) {
        const name = member.name;
        switch (event.type) {
            case "achievement.unlocked":
                this.announce(member, "all", (s) => s.text("hubBadge", name, event.icon, event.title), "magic");
                break;
            case "lesson.completed":
                this.announce(member, "all", (s) => s.text("hubLesson", name, event.title), "magic");
                break;
            case "course.completed":
                this.announce(member, "all", (s) => s.text("hubCourse", name, event.title), "success");
                break;
            case "progress.rank":
                this.announce(member, "all", (s) => s.text("hubRank", name, event.title), "magic");
                break;
            case "node.revealed":
                this.announce(member, "all", (s) => s.text("hubReveal", name, event.name));
                break;
            case "location.changed":
                // A player bouncing between rooms at socket speed must not
                // flood everyone else; past the burst, moves go unannounced
                // (`who` still tells the truth).
                if (!this.allow(member, "presence")) break;
                this.announce(member, event.from, (s) => s.text("hubLeaves", name));
                this.announce(member, event.to, (s) => s.text("hubArrives", name));
                break;
            default:
                break;
        }
    }

    /** The per-member command plugin. */
    plugin(member) {
        const hub = this;
        const message = (args) => clean(args.join(" "), hub.maxMessage);
        const xpOf = (m) => (m.shell && Number.isFinite(m.shell.state.xp) ? m.shell.state.xp : 0);
        return {
            id: "hub",
            name: "Hub",
            version: "1.0.0",
            description: "Who is online, room and global chat, and a live leaderboard.",
            commands: {
                who() {
                    const rows = hub.list().map((m) => ({
                        kind: m === member ? "info" : "output",
                        text: this.text("hubWhoRow", m.name, hub.whereShown(m), `${xpOf(m)} XP`, m === member),
                    }));
                    return [{ kind: "magic", text: this.text("hubWhoTitle", rows.length) }, ...rows];
                },
                say(args) {
                    const text = message(args);
                    if (!text) return [{ kind: "error", text: this.text("hubEmpty", "say") }];
                    if (!hub.allow(member)) return [{ kind: "error", text: this.text("hubSlowDown") }];
                    const heard = hub.announce(member, "room", (s) => s.text("hubSay", member.name, text), "info");
                    const out = [{ kind: "info", text: this.text("hubSaid", text) }];
                    if (!heard) out.push({ kind: "dim", text: this.text("hubAlone") });
                    return out;
                },
                emote(args) {
                    const text = message(args);
                    if (!text) return [{ kind: "error", text: this.text("hubEmpty", "emote") }];
                    if (!hub.allow(member)) return [{ kind: "error", text: this.text("hubSlowDown") }];
                    hub.announce(member, "room", (s) => s.text("hubEmote", member.name, text), "magic");
                    return [{ kind: "magic", text: this.text("hubEmote", member.name, text) }];
                },
                shout(args) {
                    const text = message(args);
                    if (!text) return [{ kind: "error", text: this.text("hubEmpty", "shout") }];
                    if (!hub.allow(member)) return [{ kind: "error", text: this.text("hubSlowDown") }];
                    hub.announce(member, "all", (s) => s.text("hubShout", member.name, text), "art");
                    return [{ kind: "art", text: this.text("hubShouted", text) }];
                },
                name(args) {
                    if (!args[0]) return [{ kind: "info", text: this.text("hubName", member.name) }];
                    const next = clean(args[0], 16);
                    if (!NAME_RE.test(next)) return [{ kind: "error", text: this.text("hubBadName") }];
                    if (hub.nameTaken(next, member)) return [{ kind: "error", text: this.text("hubTaken", next) }];
                    // A rename is broadcast to everyone: it spends a chat token.
                    if (!hub.allow(member)) return [{ kind: "error", text: this.text("hubSlowDown") }];
                    const old = member.name;
                    member.name = next;
                    hub.announce(member, "all", (s) => s.text("hubRenamed", old, next));
                    return [{ kind: "success", text: this.text("hubName", next) }];
                },
                top() {
                    const ranked = hub.list().slice().sort((a, b) => xpOf(b) - xpOf(a) || a.id - b.id);
                    return [
                        { kind: "magic", text: this.text("hubTopTitle") },
                        ...ranked.map((m, i) => ({ kind: m === member ? "info" : "output", text: this.text("hubTopRow", i + 1, m.name, xpOf(m)) })),
                    ];
                },
            },
            meta: {
                who: { summary: "who is online, and where", usage: "who", group: "hub" },
                say: { summary: "speak to everyone in the same directory", usage: "say MESSAGE", group: "hub" },
                emote: { summary: "act out something for the room", usage: "emote ACTION", group: "hub" },
                shout: { summary: "speak to everyone online", usage: "shout MESSAGE", group: "hub" },
                name: { summary: "show or change your display name", usage: "name [NEW-NAME]", group: "hub" },
                top: { summary: "leaderboard of everyone online, by XP", usage: "top", group: "hub" },
            },
            uiText: DEFAULT_TEXT,
        };
    }
}

module.exports = { Hub, clean, NAME_RE, DEFAULT_TEXT };
