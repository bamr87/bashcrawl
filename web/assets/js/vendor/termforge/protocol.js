(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.protocol = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge Line protocol — the universal output currency of the framework.
    //
    // Every command handler returns an array of Line records; every frontend
    // (DOM log, ANSI stream, test fixture) consumes the same records. The
    // normative contract lives in docs/schemas/terminal-protocol.v1.md.
    //
    //   { kind: <display class>, text: "may\ncontain\nnewlines" }
    //   { kind: "control", action: "clear" | "reset" | "levelup" }
    //
    // Consumers MUST pass through records whose kind they do not recognise
    // (future-proofing: new kinds are additive).

    const PROTOCOL_VERSION = "1.0";

    /** Display kinds, in rough severity/flavour order. @type {readonly string[]} */
    const KINDS = Object.freeze([
        "output",   // plain command output
        "error",    // failures ("command not found", damage taken)
        "success",  // positive results (quest complete, item gained)
        "info",     // neutral guidance
        "dim",      // de-emphasised side notes
        "magic",    // highlighted flavour (spells, XP)
        "art",      // preformatted ASCII art (rendered glowing/monospace)
        "banner",   // large headline text
        "control",  // no text: carries an action for the host
    ]);

    /** Host actions carried by control records. @type {readonly string[]} */
    const CONTROL_ACTIONS = Object.freeze([
        "clear",    // clear the visible log
        "reset",    // session state was replaced wholesale; hosts re-sync
        "levelup",  // celebratory fanfare (hosts may animate)
    ]);

    /** @typedef {{kind: string, text?: string, action?: string}} Line */

    /** Make a Line of any kind. @returns {Line} */
    function line(kind, text) {
        return { kind, text };
    }

    const output = (text) => line("output", text);
    const error = (text) => line("error", text);
    const success = (text) => line("success", text);
    const info = (text) => line("info", text);
    const dim = (text) => line("dim", text);
    const magic = (text) => line("magic", text);
    const art = (text) => line("art", text);
    const banner = (text) => line("banner", text);

    /** Make a control record. @returns {Line} */
    function control(action) {
        return { kind: "control", action };
    }

    /** @returns {boolean} true when the record is a control record */
    function isControl(record) {
        return Boolean(record) && record.kind === "control";
    }

    /**
     * Validate a single record against the protocol.
     * @returns {{ok: boolean, reason?: string}}
     */
    function validateLine(record) {
        if (!record || typeof record !== "object") {
            return { ok: false, reason: "record must be an object" };
        }
        if (typeof record.kind !== "string" || !record.kind) {
            return { ok: false, reason: "record.kind must be a non-empty string" };
        }
        if (record.kind === "control") {
            if (!CONTROL_ACTIONS.includes(record.action)) {
                return { ok: false, reason: `unknown control action: ${record.action}` };
            }
            return { ok: true };
        }
        if (record.text != null && typeof record.text !== "string") {
            return { ok: false, reason: "record.text must be a string when present" };
        }
        return { ok: true };
    }

    return {
        PROTOCOL_VERSION,
        KINDS,
        CONTROL_ACTIONS,
        line,
        output,
        error,
        success,
        info,
        dim,
        magic,
        art,
        banner,
        control,
        isControl,
        validateLine,
    };
});
