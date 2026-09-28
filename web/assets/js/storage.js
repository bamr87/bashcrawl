(function initStorage(global) {
    const KEY = "bashcrawl-web-state-v1";

    function load(defaultState) {
        try {
            const raw = global.localStorage.getItem(KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            const base = defaultState();
            if (global.TermForge && global.TermForge.state) {
                global.TermForge.state.validateSavedState(base, parsed);
                return global.TermForge.state.mergeSavedState(base, parsed);
            }
            return base;
        } catch (err) {
            global.BashcrawlStorage.lastError = err.message;
            backup();
            return defaultState();
        }
    }

    function save(state) {
        try {
            global.localStorage.setItem(KEY, JSON.stringify(state));
            return true;
        } catch (_) { return false; }
    }

    function backup() {
        try {
            const raw = global.localStorage.getItem(KEY);
            if (raw) global.localStorage.setItem(KEY + "-recovery", raw);
            return Boolean(raw);
        } catch (_) { return false; }
    }

    function clear() {
        try { global.localStorage.removeItem(KEY); return true; }
        catch (_) { return false; }
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

    global.BashcrawlStorage = { load, save, clear, backup, KEY, loadKey, saveKey, lastError: "" };
})(window);
