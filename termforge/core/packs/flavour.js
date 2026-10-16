(function (global, factory) {
    "use strict";
    const hasCjs = typeof module !== "undefined" && module.exports && typeof require === "function";
    const api = factory();
    if (hasCjs) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.packs = global.TermForge.packs || {};
        global.TermForge.packs.flavour = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge flavour pack — the classic terminal toys. The mechanics live
    // here; the brandable content comes from the app: words from the Shell's
    // uiText copy deck (fortune deck, figlet default), pictures from its ASCII
    // Motion art clips (banner, cow, sl — core/art.js holds neutral defaults),
    // so apps ship their own voice while the framework stays neutral. Randomness goes through this.rng so
    // sessions can be deterministic.

    // Speech bubble for cowsay; the cow itself is the `cow` art clip.
    function bubble(msg) {
        const m = String(msg || "Moo.");
        return [" " + "_".repeat(m.length + 2), "< " + m + " >", " " + "-".repeat(m.length + 2)].join("\n");
    }

    const commands = {
        fortune() {
            const deck = this.text("fortunes") || [];
            if (!deck.length) return [{ kind: "dim", text: "The fortune deck is empty." }];
            const text = deck[Math.floor(this.rng() * deck.length)];
            return [{ kind: "magic", text: `🥠  ${text}` }];
        },

        cowsay(args, stdin) {
            const msg = (args.length ? args.join(" ") : stdin) || "Moo.";
            return [{ kind: "art", text: `${bubble(msg)}\n${this.art("cow")}` }];
        },

        figlet(args) {
            const text = args.join(" ") || this.text("figletDefault");
            const upper = text.toUpperCase();
            return [{ kind: "art", text: upper.split("").map((c) => c).join(" ") + "\n" + "=".repeat(upper.length * 2) }];
        },

        banner() {
            return [{ kind: "art", text: this.art("banner") }];
        },

        sl() {
            return [{ kind: "art", text: this.art("sl") + "\n     (Sometimes typos take you for a ride. Try `ls`.)" }];
        },
    };

    const meta = {
        fortune: { summary: "a random adage", usage: "fortune" },
        cowsay: { summary: "an ASCII cow speaks", usage: "cowsay [TEXT]" },
        figlet: { summary: "spaced-out block letters", usage: "figlet [TEXT]" },
        banner: { summary: "the big startup banner", usage: "banner" },
        sl: { summary: "a train rolls by", usage: "sl" },
    };

    return { name: "flavour", commands, meta };
});
