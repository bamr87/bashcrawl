(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.registry = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge command registry.
    //
    // A pack is a plain module:
    //   { name: "posix",
    //     commands: { cat(args, stdin) { ... }, ... },   // unbound, use `this`
    //     meta:     { cat: { summary, usage }, ... } }   // optional docs
    //
    // Command functions are ALWAYS invoked as fn.call(shell, args, stdin) and
    // return Line[] (see core/protocol.js). They may use any public Shell
    // member through `this`.
    //
    // An app composes packs with buildHandlers(), or writes an explicit
    // handlers literal referencing pack functions directly — bashcrawl does
    // the latter so its full command surface is enumerable in one place.

    /** Merge packs into one name -> function map; later packs win. */
    function buildHandlers(...packs) {
        const handlers = {};
        for (const pack of packs) {
            if (!pack || typeof pack.commands !== "object") {
                throw new Error("buildHandlers: each pack needs a commands object");
            }
            Object.assign(handlers, pack.commands);
        }
        return handlers;
    }

    /** Look up {summary, usage} metadata for a command across packs. */
    function describe(packs, name) {
        for (let i = packs.length - 1; i >= 0; i -= 1) {
            const meta = packs[i] && packs[i].meta;
            if (meta && meta[name]) return meta[name];
        }
        return null;
    }

    return { buildHandlers, describe };
});
