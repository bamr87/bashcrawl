(function (global) {
    "use strict";
    // Bashcrawl HUD presenter — the ONE place game state becomes presentation
    // data. Both renderers consume these models:
    //
    //   web/assets/js/game.js        paints them as DOM panels + CSS effects
    //   termforge/node/host-tty.js   paints them as ANSI panels (tui.js)
    //
    // Everything here is plain data out (strings, arrays, {kind,text} lines) —
    // no DOM, no ANSI, no timers. Models read a live Runtime instance; the
    // catalogs (ranks, achievements) come from global.BashcrawlRuntime, looked
    // up at call time so load order only matters relative to game/host code.
    //
    // Loaded exactly like runtime.js: classic <script> in the browser,
    // require()'d for its global side effect by termforge/apps/bashcrawl.js.

    // Optional side objectives, grounded in real, checkable state: each hidden
    // area is "done" once the player has revealed it (reveals map a visible
    // path like /entrance/chapel to its dotted source).
    const SIDE_QUESTS = [
        { key: "chapel", name: "The Hidden Chapel", hint: "Search for a dotfile and unlock the chapel with grep." },
        { key: "vault", name: "The Sealed Vault", hint: "Use variables to breach the vault." },
        { key: "scrap", name: "The Scrapyard", hint: "Find the scrap and master symbolic links." },
        { key: "rift", name: "The Rift", hint: "Tear open the rift for advanced trials." },
    ];

    // Box-safe ASCII mascot per area (shared ambience: web room panel and the
    // terminal sidebar draw the same vignette).
    const ROOM_VIGNETTES = {
        entrance: [
            "  (  )      (  )   ",
            "  )(   /\\   )(     ",
            "  ||  /  \\  ||     ",
            " _||_/    \\_||_    ",
            "[==||      ||==]   ",
            "   ''      ''      ",
        ],
        cellar: [
            "   (~)        (~)  ",
            "  .[ ].      .[ ]. ",
            "  | | |      | | | ",
            "  | | |      | | | ",
            " _|_|_|_    _|_|_|_",
            " '-----'    '-----'",
        ],
        graveyard: [
            " .---.   __   .---.",
            " | + |  /  \\  | R |",
            " |   | |    | |   |",
            " *web* |    | ~~~~ ",
            "_|___|_|____|_|___|",
            "  ~~~     ~~~   ~~~",
        ],
        vault: [
            "      /\\          ",
            "     /  \\   /\\    ",
            "    / /\\ \\ /  \\   ",
            "    \\ \\/ / \\  /   ",
            "     \\  /   \\/    ",
            "      \\/  *  .    ",
        ],
        rift: [
            "    . * .   .  *   ",
            "   *  .-~~~-.  .   ",
            "  .  /  _    \\ *   ",
            "  * |  ( o )  | .  ",
            "   . \\  ~-~  / *   ",
            "    * '-...-'  .   ",
        ],
        deep: [
            "    *  .   *   .   ",
            "  .   .-~~~~-.  *  ",
            "  *  / shadow \\ .  ",
            "   . \\        / *  ",
            "  .   '------'  .  ",
        ],
    };

    function vignetteKeyForRoom(actualPath, cwd) {
        const p = String(actualPath || cwd || "");
        if (p.includes("/.rift") || p.includes("/rift")) return "rift";
        if (p.includes("/.vault") || p.includes("/vault")) return "vault";
        if (p.includes("/graveyard") || p.includes("/.chapel") || p.includes("/chapel")) return "graveyard";
        if (p.includes("/cellar") || p.includes("/armoury") || p.includes("/chamber")) return "cellar";
        if (p === "/entrance" || p.endsWith("/entrance") || p.includes("/workshop")) return "entrance";
        return "deep";
    }

    function roomVignette(runtime) {
        const actual = runtime.actual ? runtime.actual(runtime.state.cwd) : runtime.state.cwd;
        const key = vignetteKeyForRoom(actual, runtime.state.cwd);
        return { key, art: ROOM_VIGNETTES[key] || ROOM_VIGNETTES.deep };
    }

    function bar(value, max, width) {
        const w = width || 10;
        const clamped = Math.max(0, Math.min(max, value));
        const filled = max > 0 ? Math.round((clamped / max) * w) : 0;
        return "█".repeat(filled) + "░".repeat(w - filled);
    }

    function rankFor(xp) {
        const ranks = global.BashcrawlRuntime.ARENA_RANKS;
        return ranks.filter((r) => (xp || 0) >= r.min).pop() || ranks[0];
    }

    // Level curve mirrors the in-game `xp` command: 200 XP per level.
    function levelFor(xp) {
        const total = xp || 0;
        return { level: Math.max(1, 1 + Math.floor(total / 200)), into: total % 200, span: 200 };
    }

    // Record the current room (and its ancestors, so the trunk is always solid)
    // into the persisted visited-set that drives the map's fog of war.
    function ensureVisited(runtime) {
        const state = runtime.state;
        const visited = state.visited || (state.visited = []);
        const seen = new Set(visited);
        const parts = state.cwd.split("/").filter(Boolean);
        let acc = "";
        for (const part of parts) {
            acc += "/" + part;
            if (!seen.has(acc)) { visited.push(acc); seen.add(acc); }
        }
    }

    // Scalar diff-model: cheap to take before/after a command, feeds diffEvents.
    function snapshot(runtime) {
        const s = runtime.state;
        return {
            xp: s.xp,
            hp: s.hp,
            completed: s.completedQuestIds.length,
            currentQuestId: s.currentQuestId,
            inventory: s.inventory.slice(),
            achievements: (s.achievements || []).length,
            rankIndex: s.rankIndex || 0,
            cwd: s.cwd,
        };
    }

    // Semantic before/after transitions. Both renderers key their juice off
    // this: the web maps types to CSS effects, the terminal to toasts/flashes.
    function diffEvents(prev, next) {
        const events = [];
        if (next.completed > prev.completed) {
            events.push({ type: "quest", text: "✦ QUEST COMPLETE ✦" });
        }
        if (next.hp < prev.hp) {
            events.push({ type: "damage", amount: prev.hp - next.hp, text: `−${prev.hp - next.hp} HP` });
        }
        if (next.xp > prev.xp) {
            events.push({ type: "xp", amount: next.xp - prev.xp, text: `+${next.xp - prev.xp} XP` });
        }
        if (next.inventory.length > prev.inventory.length) {
            const gained = next.inventory.slice(prev.inventory.length);
            events.push({ type: "item", items: gained, text: `💰 ${gained.join(", ")}` });
        }
        if (next.rankIndex > prev.rankIndex) {
            events.push({ type: "levelup", text: `★ ${rankFor(next.xp).title}` });
        }
        return events;
    }

    function sideQuestDone(runtime, key) {
        const reveals = runtime.state.reveals || {};
        return Object.keys(reveals).some((path) => path.endsWith("/" + key));
    }

    function questStatus(runtime, quest) {
        if (runtime.state.completedQuestIds.includes(quest.id)) return "done";
        if (quest.id === runtime.state.currentQuestId) return "active";
        return "locked";
    }

    // The quest panel model: at-a-glance current quest + the full main/side log.
    function questModel(runtime) {
        const current = runtime.quests[runtime.state.currentQuestId] || null;
        const rows = runtime.quests.map((quest) => {
            const status = questStatus(runtime, quest);
            return {
                status,
                icon: status === "done" ? "✅" : status === "active" ? "▶" : "🔒",
                title: quest.title,
            };
        });
        const side = SIDE_QUESTS.map((s) => {
            const done = sideQuestDone(runtime, s.key);
            return { key: s.key, name: s.name, hint: s.hint, done, icon: done ? "✅" : "○" };
        });
        return {
            current: current ? { title: current.title, objective: current.objective } : null,
            mainDone: runtime.state.completedQuestIds.length,
            mainTotal: runtime.quests.length,
            rows,
            side,
            sideDone: side.filter((s) => s.done).length,
            xp: runtime.state.xp,
        };
    }

    function inventoryModel(runtime) {
        const hp = Math.max(0, Math.min(100, runtime.state.hp));
        return { hp, hpMax: 100, hpBar: bar(hp, 100, 10), items: (runtime.state.inventory || []).slice() };
    }

    function heroModel(runtime) {
        const xp = runtime.state.xp || 0;
        const level = levelFor(xp);
        return {
            rank: rankFor(xp).title,
            xp,
            level: level.level,
            into: level.into,
            span: level.span,
            xpBar: bar(level.into, level.span, 10),
            badges: (runtime.state.achievements || []).length,
            badgeTotal: global.BashcrawlRuntime.ACHIEVEMENTS.length,
        };
    }

    function roomModel(runtime) {
        const meta = runtime.currentRoomMeta();
        const vignette = roomVignette(runtime);
        const entries = runtime.entries(runtime.state.cwd, false).map((entry) => ({
            name: entry.name,
            type: entry.type,
            icon: entry.type === "dir" ? "📁" : entry.type === "exec" ? "⚡" : "📄",
            marker: entry.type === "dir" ? "/" : entry.type === "exec" ? "*" : "",
        }));
        return { title: meta.title || runtime.state.cwd, path: runtime.state.cwd, vignette, entries };
    }

    // ── Fog-of-war dungeon map ──────────────────────────────────────────────
    // Built live from the runtime filesystem: only visited rooms and the doors
    // leading off them (their direct dir-children) are drawn, so the map grows
    // organically and never reveals undiscovered or still-hidden areas.
    function mapJoin(parent, name) {
        return (parent === "/" ? "" : parent) + "/" + name;
    }

    function dirChildren(runtime, path) {
        if (!runtime.isDir(path)) return [];
        return runtime.entries(path, false)
            .filter((entry) => entry.type === "dir")
            .map((entry) => mapJoin(path, entry.name));
    }

    // Rows: {prefix, name, path, here, seen}. `seen` false = frontier room the
    // player has glimpsed (a visible door) but not entered — render as fog.
    function mapModel(runtime) {
        const root = (runtime.world && runtime.world.root) || "/entrance";
        const visited = new Set(runtime.state.visited || []);
        visited.add(runtime.state.cwd);
        const discovered = new Set([root]);
        for (const node of visited) {
            discovered.add(node);
            for (const child of dirChildren(runtime, node)) discovered.add(child);
        }
        const rows = [];
        const node = (path, prefix) => ({
            prefix,
            path,
            name: (runtime.basename(path) || path.replace(/^\//, "")) + "/",
            here: path === runtime.state.cwd,
            seen: visited.has(path),
        });
        rows.push(node(root, ""));
        const build = (path, prefix) => {
            const kids = dirChildren(runtime, path).filter((child) => discovered.has(child));
            kids.forEach((child, i) => {
                const last = i === kids.length - 1;
                rows.push(node(child, prefix + (last ? "└── " : "├── ")));
                build(child, prefix + (last ? "    " : "│   "));
            });
        };
        build(root, "");
        return { rows, explored: visited.size };
    }

    // ── Terminal panel spec ─────────────────────────────────────────────────
    // Pre-formatted {title, lines:[{kind,text}]} panels for byte-stream hosts
    // (tui.js draws them verbatim). Kinds reuse the log palette so the sidebar
    // matches the web theme's colors.
    function truncate(text, width) {
        const chars = Array.from(String(text));
        return chars.length > width ? chars.slice(0, Math.max(0, width - 1)).join("") + "…" : text;
    }

    function panels(runtime, options) {
        const width = (options && options.width) || 30;
        const hero = heroModel(runtime);
        const inv = inventoryModel(runtime);
        const quest = questModel(runtime);
        const room = roomModel(runtime);
        const map = mapModel(runtime);

        const heroLines = [
            { kind: "magic", text: truncate(hero.rank, width) },
            { kind: "info", text: `Lv ${hero.level}  ${hero.xpBar} ${hero.into}/${hero.span}` },
            { kind: "dim", text: `${hero.xp} XP · ${hero.badges}/${hero.badgeTotal} badges` },
        ];

        const hpKind = inv.hp > 40 ? "success" : "error";
        const vitalLines = [
            { kind: hpKind, text: `HP ${inv.hpBar} ${inv.hp}/${inv.hpMax}` },
        ];

        const questLines = [];
        if (quest.current) {
            questLines.push({ kind: "info", text: truncate(quest.current.title, width) });
            questLines.push({ kind: "dim", text: truncate(quest.current.objective, width) });
        } else {
            questLines.push({ kind: "success", text: "All quests complete." });
        }
        questLines.push({ kind: "dim", text: `${quest.mainDone}/${quest.mainTotal} main · ${quest.sideDone}/${quest.side.length} side` });

        const packLines = inv.items.length
            ? inv.items.slice(0, 6).map((item) => ({ kind: "output", text: truncate(`💰 ${item}`, width) }))
            : [{ kind: "dim", text: "(no treasures yet)" }];
        if (inv.items.length > 6) {
            packLines.push({ kind: "dim", text: `…and ${inv.items.length - 6} more` });
        }

        const mapLines = map.rows.map((row) => ({
            kind: row.here ? "success" : row.seen ? "output" : "dim",
            text: truncate(row.prefix + row.name + (row.here ? " ←" : ""), width),
        }));
        mapLines.push({ kind: "dim", text: `${map.explored} room${map.explored === 1 ? "" : "s"} explored` });

        const roomLines = [{ kind: "info", text: truncate(room.title, width) }]
            .concat(room.vignette.art.map((line) => ({ kind: "art", text: truncate(line, width) })));

        return [
            { title: "⚔ HERO", lines: heroLines },
            { title: "♥ VITALS", lines: vitalLines },
            { title: "◆ QUEST", lines: questLines },
            { title: "▣ PACK", lines: packLines },
            { title: "☗ MAP", lines: mapLines },
            { title: "◈ ROOM", lines: roomLines },
        ];
    }

    // One-line HUD for narrow terminals (drawn above the log as a strip).
    function strip(runtime) {
        const hero = heroModel(runtime);
        const inv = inventoryModel(runtime);
        const quest = questModel(runtime);
        const hpKind = inv.hp > 40 ? "success" : "error";
        return [
            { kind: hpKind, text: `♥ ${inv.hpBar} ${inv.hp}  ·  Lv ${hero.level} ${hero.xp}xp  ·  ⚑ ${quest.mainDone}/${quest.mainTotal}  ·  ${runtime.state.cwd}` },
        ];
    }

    const api = {
        SIDE_QUESTS,
        ROOM_VIGNETTES,
        vignetteKeyForRoom,
        roomVignette,
        bar,
        rankFor,
        levelFor,
        ensureVisited,
        snapshot,
        diffEvents,
        sideQuestDone,
        questModel,
        inventoryModel,
        heroModel,
        roomModel,
        mapModel,
        panels,
        strip,
    };

    global.BashcrawlHud = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
