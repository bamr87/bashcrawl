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
    // here; the brandable content (fortune deck, banner art, figlet default)
    // comes from the Shell's uiText copy deck, so apps ship their own voice
    // while the framework stays neutral. Randomness goes through this.rng so
    // sessions can be deterministic.

    const ART = {
        cow: (msg) => {
            const m = String(msg || "Moo.");
            const top = " " + "_".repeat(m.length + 2);
            const mid = "< " + m + " >";
            const bot = " " + "-".repeat(m.length + 2);
            return [
                top,
                mid,
                bot,
                "        \\   ^__^",
                "         \\  (oo)\\_______",
                "            (__)\\       )\\/\\",
                "                ||----w |",
                "                ||     ||",
            ].join("\n");
        },
        sl: [
            "      ====        ________                ___________",
            "  _D _|  |_______/        \\__I_I_____===__|_________|",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|",
            "   /     |  |   H  |  |     |   |         ||_| |_||",
            "  |      |  |   H  |__--------------------| [___] |",
            "  | ________|___H__/__|_____/[][]~\\_______|       |",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__",
            "__/ =| o |=-O=====O=====O=====O \\ ____Y___________|__|",
            " |/-=|___|=    ||    ||    ||    |_____/~\\___/   ",
            "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/         ",
        ].join("\n"),
    };

    const commands = {
        fortune() {
            const deck = this.text("fortunes") || [];
            if (!deck.length) return [{ kind: "dim", text: "The fortune deck is empty." }];
            const text = deck[Math.floor(this.rng() * deck.length)];
            return [{ kind: "magic", text: `🥠  ${text}` }];
        },

        cowsay(args, stdin) {
            const msg = (args.length ? args.join(" ") : stdin) || "Moo.";
            return [{ kind: "art", text: ART.cow(msg) }];
        },

        figlet(args) {
            const text = args.join(" ") || this.text("figletDefault");
            const upper = text.toUpperCase();
            return [{ kind: "art", text: upper.split("").map((c) => c).join(" ") + "\n" + "=".repeat(upper.length * 2) }];
        },

        banner() {
            return [{ kind: "art", text: this.text("bannerArt") }];
        },

        sl() {
            return [{ kind: "art", text: ART.sl + "\n     (Sometimes typos take you for a ride. Try `ls`.)" }];
        },
    };

    const meta = {
        fortune: { summary: "a random adage", usage: "fortune" },
        cowsay: { summary: "an ASCII cow speaks", usage: "cowsay [TEXT]" },
        figlet: { summary: "spaced-out block letters", usage: "figlet [TEXT]" },
        banner: { summary: "the big startup banner", usage: "banner" },
        sl: { summary: "a train rolls by", usage: "sl" },
    };

    return { name: "flavour", commands, meta, ART };
});
