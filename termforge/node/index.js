"use strict";
// TermForge framework entry point for node.
//
// Assembles the same namespace shape the browser gets from the classic-script
// load order, so node hosts (and classic files like the bashcrawl runtime,
// which reads global.TermForge at load time) work unchanged under require().

const dom = require("../core/sinks/dom.js");
const ansi = require("../core/sinks/ansi.js");
const shell = require("../core/shell.js");

const TermForge = {
    protocol: require("../core/protocol.js"),
    parser: require("../core/parser.js"),
    state: require("../core/state.js"),
    vfs: require("../core/vfs.js"),
    hooks: require("../core/hooks.js"),
    registry: require("../core/registry.js"),
    shell,
    Shell: shell.Shell,
    packs: {
        posix: require("../core/packs/posix.js"),
        flavour: require("../core/packs/flavour.js"),
    },
    view: require("../core/view.js"),
    sinks: { ...dom, ...ansi },
    input: require("../core/input.js"),
};

module.exports = TermForge;
