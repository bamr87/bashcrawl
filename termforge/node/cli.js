"use strict";
// Tiny argv parser + app resolver shared by the node hosts. Zero deps.

const path = require("node:path");

/**
 * Parse `--key value`, `--key=value`, boolean `--flag` and `--no-flag` args
 * against a defaults object (types inferred from the defaults).
 */
function parseArgs(argv, defaults) {
    const opts = { ...defaults };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (!arg.startsWith("--")) throw new Error(`unexpected argument: ${arg}`);
        let key = arg.slice(2);
        let value;
        const eq = key.indexOf("=");
        if (eq >= 0) {
            value = key.slice(eq + 1);
            key = key.slice(0, eq);
        }
        let negated = false;
        if (key.startsWith("no-") && typeof opts[camel(key.slice(3))] === "boolean") {
            key = key.slice(3);
            negated = true;
        }
        const prop = camel(key);
        if (!(prop in opts)) throw new Error(`unknown option: --${key}`);
        if (typeof opts[prop] === "boolean") {
            opts[prop] = !negated && (value === undefined ? true : value !== "false");
        } else {
            if (value === undefined) value = argv[++i];
            if (value === undefined) throw new Error(`--${key} needs a value`);
            opts[prop] = typeof defaults[prop] === "number" ? Number(value) : value;
        }
    }
    return opts;
}

function camel(key) {
    return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Resolve an app id or module path to its createApp factory.
 * Built-ins: "bashcrawl", "procwatch". Anything else is required as a path to
 * a module exporting createApp(options).
 */
function resolveApp(name, options = {}) {
    if (name === "bashcrawl") return require("../apps/bashcrawl.js").createApp(options);
    if (name === "procwatch") return require("../apps/procwatch/index.js").createApp(options);
    const mod = require(path.resolve(process.cwd(), name));
    if (typeof mod.createApp !== "function") {
        throw new Error(`${name} does not export createApp(options)`);
    }
    return mod.createApp(options);
}

module.exports = { parseArgs, resolveApp };
