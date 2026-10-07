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
            this.previous = [];
            this.pinned = true;
            if (typeof el.addEventListener === "function") {
                el.addEventListener("scroll", () => {
                    this.pinned = el.scrollHeight - el.clientHeight - el.scrollTop <= 2;
                }, { passive: true });
            }
        }

        /** Append when possible; preserve scrollback when the reader scrolls up. */
        render(lines) {
            const pinned = this.pinned || !this.previous.length;
            const extendsPrevious = this.previous.length <= lines.length && this.previous.every((line, i) => line === lines[i]);
            const html = (items) => items.map((line) => `<span class="kind-${line.kind || "output"}">${escapeHtml(line.text)}</span>`).join("\n");
            if (extendsPrevious && typeof this.el.insertAdjacentHTML === "function") {
                const added = lines.slice(this.previous.length);
                if (added.length) this.el.insertAdjacentHTML("beforeend", (this.previous.length ? "\n" : "") + html(added));
            } else this.el.innerHTML = html(lines);
            this.previous = lines.slice();
            if (pinned) this.el.scrollTop = Math.max(0, this.el.scrollHeight - this.el.clientHeight);
        }

    }

    return { DomSink, escapeHtml };
});
