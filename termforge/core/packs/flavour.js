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
    // TermForge flavour pack — the classic terminal toys. ASCII art and
    // fortunes extracted verbatim from the bashcrawl web emulator; the random
    // draw goes through this.rng so sessions can be deterministic.

    const ART = {
        banner: [
            "       ╔════════════════════════════════════════════════════╗",
            "       ║   ____            __                       __      ║",
            "       ║  / __ )___ ______/ /_  ______________ ___ / /      ║",
            "       ║ / __  / __ `/ ___/ __ \\/ ___/ ___/ __ `__ \\/ /      ║",
            "       ║/ /_/ / /_/ (__  ) / / / /__/ /  / / / / / / /__    ║",
            "       ║\\____/\\__,_/____/_/ /_/\\___/_/  /_/ /_/ /_/____/    ║",
            "       ║                                                    ║",
            "       ║       Type  pwd  to begin the descent. F1 for help ║",
            "       ╚════════════════════════════════════════════════════╝",
        ].join("\n"),
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
        sparkle: [
            "      .   *  .   .  *  .   *",
            "    *  ✦  .   *  ✧   .  *  ✦   ✧",
            "      ✦  ✧ ✦  Q U E S T  ✦ ✧ ✦",
            "    *      C O M P L E T E      *",
            "      ✧  *   .  ✦   . *  ✧   ✦",
        ].join("\n"),
        skull: [
            "        _____",
            "       /     \\",
            "      | () () |",
            "       \\  ^  /",
            "        |||||",
            "        |||||",
        ].join("\n"),
        treasure: [
            "       _.--\"\"--._",
            "      / _      _ \\",
            "     | (o)____(o) |",
            "      \\ '--.__,--' /",
            "       `-._____.-'",
        ].join("\n"),
    };

    const FORTUNES = [
        "In the catacombs, you have ZERO bytes of fear.",
        "chmod 777 your dreams. Permissions matter.",
        "/dev/null is full. Please try again.",
        "An unhandled exception walks into a bar. The bar pretends nothing happened.",
        "Cellar mages prefer ls -F over divination.",
        "Warning: pipes are not for plumbers in this realm.",
        "When in doubt, cd .. and try again.",
        "If you can name it, you can grep it.",
        "The shell is patient. The shell is kind. The shell still won't run that typo.",
        "May your prompts be short and your scripts be sourced.",
    ];

    const commands = {
        fortune() {
            const text = FORTUNES[Math.floor(this.rng() * FORTUNES.length)];
            return [{ kind: "magic", text: `🥠  ${text}` }];
        },

        cowsay(args, stdin) {
            const msg = (args.length ? args.join(" ") : stdin) || "Moo.";
            return [{ kind: "art", text: ART.cow(msg) }];
        },

        figlet(args) {
            const text = args.join(" ") || "BASHCRAWL";
            const upper = text.toUpperCase();
            return [{ kind: "art", text: upper.split("").map((c) => c).join(" ") + "\n" + "=".repeat(upper.length * 2) }];
        },

        banner() {
            return [{ kind: "art", text: ART.banner }];
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

    return { name: "flavour", commands, meta, ART, FORTUNES };
});
