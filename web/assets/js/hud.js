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
        { key: "chapel", name: "The Hidden Chapel", hint: "Collect the cellar amulet, then ls at the entrance." },
        { key: "vault", name: "The Sealed Vault", hint: "Use variables to breach the vault." },
        { key: "scrap", name: "The Scrapyard", hint: "Find the scrap and master symbolic links." },
        { key: "rift", name: "The Rift", hint: "Tear open the rift for advanced trials." },
    ];

    // Box-safe ASCII mascot per area (shared ambience: web room panel and the
    // terminal sidebar draw the same vignette).
    const ROOM_VIGNETTES = {
        entrance: [
            "  (  )      (  )  ",
            "  )(   /\\   )(    ",
            "  ||  /  \\  ||    ",
            " _||_/    \\_||_   ",
            "[==||      ||==]  ",
            "   ''      ''     ",
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
            " .---.  ._.  .---. ",
            " | + |  /_\\  | R | ",
            " |   | |   | |   | ",
            " |   | |   | |   | ",
            "_|___|_|___|_|___| ",
            " ~~~    ~~~   ~~~  ",
        ],
        vault: [
            "       /\\     /\\   ",
            "      /  \\   /  \\  ",
            "     / /\\ \\ / /\\ \\ ",
            "     \\ \\/ / \\ \\/ / ",
            "      \\  /   \\  /  ",
            "       \\/  *  \\/   ",
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
            "  *  /        \\ .  ",
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
            reveals: Object.keys(s.reveals || {}).length,
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
        if (next.hp > prev.hp) {
            events.push({ type: "heal", amount: next.hp - prev.hp, text: `+${next.hp - prev.hp} HP` });
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
        if (next.cwd !== prev.cwd) {
            events.push({ type: "move", from: prev.cwd, to: next.cwd, text: `→ ${next.cwd}` });
        }
        if ((next.reveals || 0) > (prev.reveals || 0)) {
            events.push({ type: "unlock", text: "New passages have opened." });
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
        return {
            title: meta.title || runtime.state.cwd,
            path: runtime.state.cwd,
            vignette,
            entries,
            teaches: Array.isArray(meta.teaches) ? meta.teaches.slice() : [],
            next_steps: meta.next_steps || "",
        };
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

    // ── Configurable dashboard layout ───────────────────────────────────────
    // Shared by the web sidebar and the TTY HUD. Persistence is a side-store
    // (not the story save): attachStore({load,save}, surfaceDefaults).
    const LAYOUT_KEY = "bashcrawl-hud-layout-v1";
    const PANE_DEFS = [
        { id: "room", title: "◈ ROOM", surfaces: ["tty", "web"] },
        { id: "quest", title: "◆ QUEST", surfaces: ["tty", "web"] },
        { id: "pack", title: "▣ PACK", surfaces: ["tty", "web"] },
        { id: "vitals", title: "♥ VITALS", surfaces: ["tty"] },
        { id: "map", title: "☗ MAP", surfaces: ["tty", "web"] },
        { id: "hero", title: "⚔ HERO", surfaces: ["tty", "web"] },
        { id: "spotlight", title: "✧ TEACH", surfaces: ["web"] },
    ];
    const PANE_IDS = PANE_DEFS.map((pane) => pane.id);

    function defaultLayout(overrides) {
        const extra = overrides || {};
        return {
            version: 1,
            dock: extra.dock === "left" || extra.dock === "right" ? extra.dock : "right",
            sidebar: extra.sidebar !== false,
            width: clampWidth(extra.width == null ? 30 : extra.width),
            panes: PANE_DEFS.map((pane) => ({ id: pane.id, visible: true, collapsed: false })),
        };
    }

    function clampWidth(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 30;
        return Math.max(20, Math.min(40, Math.round(n)));
    }

    function normalizeLayout(raw, overrides) {
        const base = defaultLayout(overrides);
        if (!raw || typeof raw !== "object") return base;
        const byId = new Map();
        for (const pane of Array.isArray(raw.panes) ? raw.panes : []) {
            if (pane && PANE_IDS.indexOf(pane.id) >= 0) byId.set(pane.id, pane);
        }
        return {
            version: 1,
            dock: raw.dock === "left" || raw.dock === "right" ? raw.dock : base.dock,
            sidebar: raw.sidebar !== false,
            width: clampWidth(raw.width == null ? base.width : raw.width),
            panes: PANE_DEFS.map((def) => {
                const prev = byId.get(def.id);
                return {
                    id: def.id,
                    visible: prev && prev.visible === false ? false : true,
                    collapsed: Boolean(prev && prev.collapsed),
                };
            }),
        };
    }

    let _layout = defaultLayout();
    let _store = null;
    let _surface = {};

    function attachStore(store, surfaceDefaults) {
        _store = store && typeof store.load === "function" ? store : null;
        _surface = surfaceDefaults || {};
        const loaded = _store && _store.load ? _store.load() : null;
        _layout = normalizeLayout(loaded, _surface);
        return _layout;
    }

    function getLayout() {
        return _layout;
    }

    function commitLayout(next) {
        _layout = normalizeLayout(next, _surface);
        if (_store && typeof _store.save === "function") _store.save(_layout);
        return _layout;
    }

    function paneIndex(id) {
        return _layout.panes.findIndex((pane) => pane.id === id);
    }

    function applyAction(action) {
        if (!action || !action.op) return { layout: _layout, message: "hud: unknown action" };
        if (action.op === "help") {
            return { layout: _layout, message: layoutHelp() };
        }
        if (action.op === "reset") {
            return { layout: commitLayout(defaultLayout(_surface)), message: "HUD layout reset." };
        }
        if (action.op === "dock") {
            _layout = commitLayout({ ..._layout, dock: action.side });
            return { layout: _layout, message: `HUD docked ${ _layout.dock }.` };
        }
        if (action.op === "sidebar") {
            _layout = commitLayout({ ..._layout, sidebar: action.on !== false });
            return { layout: _layout, message: _layout.sidebar ? "HUD sidebar on." : "HUD sidebar off — strip only." };
        }
        if (action.op === "width") {
            _layout = commitLayout({ ..._layout, width: _layout.width + (Number(action.delta) || 0) });
            return { layout: _layout, message: `HUD width ${_layout.width}.` };
        }
        const id = String(action.id || "").toLowerCase();
        const idx = paneIndex(id);
        if (idx < 0) return { layout: _layout, message: `hud: unknown pane '${id}'. Try: ${PANE_IDS.join(", ")}` };
        if (action.op === "toggle") {
            const field = action.field === "visible" ? "visible" : "collapsed";
            const panes = _layout.panes.map((pane, i) => {
                if (i !== idx) return pane;
                const nextVal = action.value == null ? !pane[field] : Boolean(action.value);
                return { ...pane, [field]: nextVal };
            });
            _layout = commitLayout({ ..._layout, panes });
            const pane = _layout.panes[idx];
            return { layout: _layout, message: `${id}: ${field} ${pane[field] ? "on" : "off"}.` };
        }
        if (action.op === "move") {
            const dir = action.dir < 0 ? -1 : 1;
            const dest = idx + dir;
            if (dest < 0 || dest >= _layout.panes.length) {
                return { layout: _layout, message: `${id} is already at the edge.` };
            }
            const panes = _layout.panes.slice();
            const swap = panes[dest];
            panes[dest] = panes[idx];
            panes[idx] = swap;
            _layout = commitLayout({ ..._layout, panes });
            return { layout: _layout, message: `Moved ${id} ${dir < 0 ? "up" : "down"}.` };
        }
        return { layout: _layout, message: "hud: unknown action" };
    }

    function parseHudLine(line) {
        const raw = String(line || "").trim();
        if (!raw) return null;
        const parts = raw.split(/\s+/);
        if (parts[0].toLowerCase() !== "hud") return null;
        const cmd = (parts[1] || "help").toLowerCase();
        const a = (parts[2] || "").toLowerCase();
        const b = (parts[3] || "").toLowerCase();
        if (cmd === "help") return { op: "help" };
        if (cmd === "reset") return { op: "reset" };
        if (cmd === "hide" && a) return { op: "toggle", id: a, field: "visible", value: false };
        if (cmd === "show" && a) return { op: "toggle", id: a, field: "visible", value: true };
        if ((cmd === "fold" || cmd === "collapse") && a) return { op: "toggle", id: a, field: "collapsed", value: true };
        if ((cmd === "unfold" || cmd === "expand") && a) return { op: "toggle", id: a, field: "collapsed", value: false };
        if (cmd === "toggle" && a) return { op: "toggle", id: a, field: "collapsed" };
        if (cmd === "move" && a && (b === "up" || b === "down")) {
            return { op: "move", id: a, dir: b === "up" ? -1 : 1 };
        }
        if (cmd === "dock" && (a === "left" || a === "right")) return { op: "dock", side: a };
        if (cmd === "sidebar" && (a === "on" || a === "off")) return { op: "sidebar", on: a === "on" };
        if (cmd === "wider") return { op: "width", delta: 2 };
        if (cmd === "narrower") return { op: "width", delta: -2 };
        if (parts.length === 1) return { op: "help" };
        return { op: "help" };
    }

    function layoutHelp() {
        const lay = _layout;
        const list = lay.panes.map((pane) => {
            const mark = !pane.visible ? "·" : pane.collapsed ? "▸" : "▾";
            return `${mark}${pane.id}`;
        }).join("  ");
        return [
            "HUD dashboard — personalize the layout (saved separately from game progress).",
            `  now: dock=${lay.dock}  sidebar=${lay.sidebar ? "on" : "off"}  width=${lay.width}`,
            `  panes: ${list}`,
            "  hud hide|show <pane>     hud fold|unfold <pane>     hud toggle <pane>",
            "  hud move <pane> up|down  hud dock left|right        hud sidebar on|off",
            "  hud wider|narrower       hud reset                  Click a pane title to fold it.",
        ].join("\n");
    }

    function decoratePanels(byId, surface) {
        const want = surface || "tty";
        return _layout.panes
            .filter((pane) => {
                const def = PANE_DEFS.find((item) => item.id === pane.id);
                return pane.visible && byId[pane.id] && def && def.surfaces.indexOf(want) >= 0;
            })
            .map((pane) => {
                const panel = byId[pane.id];
                const mark = pane.collapsed ? "▸" : "▾";
                return {
                    id: pane.id,
                    collapsed: pane.collapsed,
                    title: `${mark} ${panel.title}`,
                    lines: pane.collapsed ? [] : panel.lines,
                };
            });
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

        const mapCap = 6;
        const hereIdx = map.rows.findIndex((row) => row.here);
        const mapStart = map.rows.length > mapCap
            ? Math.max(0, Math.min(hereIdx < 0 ? 0 : hereIdx - 1, map.rows.length - mapCap))
            : 0;
        const mapRows = map.rows.slice(mapStart, mapStart + mapCap);
        const mapLines = mapRows.map((row) => ({
            kind: row.here ? "success" : row.seen ? "output" : "dim",
            text: truncate(row.prefix + row.name + (row.here ? " ←" : ""), width),
        }));
        mapLines.push({ kind: "dim", text: `${map.explored} room${map.explored === 1 ? "" : "s"} explored` });

        const roomLines = [{ kind: "info", text: truncate(room.title, width) }];
        const shown = room.entries.slice(0, 6);
        if (!shown.length) {
            roomLines.push({ kind: "dim", text: "(empty)" });
        } else {
            shown.forEach((entry) => {
                const kind = entry.type === "dir" ? "info" : entry.type === "exec" ? "magic" : "output";
                roomLines.push({
                    kind,
                    text: truncate(`${entry.icon} ${entry.name}${entry.marker}`, width),
                });
            });
            if (room.entries.length > 6) {
                roomLines.push({ kind: "dim", text: `…+${room.entries.length - 6} more` });
            }
        }
        if (room.teaches[0]) {
            roomLines.push({ kind: "dim", text: truncate(room.teaches[0], width) });
        }

        return decoratePanels({
            room: { title: "◈ ROOM", lines: roomLines },
            quest: { title: "◆ QUEST", lines: questLines },
            pack: { title: "▣ PACK", lines: packLines },
            vitals: { title: "♥ VITALS", lines: vitalLines },
            map: { title: "☗ MAP", lines: mapLines },
            hero: { title: "⚔ HERO", lines: heroLines },
        }, "tty");
    }

    // Narrow-terminal strip (drawn above the log). Status plus a Here listing
    // so 80-column hosts still see the room without a sidebar.
    function strip(runtime) {
        const hero = heroModel(runtime);
        const inv = inventoryModel(runtime);
        const quest = questModel(runtime);
        const room = roomModel(runtime);
        const hpKind = inv.hp > 40 ? "success" : "error";
        const here = room.entries.map((entry) => entry.name + entry.marker).join("  ") || "(empty)";
        const pack = inv.items.length ? `  ·  ${inv.items.join(",")}` : "";
        return [
            { kind: hpKind, text: `♥ ${inv.hpBar} ${inv.hp}  ·  Lv ${hero.level} ${hero.xp}xp  ·  ⚑ ${quest.mainDone}/${quest.mainTotal}  ·  ${runtime.state.cwd}` },
            { kind: "dim", text: `Here: ${here}${pack}` },
        ];
    }

    const api = {
        LAYOUT_KEY,
        PANE_DEFS,
        defaultLayout,
        normalizeLayout,
        attachStore,
        getLayout,
        commitLayout,
        applyAction,
        parseHudLine,
        layoutHelp,
        decoratePanels,
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
