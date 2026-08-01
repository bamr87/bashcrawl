(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.sinks = global.TermForge.sinks || {};
        global.TermForge.sinks.DomSink = api.DomSink;
        global.TermForge.sinks.escapeHtml = api.escapeHtml;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge DOM sink — paints a TerminalView buffer into a <pre> log
    // element as one span per line, kind mapped to a .kind-* CSS class. The
    // output format is byte-identical to the historical story/arcade
    // renderers, and this file owns the one canonical escapeHtml.

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    class DomSink {
        /** @param {HTMLElement} el  the <pre> log container */
        constructor(el) {
            this.el = el;
        }

        /** Full repaint + pin scroll to the bottom. */
        render(lines) {
            this.el.innerHTML = lines
                .map((line) => `<span class="kind-${line.kind || "output"}">${escapeHtml(line.text)}</span>`)
                .join("\n");
            this.el.scrollTop = Math.max(0, this.el.scrollHeight - this.el.clientHeight);
        }
    }

    return { DomSink, escapeHtml };
});
