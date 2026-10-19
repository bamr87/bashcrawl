(function initPathfindPlugin(global) {
    "use strict";
    // ── Path-Finder ──────────────────────────────────────────────────────────
    // Gives the player a target room and lets them navigate there with REAL
    // cd/ls/pwd; counts cd "moves" and detects arrival. Practices the core
    // navigation skill (distinct from the recall-based Training Arena).
    //
    // A TermForge plugin (docs/schemas/plugin.v1.md). Functions run with
    // `this` = the game Runtime.

    // Reachable main-path destinations, in pick order.
    const DESTINATIONS = [
        "/entrance",
        "/entrance/cellar",
        "/entrance/cellar/armoury",
        "/entrance/cellar/armoury/chamber",
    ];

    function pathfind(args) {
        if (this.state.trainer && this.state.trainer.active) {
            return [{ kind: "error", text: "Finish or quit the Training Arena first (type 'quit')." }];
        }
        const sub = (args[0] || "").toLowerCase();
        const pf = this.state.pathfind;
        if (["quit", "stop", "abort", "q"].includes(sub)) {
            if (!pf || !pf.active) return [{ kind: "dim", text: "No journey in progress." }];
            const target = pf.targetTitle;
            this.state.pathfind = null;
            return [{ kind: "dim", text: `Journey to ${target} abandoned.` }];
        }
        if (pf && pf.active) {
            return [
                { kind: "magic", text: `🧭 Still seeking ${pf.targetTitle}  ·  ${pf.moves} move(s) so far` },
                { kind: "dim", text: "Use cd / ls / pwd to find it. 'pathfind quit' to abandon." },
            ];
        }
        // Pick a reachable main-path target that isn't the current room.
        const candidates = DESTINATIONS.filter((p) => this.isDir(p) && p !== this.state.cwd);
        if (!candidates.length) return [{ kind: "error", text: "No reachable destination right now." }];
        const target = candidates[Math.floor(this.rng() * candidates.length)];
        const targetTitle = (this.world.rooms[target] || {}).title || target;
        this.state.pathfind = { active: true, target, targetTitle, moves: 0 };
        return [
            { kind: "art", text: this.art("pathfind") },
            { kind: "info", text: `Find your way to ${targetTitle}.` },
            { kind: "dim", text: "Navigate with cd / ls / pwd. Fewer moves = more XP. 'pathfind quit' to abandon." },
        ];
    }

    function observe(line) {
        const pf = this.state.pathfind;
        const cmd = global.TermForge.parser.tokenize(line.trim())[0];
        if (cmd === "cd") pf.moves += 1;
        if (this.state.cwd !== pf.target) return [];
        // Arrived.
        const moves = pf.moves;
        const xp = Math.max(15, 45 - moves * 5);
        this.awardXp(xp, "pathfind");
        const title = pf.targetTitle;
        this.state.pathfind = null;
        this.state.flags.pathfind_done = true;
        const flair = moves <= 1 ? "  A direct route!" : moves <= 3 ? "  Swiftly done." : "";
        return [
            { kind: "success", text: `🧭 You reached ${title} in ${moves} move${moves === 1 ? "" : "s"}!  +${xp} XP${flair}` },
            { kind: "dim", text: "Type 'pathfind' to seek a new destination." },
        ];
    }

    const plugin = {
        id: "pathfind",
        name: "Path-Finder",
        version: "1.0.0",
        description: "Navigate to a target room in the fewest cd moves.",
        commands: { pathfind },
        meta: { pathfind: { summary: "navigate to a target room in the fewest cd moves", usage: "pathfind [quit]", group: "games" } },
        hooks: {
            // Path-Finder watches normal play: count moves, detect arrival.
            observePipeline(line) {
                return (this.state.pathfind && this.state.pathfind.active) ? observe.call(this, line) : [];
            },
        },
    };

    global.BashcrawlPlugins = global.BashcrawlPlugins || {};
    global.BashcrawlPlugins.pathfind = { plugin, pathfind, observe, DESTINATIONS };
})(typeof globalThis !== "undefined" ? globalThis : window);
