(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.plugin = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge plugins — the unit of extension above a command pack.
    //
    // A pack is just commands. A plugin is a FEATURE: commands plus the hook
    // subscribers, event sinks, VFS mounts, copy-deck defaults and state slice
    // that make them work. Installing one is the whole registration, the way
    // a bashOS app is one AppSpec entry and a bashOS command is one markdown
    // file: `shell.use(plugin)` wires every surface (web, TTY, telnet) at once.
    // Normative contract: docs/schemas/plugin.v1.md.
    //
    //   {
    //     id: "lesson-tools",                 // required, kebab-case, unique per shell
    //     name, version, description,         // shown by the `plugins` command
    //     requires: ["other-id"],             // installed first or install fails
    //     commands: { name(args, stdin) {} }, // unbound, fn.call(shell, args, stdin)
    //     meta: { name: { summary, usage, group } },
    //     hooks: { postCommand(cmd, args, stdin, out) {} },   // `this` = shell
    //     events: { "progress.xp"(event, shell) {} },         // bus sinks
    //     providers: [provider] | (shell) => [provider],      // read-only mounts
    //     uiText: { key: "default copy" },    // under the app's own deck
    //     state: { key: "slice", defaults: () => ({}) },      // shell.pluginState(id)
    //     setup(shell, options) { return teardown?; },
    //   }
    //
    // Plugins never see the host: everything they emit is Line records and
    // typed events, which every surface already renders.

    const ID_RE = /^[a-z][a-z0-9-]*$/;
    const KNOWN_KEYS = new Set([
        "id", "name", "version", "description", "requires", "commands", "meta",
        "hooks", "events", "providers", "uiText", "state", "setup",
    ]);

    /** Structural check. Returns error strings (empty = valid). */
    function validatePlugin(plugin) {
        const errors = [];
        if (!plugin || typeof plugin !== "object") return ["plugin must be an object"];
        const at = `plugin ${plugin.id || "(no id)"}`;
        if (typeof plugin.id !== "string" || !ID_RE.test(plugin.id)) errors.push(`${at}: id must be kebab-case`);
        for (const key of Object.keys(plugin)) {
            if (!KNOWN_KEYS.has(key)) errors.push(`${at}: unknown key '${key}'`);
        }
        if (plugin.requires != null && (!Array.isArray(plugin.requires) || plugin.requires.some((r) => typeof r !== "string"))) {
            errors.push(`${at}: requires must be a list of plugin ids`);
        }
        for (const [field, label] of [["commands", "command"], ["hooks", "hook"], ["events", "event sink"]]) {
            const map = plugin[field];
            if (map == null) continue;
            if (typeof map !== "object" || Array.isArray(map)) {
                errors.push(`${at}: ${field} must be an object`);
                continue;
            }
            for (const [name, fn] of Object.entries(map)) {
                if (typeof fn !== "function") errors.push(`${at}: ${label} '${name}' must be a function`);
            }
        }
        if (plugin.state != null) {
            const s = plugin.state;
            if (!s || typeof s.key !== "string" || !s.key || typeof s.defaults !== "function") {
                errors.push(`${at}: state needs { key, defaults() }`);
            }
        }
        if (plugin.setup != null && typeof plugin.setup !== "function") errors.push(`${at}: setup must be a function`);
        return errors;
    }

    /**
     * Install a plugin into a shell. Returns a handle { id, uninstall() } that
     * removes exactly what this install added (commands it registered, hook
     * and event subscriptions, its setup teardown). Throws on an invalid
     * plugin, a duplicate id, or a missing requirement.
     */
    function installPlugin(shell, plugin, options) {
        const errors = validatePlugin(plugin);
        if (errors.length) throw new Error(errors.join("; "));
        if (!shell.plugins) shell.plugins = new Map();
        if (shell.plugins.has(plugin.id)) throw new Error(`plugin ${plugin.id} is already installed`);
        for (const req of plugin.requires || []) {
            if (!shell.plugins.has(req)) throw new Error(`plugin ${plugin.id} requires ${req}`);
        }
        const undo = [];

        // Commands: a command the app's manifest already maps to the same
        // function is left alone (the flagship lists plugin commands in its
        // static handlers literal); anything new is registered and removed on
        // uninstall.
        for (const [name, fn] of Object.entries(plugin.commands || {})) {
            if (shell.handlers[name] === fn) continue;
            const previous = Object.prototype.hasOwnProperty.call(shell.handlers, name) ? shell.handlers[name] : undefined;
            shell.handlers[name] = fn;
            undo.push(() => {
                if (shell.handlers[name] !== fn) return;
                if (previous === undefined) delete shell.handlers[name];
                else shell.handlers[name] = previous;
            });
        }
        if (!shell.commandMeta) shell.commandMeta = {};
        for (const [name, meta] of Object.entries(plugin.meta || {})) {
            if (!shell.commandMeta[name]) {
                shell.commandMeta[name] = { ...meta, plugin: plugin.id };
                undo.push(() => { if (shell.commandMeta[name] && shell.commandMeta[name].plugin === plugin.id) delete shell.commandMeta[name]; });
            }
        }
        for (const [name, fn] of Object.entries(plugin.hooks || {})) {
            undo.push(shell.hooks.on(name, (...args) => fn.apply(shell, args)));
        }
        if (shell.events) {
            for (const [type, fn] of Object.entries(plugin.events || {})) {
                undo.push(shell.events.on(type, (event) => fn.call(shell, event, shell)));
            }
        }
        for (const [key, value] of Object.entries(plugin.uiText || {})) {
            if (!Object.prototype.hasOwnProperty.call(shell.uiText, key)) shell.uiText[key] = value;
        }
        const providers = typeof plugin.providers === "function" ? plugin.providers(shell) : plugin.providers;
        for (const provider of providers || []) shell.vfs.addProvider(provider);

        const record = { plugin, options: options || {} };
        shell.plugins.set(plugin.id, record);
        if (plugin.setup) {
            const teardown = plugin.setup(shell, record.options);
            if (typeof teardown === "function") undo.push(teardown);
        }
        return {
            id: plugin.id,
            uninstall() {
                while (undo.length) undo.pop()();
                shell.plugins.delete(plugin.id);
            },
        };
    }

    /**
     * A plugin's state slice, created (or topped up with fields added since a
     * save was written) from its defaults on first use. Works across a state
     * swap (reset, save import) because it re-reads shell.state every call.
     */
    function pluginState(shell, id) {
        const record = shell.plugins && shell.plugins.get(id);
        const spec = record && record.plugin.state;
        if (!spec) return null;
        const state = shell.state;
        const current = state[spec.key];
        const defaults = spec.defaults();
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            state[spec.key] = defaults;
        } else {
            for (const [field, value] of Object.entries(defaults)) {
                if (!Object.prototype.hasOwnProperty.call(current, field)) current[field] = value;
            }
        }
        return state[spec.key];
    }

    /** Rows for a `plugins` listing: [{ id, name, version, description, commands }]. */
    function listPlugins(shell) {
        return Array.from((shell.plugins || new Map()).values()).map(({ plugin }) => ({
            id: plugin.id,
            name: plugin.name || plugin.id,
            version: plugin.version || "",
            description: plugin.description || "",
            commands: Object.keys(plugin.commands || {}),
        }));
    }

    return { validatePlugin, installPlugin, pluginState, listPlugins };
});
