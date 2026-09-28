(function (global, factory) {
    "use strict";
    const input = typeof module !== "undefined" && module.exports ? require("./input.js") : global.TermForge.input;
    const api = factory(input);
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else {
        global.TermForge = global.TermForge || {};
        global.TermForge.session = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (input) {
    "use strict";

    // Hosts supply transport, painting and storage. This controller owns the
    // common command lifecycle, including controls that replace the runtime.
    class SessionController {
        constructor(session, options) {
            const opts = options || {};
            this.session = session;
            this.view = opts.view;
            this.maxLine = opts.maxLine || session.maxLine || 4096;
            this.persistence = opts.persistence || session.persistence || null;
            this.capabilities = opts.capabilities || session.capabilities || {};
            this.onState = opts.onState || (() => {});
            this.onPage = opts.onPage || (() => {});
            this.closed = false;
            const onControl = this.view.onControl;
            this.view.onControl = (action, record) => {
                if (action === "page") {
                    this.onPage(record.text || "");
                    return false;
                }
                if (typeof session.onControl === "function") session.onControl(action, record);
                const keep = onControl(action, record);
                this.configure();
                return keep || action === "reset";
            };
            this.configure();
        }

        configure() {
            this.session.runtime.capabilities = this.capabilities;
            this.session.runtime.persistence = this.persistence;
        }

        execute(line, options) {
            if (this.closed) return [];
            const text = String(line || "");
            const limit = typeof this.maxLine === "function" ? this.maxLine(text) : this.maxLine;
            if (text.length > limit) {
                const outputs = [{ kind: "error", text: `line too long (max ${limit} chars)` }];
                this.view.appendOutputs(outputs);
                return outputs;
            }
            const state = this.session.runtime.state;
            const label = this.session.commandLabel ? this.session.commandLabel(text) : text;
            if (text.trim()) {
                if (state.history[state.history.length - 1] !== label) state.history.push(label);
                if (state.history.length > 1000) state.history.splice(0, state.history.length - 1000);
                state.historyIndex = state.history.length;
            }
            if (options && options.echo) this.view.appendLine("dim", `${this.session.runtime.promptLabel()} ${label}`);
            let outputs;
            try {
                outputs = typeof this.session.handleLine === "function"
                    ? this.session.handleLine(text) : this.session.runtime.execute(text);
            } catch (err) {
                outputs = [{ kind: "error", text: `terminal: ${err.message}` }];
            }
            this.view.appendOutputs(outputs);
            this.persist();
            this.onState(this.session.runtime.state);
            return outputs;
        }

        persist() {
            if (!this.persistence) return;
            try {
                if (this.persistence.save(this.session.runtime.state) === false) throw new Error("storage unavailable");
            } catch (err) {
                this.view.appendLine("error", `Could not save progress: ${err.message}`);
            }
        }

        close() { this.closed = true; }
    }

    class Pager {
        constructor(text) {
            this.lines = String(text).split("\n");
            this.offset = 0;
            this.height = 20;
            this.width = 80;
        }
        rows() {
            const result = [];
            for (const line of this.lines) {
                let row = "";
                let used = 0;
                for (const ch of line.replace(/\t/g, "    ")) {
                    const width = input.displayWidth(ch);
                    if (used + width > this.width && row) { result.push(row); row = ""; used = 0; }
                    row += width > this.width ? "?" : ch;
                    used += Math.min(width, this.width);
                }
                result.push(row);
            }
            return result;
        }
        resize(width, height) {
            this.width = Math.max(1, width);
            this.height = Math.max(1, height);
            this.move(0);
        }
        move(delta) {
            this.offset = Math.max(0, Math.min(Math.max(0, this.rows().length - this.height), this.offset + delta));
        }
        page() { return this.rows().slice(this.offset, this.offset + this.height); }
        label() {
            return `${this.offset + 1}-${Math.min(this.rows().length, this.offset + this.height)}/${this.rows().length} · Space/PgDn next · b/PgUp back · q quit`;
        }
        feed(ev) {
            if (ev.type === "interrupt" || (ev.type === "char" && ev.ch === "q")) return false;
            if (ev.type === "home") this.offset = 0;
            else if (ev.type === "end") this.move(Infinity);
            else if (ev.type === "histPrev") this.move(-1);
            else if (ev.type === "histNext" || ev.type === "submit") this.move(1);
            else if (ev.type === "page") this.move(ev.dir === "up" ? -this.height : this.height);
            else if (ev.type === "char" && ev.ch === " ") this.move(this.height);
            else if (ev.type === "char" && ev.ch === "b") this.move(-this.height);
            return true;
        }
    }
    return { SessionController, Pager };
});
