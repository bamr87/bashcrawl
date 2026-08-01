(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.sinks = global.TermForge.sinks || {};
        global.TermForge.sinks.AnsiSink = api.AnsiSink;
        global.TermForge.sinks.ANSI_STYLES = api.ANSI_STYLES;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge ANSI sink — streams TerminalView lines as SGR-colored text for
    // TTY and telnet hosts. Pure string transform: the host supplies write().
    // Kind -> SGR mapping mirrors the web theme's .kind-* palette.

    const ESC = "\u001b";

    const ANSI_STYLES = Object.freeze({
        output: "",
        error: "31",       // red
        success: "32",     // green
        info: "36",        // cyan
        dim: "2",          // faint
        magic: "35",       // magenta
        art: "33",         // yellow
        banner: "1;36",    // bold cyan
        control: "",
    });

    class AnsiSink {
        /**
         * @param {object} options
         * @param {(chunk: string) => void} options.write  receives painted text
         * @param {boolean} [options.color]    emit SGR codes (default true)
         * @param {string}  [options.newline]  line ending (default "\r\n")
         */
        constructor(options) {
            const opts = options || {};
            if (typeof opts.write !== "function") throw new Error("AnsiSink requires options.write");
            this._write = opts.write;
            this.color = opts.color !== false;
            this.newline = opts.newline || "\r\n";
        }

        /** Paint one line record to a string (no newline). */
        paint(line) {
            const text = line.text || "";
            if (!this.color) return text;
            const code = ANSI_STYLES[line.kind || "output"] || "";
            return code ? `${ESC}[${code}m${text}${ESC}[0m` : text;
        }

        /** Append-only delta write (TerminalView.appendLine streams here). */
        write(lines) {
            for (const line of lines) {
                this._write(this.paint(line) + this.newline);
            }
        }
    }

    return { AnsiSink, ANSI_STYLES };
});
