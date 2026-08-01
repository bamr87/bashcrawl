(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.state = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge shell state — the framework-owned slice of a session.
    //
    // Framework apps and node hosts start from defaultShellState() and may add
    // their own fields on top. The bashcrawl game deliberately does NOT build
    // its state from this module: its fused defaultState() literal in
    // web/assets/js/runtime.js is the persisted-save shape
    // (bashcrawl-web-state-v1) and is locked by fixture, key order included.

    /** Fresh shell state rooted at a world path. */
    function defaultShellState(root) {
        return {
            cwd: root || "/",
            prevCwd: null,
            aliases: {},
            envVars: {},
            userNodes: {},
            history: [],
            historyIndex: -1,
            reveals: {},
        };
    }

    /**
     * Merge a parsed saved state over a freshly-built base state.
     *
     * Mirrors the semantics of the web app's storage.js: saved scalars and
     * arrays replace base values wholesale, while plain-object fields that
     * exist on the base (envVars, userNodes, flags, stats, ...) are merged
     * key-by-key so new fields introduced after the save was written keep
     * their defaults.
     */
    function mergeSavedState(base, parsed) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return base;
        const merged = { ...base, ...parsed };
        for (const key of Object.keys(base)) {
            const baseValue = base[key];
            if (!baseValue || typeof baseValue !== "object" || Array.isArray(baseValue)) continue;
            const savedValue = parsed[key];
            merged[key] = {
                ...baseValue,
                ...(savedValue && typeof savedValue === "object" && !Array.isArray(savedValue)
                    ? savedValue
                    : {}),
            };
        }
        return merged;
    }

    return { defaultShellState, mergeSavedState };
});
