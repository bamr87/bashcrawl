(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.events = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge typed events — the structured channel between a session and
    // everything that watches it (HUDs, mastery tracking, a multiplayer hub,
    // recorders). The Line protocol (core/protocol.js) is what a command
    // PRINTS; events are what HAPPENED. Normative contract:
    // docs/schemas/events.v1.md.
    //
    // Contract notes (the same rules bashOS's events.py sets for its engine):
    //
    // - Sinks are synchronous and must never block: they run inside
    //   Shell#execute while a line is in flight. Post to your UI loop and
    //   return. A sink that throws is isolated (reported to onError) so one
    //   broken subscriber can never break the session.
    // - Events are frozen plain objects: { type, seq, session?, ...payload }.
    //   `seq` is a per-bus counter (ordering without a clock); `session` is
    //   stamped when the bus was created with one. No wall-clock timestamps —
    //   determinism is the kernel's default, and a sink that wants time reads
    //   its own clock.
    // - Producers emit only facts, never presentation: a toast, a sound or a
    //   broadcast line is a sink's choice.
    // - Types are dotted `noun.verb` strings. Consumers MUST ignore types they
    //   do not recognise; new types are additive within v1.

    const EVENTS_VERSION = "1.0";

    /**
     * The catalog of event types the framework and its platform modules emit.
     * Apps may emit their own (prefix them, e.g. `game.*`); this list is the
     * documented shared vocabulary, not a closed set.
     */
    const TYPES = Object.freeze({
        // Kernel (core/shell.js)
        "line.executed": "a full input line finished: { line, ok }",
        "command.run": "one pipeline segment ran: { cmd, args, piped, ok }",
        "location.changed": "the working directory changed: { from, to }",
        "session.reset": "state was replaced wholesale: {}",
        // Progression (apps)
        "progress.xp": "experience was awarded: { amount, total, reason }",
        "progress.rank": "a rank/level threshold was crossed: { index, title }",
        "item.gained": "an item entered the inventory: { item }",
        "health.changed": "health moved: { delta, hp }",
        "node.revealed": "a hidden directory was unlocked: { name, path }",
        "quest.completed": "a quest finished: { id, title, xp }",
        "achievement.unlocked": "a badge was earned: { id, title, icon }",
        "encounter.run": "an executable encounter ran: { key, script, path }",
        // Learning platform (core/curriculum.js, core/mastery.js)
        "course.enrolled": "a course became active: { course, title }",
        "lesson.started": "a lesson became current: { course, lesson, title }",
        "objective.completed": "a lesson objective was met: { course, lesson, objective, text }",
        "lesson.completed": "every objective of a lesson was met: { course, lesson, title, xp }",
        "course.completed": "every lesson of a course was met: { course, title }",
        "skill.levelled": "a skill's mastery level rose: { skill, level, label }",
        // Multiplayer hub (termforge/node/hub.js)
        "hub.joined": "a player joined the hub: { name }",
        "hub.left": "a player left the hub: { name }",
        "hub.message": "a chat line was delivered: { from, scope, text }",
    });

    class EventBus {
        /**
         * @param {object} [options]
         * @param {string} [options.session]  stamped onto every event
         * @param {(err: Error, event: object) => void} [options.onError]
         *        receives exceptions thrown by sinks (default: swallow)
         * @param {number} [options.history]  keep the last N events for
         *        late subscribers / recent() (default 0 = none)
         */
        constructor(options) {
            const opts = options || {};
            this.session = opts.session || null;
            this.onError = typeof opts.onError === "function" ? opts.onError : () => {};
            this.historyCap = Math.max(0, Number(opts.history) || 0);
            this._subs = new Map();
            this._history = [];
            this._seq = 0;
            this._buffers = new Set();
        }

        /**
         * Subscribe to one type, a `prefix.*` family, or every event ("*").
         * Returns an unsubscribe function.
         */
        on(type, fn) {
            if (typeof fn !== "function") throw new Error(`event ${type}: sink must be a function`);
            if (!this._subs.has(type)) this._subs.set(type, []);
            const list = this._subs.get(type);
            list.push(fn);
            return () => {
                const idx = list.indexOf(fn);
                if (idx >= 0) list.splice(idx, 1);
            };
        }

        /** Subscribe for exactly one delivery. */
        once(type, fn) {
            const off = this.on(type, (event) => {
                off();
                fn(event);
            });
            return off;
        }

        /** Build, record, and deliver one event. Returns the frozen event. */
        emit(type, payload) {
            if (typeof type !== "string" || !type) throw new Error("event type must be a non-empty string");
            this._seq += 1;
            const event = { type, seq: this._seq };
            if (this.session) event.session = this.session;
            if (payload && typeof payload === "object") {
                for (const [key, value] of Object.entries(payload)) {
                    if (key !== "type" && key !== "seq" && key !== "session") event[key] = value;
                }
            }
            Object.freeze(event);
            if (this.historyCap) {
                this._history.push(event);
                if (this._history.length > this.historyCap) this._history.shift();
            }
            for (const buffer of this._buffers) buffer.push(event);
            this._deliver(type, event);
            return event;
        }

        _deliver(type, event) {
            const targets = [];
            const exact = this._subs.get(type);
            if (exact) targets.push(...exact);
            const dot = type.indexOf(".");
            if (dot > 0) {
                const family = this._subs.get(`${type.slice(0, dot)}.*`);
                if (family) targets.push(...family);
            }
            const all = this._subs.get("*");
            if (all) targets.push(...all);
            for (const fn of targets) {
                try {
                    fn(event);
                } catch (err) {
                    try { this.onError(err, event); } catch (_ignored) { /* never rethrow */ }
                }
            }
        }

        /** The last `history` events (oldest first). */
        recent(limit) {
            const n = limit == null ? this._history.length : Math.max(0, limit);
            return this._history.slice(this._history.length - n);
        }

        /**
         * Capture every event emitted while `fn` runs; returns
         * { result, events }. Nested captures each see the events.
         */
        capture(fn) {
            const buffer = [];
            this._buffers.add(buffer);
            try {
                const result = fn();
                return { result, events: buffer };
            } finally {
                this._buffers.delete(buffer);
            }
        }

        /**
         * Forward every event into another bus (e.g. a session into a hub).
         * The forwarded copy is re-stamped by the target; the source session
         * rides along as `origin`.
         */
        pipe(target, filter) {
            return this.on("*", (event) => {
                if (!filter || filter(event)) target.emit(event.type, { ...event, origin: event.session || null });
            });
        }
    }

    return { EVENTS_VERSION, TYPES, EventBus };
});
