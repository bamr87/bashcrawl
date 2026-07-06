(function initStorage(global) {
    const KEY = "bashcrawl-web-state-v1";

    function load(defaultState) {
        try {
            const raw = global.localStorage.getItem(KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            const base = defaultState();
            return {
                ...base,
                ...parsed,
                stats: { ...base.stats, ...(parsed.stats || {}) },
                flags: { ...base.flags, ...(parsed.flags || {}) },
                envVars: { ...base.envVars, ...(parsed.envVars || {}) },
                userNodes: { ...base.userNodes, ...(parsed.userNodes || {}) },
            };
        } catch (_) {
            return defaultState();
        }
    }

    function save(state) {
        try {
            global.localStorage.setItem(KEY, JSON.stringify(state));
        } catch (_) { /* storage full/blocked: progress just doesn't persist */ }
    }

    function clear() {
        global.localStorage.removeItem(KEY);
    }

    // Namespaced side-stores (arcade scores, shell prefs) — additive keys so the
    // long-lived story save above is never touched by new features.
    function loadKey(key, fallback) {
        try {
            const raw = global.localStorage.getItem(key);
            return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
        } catch (_) {
            return { ...fallback };
        }
    }

    function saveKey(key, value) {
        try {
            global.localStorage.setItem(key, JSON.stringify(value));
        } catch (_) { /* storage full/blocked: scores just don't persist */ }
    }

    global.BashcrawlStorage = { load, save, clear, KEY, loadKey, saveKey };
})(window);
