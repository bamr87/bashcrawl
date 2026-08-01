(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.vfs = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge virtual filesystem.
    //
    // A world is three flat maps (the shape scripts/export_static_web.py and
    // arcade's worldFromScenario both produce):
    //
    //   { root:        "/entrance",
    //     directories: { "/path": [{name, type: "dir"|"file"|"exec", hidden}] },
    //     files:       { "/path/file": "contents" },
    //     rooms:       { "/path": {...meta...} },          // optional
    //     encounters:  { "/path/script": {...spec...} } }  // optional
    //
    // Layered on top:
    //   - state.userNodes — session-created files/dirs; a written file shadows
    //     a same-named world file (and `rm` peels the shadow off again).
    //   - state.reveals   — visible-path -> stored-path aliases for unlocked
    //     hidden rooms (`/entrance/chapel` -> `/entrance/.chapel`), applied
    //     longest-prefix-first by actual().
    //   - providers       — dynamic read-only subtrees (monitoring tools map
    //     live data to virtual files); longest matching mount wins and takes
    //     precedence over userNodes and the world.
    //
    // State is fetched through getState() on every call so a host can swap the
    // whole state object (reset) without rebuilding the VFS.
    //
    // Filesystem semantics are extracted verbatim from the bashcrawl web
    // emulator; providers are additive and inert unless mounted.

    /** @typedef {{name: string, type: "dir"|"file"|"exec", hidden: boolean}} Entry */
    /**
     * @typedef {object} Provider
     * @property {string} prefix        absolute mount path, no trailing slash
     * @property {(path: string) => boolean} isDir
     * @property {(path: string) => Entry[]|null} list
     * @property {(path: string) => string|null} read
     */

    function createVfs(world, options) {
        const getState = (options && options.getState) || (() => ({}));
        /** @type {Provider[]} */
        const providers = [];

        function addProvider(provider) {
            if (!provider || typeof provider.prefix !== "string" || !provider.prefix.startsWith("/")) {
                throw new Error("provider.prefix must be an absolute path");
            }
            providers.push(provider);
            // Longest mount first, so nested mounts win.
            providers.sort((a, b) => b.prefix.length - a.prefix.length);
        }

        function providerFor(path) {
            for (const provider of providers) {
                if (path === provider.prefix || path.startsWith(provider.prefix + "/")) {
                    return provider;
                }
            }
            return null;
        }

        function resolve(path, cwd) {
            if (!path || path === ".") return cwd;
            const base = path.startsWith("/") ? [] : cwd.split("/").filter(Boolean);
            for (const part of path.split("/")) {
                if (!part || part === ".") continue;
                if (part === "..") base.pop();
                else base.push(part);
            }
            return "/" + base.join("/");
        }

        function parentPath(path) {
            const parts = path.split("/").filter(Boolean);
            parts.pop();
            return "/" + parts.join("/");
        }

        // Translate a player-visible path (e.g. /entrance/chapel) into the actual
        // stored world path (e.g. /entrance/.chapel) for any room the player has
        // unlocked. Mirrors the bash treasure's `mv ../.chapel ../chapel`.
        function actual(path) {
            const reveals = getState().reveals || {};
            let best = null;
            for (const visible of Object.keys(reveals)) {
                if (path === visible || path.startsWith(visible + "/")) {
                    if (!best || visible.length > best.length) best = visible;
                }
            }
            return best ? reveals[best] + path.slice(best.length) : path;
        }

        function basename(path) {
            return path.split("/").filter(Boolean).pop() || "";
        }

        function node(path) {
            const provider = providerFor(path);
            if (provider) {
                if (provider.isDir(path)) return { type: "dir" };
                return provider.read(path) != null ? { type: "file" } : null;
            }
            const real = actual(path);
            if (world.directories[real]) return { type: "dir" };
            if (Object.prototype.hasOwnProperty.call(world.files, real)) return { type: "file" };
            return getState().userNodes[path] || null;
        }

        function isDir(path) {
            const provider = providerFor(path);
            if (provider) return Boolean(provider.isDir(path));
            return Boolean(world.directories[actual(path)] || getState().userNodes[path]?.type === "dir");
        }

        function readFile(path) {
            const provider = providerFor(path);
            if (provider) return provider.read(path);
            // Player-written files shadow shipped world files (a `>` redirect onto
            // an existing file overwrites it, exactly like a real filesystem).
            const nodeEntry = getState().userNodes[path];
            if (nodeEntry && nodeEntry.type === "file") return nodeEntry.content || "";
            const real = actual(path);
            if (Object.prototype.hasOwnProperty.call(world.files, real)) return world.files[real];
            return null;
        }

        function entries(path, showHidden = false) {
            const provider = providerFor(path);
            if (provider) {
                const listed = provider.list(path) || [];
                return listed
                    .filter((entry) => showHidden || !entry.hidden)
                    .sort((a, b) => a.name.localeCompare(b.name));
            }
            const state = getState();
            const real = actual(path);
            const reveals = state.reveals || {};
            const base = world.directories[real] || [];
            const result = [];
            for (const entry of base) {
                // A hidden room the player has unlocked is shown un-dotted and visible,
                // matching the bash treasure that renames `.chapel` -> `chapel`.
                if (entry.hidden && reveals[`${path}/${entry.name.replace(/^\./, "")}`.replace(/\/+/g, "/")]) {
                    result.push({ name: entry.name.replace(/^\./, ""), type: entry.type, hidden: false });
                } else if (showHidden || !entry.hidden) {
                    result.push({ ...entry });
                }
            }
            for (const [nodePath, nodeEntry] of Object.entries(state.userNodes)) {
                if (parentPath(nodePath) !== path) continue;
                const name = basename(nodePath);
                if (!showHidden && name.startsWith(".")) continue;
                if (!result.some((entry) => entry.name === name)) {
                    result.push({ name, type: nodeEntry.type, hidden: name.startsWith(".") });
                }
            }
            // Provider mounts appear as directories in their parent's listing.
            for (const mount of providers) {
                if (parentPath(mount.prefix) !== path) continue;
                const name = basename(mount.prefix);
                if (!showHidden && name.startsWith(".")) continue;
                if (!result.some((entry) => entry.name === name)) {
                    result.push({ name, type: "dir", hidden: name.startsWith(".") });
                }
            }
            return result.sort((a, b) => a.name.localeCompare(b.name));
        }

        function roomMeta(path) {
            return (world.rooms || {})[actual(path)] || {};
        }

        // Locate a hidden directory by logical name (e.g. "chapel"): returns
        // { visiblePath, realPath } for the first world directory containing a
        // hidden `.name` entry, or null. Pure — recording the reveal is the
        // caller's job (it lives in state).
        function findHiddenDir(name) {
            const dotName = `.${name}`;
            for (const [dirPath, list] of Object.entries(world.directories)) {
                if (!Array.isArray(list) || !list.some((e) => e.name === dotName && e.hidden)) continue;
                return {
                    visiblePath: `${dirPath}/${name}`.replace(/\/+/g, "/"),
                    realPath: `${dirPath}/${dotName}`.replace(/\/+/g, "/"),
                };
            }
            return null;
        }

        return {
            world,
            resolve,
            parentPath,
            actual,
            basename,
            node,
            isDir,
            readFile,
            entries,
            roomMeta,
            findHiddenDir,
            addProvider,
            providerFor,
        };
    }

    return { createVfs };
});
