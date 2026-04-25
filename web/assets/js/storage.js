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
        global.localStorage.setItem(KEY, JSON.stringify(state));
    }

    function clear() {
        global.localStorage.removeItem(KEY);
    }

    global.BashcrawlStorage = { load, save, clear, KEY };
})(window);
