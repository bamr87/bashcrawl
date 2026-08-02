"use strict";
// Host CLI plumbing: node's standard util.parseArgs (with --no-* negation)
// against a defaults object, plus the app registry. Zero deps.

const path = require("node:path");
const { parseArgs: nodeParseArgs } = require("node:util");

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Parse `--key value`, `--key=value`, boolean `--flag` / `--no-flag` args
 * against a defaults object. Types are inferred from the defaults (booleans
 * stay booleans, numbers are coerced); option names are the kebab-case form
 * of the defaults' camelCase keys. Unknown options throw (util.parseArgs
 * strict mode).
 */
function parseArgs(argv, defaults) {
    const options = {};
    for (const key of Object.keys(defaults)) {
        options[kebab(key)] = { type: typeof defaults[key] === "boolean" ? "boolean" : "string" };
    }
    const { values } = nodeParseArgs({ args: argv, options, allowNegative: true, strict: true });
    const opts = { ...defaults };
    for (const key of Object.keys(defaults)) {
        const value = values[kebab(key)];
        if (value === undefined) continue;
        opts[key] = typeof defaults[key] === "number" ? Number(value) : value;
    }
    return opts;
}

/**
 * Resolve an app id or module path to its createApp factory.
 * Built-ins: "bashcrawl", "procwatch", "agentwatch". Anything else is
 * required as a path to a module exporting createApp(options).
 */
function resolveApp(name, options = {}) {
    if (name === "bashcrawl") return require("../apps/bashcrawl.js").createApp(options);
    if (name === "procwatch") return require("../apps/procwatch/index.js").createApp(options);
    if (name === "agentwatch") return require("../apps/agentwatch/index.js").createApp(options);
    const mod = require(path.resolve(process.cwd(), name));
    if (typeof mod.createApp !== "function") {
        throw new Error(`${name} does not export createApp(options)`);
    }
    return mod.createApp(options);
}

module.exports = { parseArgs, resolveApp };
