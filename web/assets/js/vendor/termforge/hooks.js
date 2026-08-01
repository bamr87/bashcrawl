(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.hooks = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge hook bus — the extension spine of the Shell.
    //
    // Apps subscribe game/tool behavior onto the kernel instead of the kernel
    // hard-coding it. The Shell fires these hooks (see core/shell.js):
    //
    //   preExecute(line)                        side effects before anything runs
    //   interceptLine(line) -> Line[]|null      first non-null REPLACES the pipeline
    //                                           (e.g. a quiz capturing raw input)
    //   postExecute(line, outputs) -> Line[]    lines appended after the pipeline
    //   observePipeline(line, outputs)->Line[]  appended on the non-redirect exit
    //   beforeCommand(cmd, args, stdin)         per-segment, pre-dispatch
    //   execDispatch(name) -> Line[]|null       `./name` — first non-null handles it
    //   postCommand(cmd, args, stdin, outputs)  per-segment, post-dispatch
    //     (the `./` branch passes stdin === undefined, matching the
    //      historical emulator call shape)

    class HookBus {
        constructor() {
            this._subs = new Map();
        }

        /** Subscribe. Returns an unsubscribe function. */
        on(name, fn) {
            if (typeof fn !== "function") throw new Error(`hook ${name}: subscriber must be a function`);
            if (!this._subs.has(name)) this._subs.set(name, []);
            const list = this._subs.get(name);
            list.push(fn);
            return () => {
                const idx = list.indexOf(fn);
                if (idx >= 0) list.splice(idx, 1);
            };
        }

        /** Fire-and-forget: call every subscriber for side effects. */
        run(name, ...args) {
            for (const fn of this._subs.get(name) || []) fn(...args);
        }

        /** First non-null return wins; null when no subscriber handled it. */
        first(name, ...args) {
            for (const fn of this._subs.get(name) || []) {
                const result = fn(...args);
                if (result != null) return result;
            }
            return null;
        }

        /** Concatenate every subscriber's returned Line[] (non-arrays ignored). */
        collect(name, ...args) {
            const out = [];
            for (const fn of this._subs.get(name) || []) {
                const result = fn(...args);
                if (Array.isArray(result) && result.length) out.push(...result);
            }
            return out;
        }
    }

    return { HookBus };
});
