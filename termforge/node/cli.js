"use strict";
// Host CLI plumbing: node's standard util.parseArgs (with --no-* negation)
// against a defaults object, plus app resolution through the registry
// (termforge/apps/registry.js). Zero deps.

const path = require("node:path");
const { parseArgs: nodeParseArgs } = require("node:util");
const registry = require("../apps/registry.js");

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
 * Resolve an app id (termforge/apps/registry.js) or a module path to a
 * built app. Anything that is not a registered id is required as a path to a
 * module exporting createApp(options).
 */
function resolveApp(name, options = {}) {
    if (registry.get(name)) return registry.createApp(name, options);
    const mod = require(path.resolve(process.cwd(), name));
    if (typeof mod.createApp !== "function") {
        throw new Error(`${name} does not export createApp(options)`);
    }
    return mod.createApp(options);
}

/** `--app list`: print the registry and report that the host should exit. */
function listAppsIfAsked(appName, write = (text) => process.stdout.write(text)) {
    if (appName !== "list") return false;
    write(`TermForge apps (--app ID, or --app ./path/to/app.js):\n${registry.describe()}\n`);
    return true;
}

module.exports = { parseArgs, resolveApp, listAppsIfAsked };
