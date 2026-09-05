(async function initGame() {
    const DATA_PATHS = {
        world: "./data/world.json",
        quests: "./data/quests.json",
        commands: "./data/commands.json",
        docs: "./data/docs.json",
    };

    const dom = {
        quest: document.getElementById("quest-panel"),
        inventory: document.getElementById("inventory-panel"),
        room: document.getElementById("room-panel"),
        map: document.getElementById("map-panel"),
        log: document.getElementById("output-log"),
        prompt: document.getElementById("prompt-label"),
        input: document.getElementById("command-input"),
        form: document.getElementById("command-form"),
        docsToggle: document.getElementById("docs-toggle"),
        docsClose: document.getElementById("docs-close"),
        docsDrawer: document.getElementById("docs-drawer"),
        docsContent: document.getElementById("docs-content"),
        docsSearch: document.getElementById("docs-search"),
        themeToggle: document.getElementById("theme-toggle"),
        crtToggle: document.getElementById("crt-toggle"),
    };

    const escapeHtml = window.TermForge.sinks.escapeHtml;
    // The shared presenter: every panel below renders a BashcrawlHud model,
    // the same models the terminal HUD draws (termforge/node/host-tty.js).
    const Hud = window.BashcrawlHud;

    const data = await loadData();
    let runtime = new window.BashcrawlRuntime.Runtime(data, window.BashcrawlStorage.load(() => window.BashcrawlRuntime.defaultState(data.world.root)));
    const docsPanel = new window.BashcrawlDocs.DocsPanel({
        drawer: dom.docsDrawer,
        content: dom.docsContent,
        search: dom.docsSearch,
        input: dom.input,
        onOpenChange(open) {
            dom.docsToggle.setAttribute("aria-expanded", String(open));
        },
    });
    docsPanel.setData(data.docs, runtime);

    function roomVignetteHtml(vignette) {
        const safe = vignette.art.map(escapeHtml).join("\n");
        return `<pre class="room-vignette" data-room-art="${vignette.key}" aria-hidden="true">${safe}</pre>`;
    }

    // The story log is a TermForge TerminalView painting into #output-log.
    // Control routing preserves the historical behavior: "levelup" is pure
    // fanfare (swallowed after the flash), "reset" rebuilds the runtime and
    // then falls through to the buffer like any other record.
    const view = new window.TermForge.view.TerminalView({
        sink: new window.TermForge.sinks.DomSink(dom.log),
        cap: 600,
        onControl(action) {
            if (action === "reset") {
                runtime = new window.BashcrawlRuntime.Runtime(data);
                docsPanel.setData(data.docs, runtime);
                window.BashcrawlStorage.clear();
                return true;
            }
            if (action === "levelup") flashLevelUp();
            return false;
        },
    });
    const append = (kind, text) => view.appendLine(kind, text);
    append("banner", runtime.uiText.bannerArt);
    append("info", "Welcome to Bashcrawl Web.");
    append("dim", "Try: pwd, ls -F, cat scroll, cd cellar  •  cat scroll | wc -l  •  hint, map, tree, cowsay hi  •  F1/Ctrl+/ for Docs.");
    append("magic", "🕹  Practice Arcade (top nav or Alt+2): Path Navigator · grep/find Hunt · Pipe Puzzle · Command Flash. Reference cheatsheets: Alt+3.");
    append("dim", "In-story drills still work too:  train · speedrun · pathfind. Everything earns XP.");
    if (runtime.state.trainer && runtime.state.trainer.active) {
        for (const out of runtime.trainerChallenge()) append(out.kind, out.text);
    }
    render();
    let prevState = snapshotState();

    // Outside story mode even an empty Enter routes (the arcade uses it to
    // return to the floor after a finished trial).
    function nonStoryMode() {
        return window.BashcrawlShell && window.BashcrawlShell.mode() !== "story";
    }

    dom.form.addEventListener("submit", (event) => {
        event.preventDefault();
        const line = dom.input.value.trim();
        dom.input.value = "";
        if (!line && !nonStoryMode()) return;
        runLine(line);
    });

    function commandInputKeydown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            const line = dom.input.value.trim();
            dom.input.value = "";
            if (line || nonStoryMode()) runLine(line);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            historyStep(-1);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            historyStep(1);
        } else if (event.key === "Tab") {
            event.preventDefault();
            completeInput();
        } else if (event.key === "F1") {
            event.preventDefault();
            docsPanel.toggle();
        } else if (event.key === "?" && !dom.input.value.trim()) {
            event.preventDefault();
            docsPanel.open();
        } else if (event.key === "/" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            docsPanel.toggle();
        } else if (event.key.toLowerCase() === "l" && event.ctrlKey) {
            event.preventDefault();
            // Non-story modes clear their own log (e.g. the arcade's).
            if (window.BashcrawlShell && window.BashcrawlShell.clearLog && window.BashcrawlShell.clearLog()) return;
            view.clear();
            renderLog();
        }
    }

    function docsSearchKeydown(event) {
        if (event.key === "F1") {
            event.preventDefault();
            docsPanel.toggle();
        } else if (event.key === "/" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            docsPanel.toggle();
        }
    }

    dom.input.addEventListener("keydown", commandInputKeydown);
    dom.docsSearch.addEventListener("keydown", docsSearchKeydown);

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !docsPanel.isOpen()) return;
        event.preventDefault();
        docsPanel.close();
    });

    dom.docsToggle.addEventListener("click", () => docsPanel.toggle());
    dom.docsClose.addEventListener("click", () => docsPanel.close());
    dom.themeToggle.addEventListener("click", toggleTheme);
    dom.crtToggle.addEventListener("click", toggleCrt);

    initTheme();
    initCrt();
    dom.input.focus();

    async function loadData() {
        const entries = await Promise.all(Object.entries(DATA_PATHS).map(async ([key, path]) => {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to load ${path}`);
            return [key, await response.json()];
        }));
        return Object.fromEntries(entries);
    }

    function snapshotState() {
        return Hud.snapshot(runtime);
    }

    function runLine(line) {
        // Mode router: while the Practice Arcade owns the input, lines go there.
        if (window.BashcrawlShell && window.BashcrawlShell.mode() !== "story") {
            window.BashcrawlShell.handleInput(line);
            return;
        }
        const promptEcho = runtime.promptLabel ? runtime.promptLabel() : `${runtime.state.cwd} $`;
        append("dim", `${promptEcho} ${line}`);
        if (!runtime.state.history.length || runtime.state.history[runtime.state.history.length - 1] !== line) {
            runtime.state.history.push(line);
        }
        runtime.state.historyIndex = runtime.state.history.length;
        const outputs = runtime.execute(line);
        view.appendOutputs(outputs);
        const spec = playCommandFx(line, outputs);
        if (spec && spec.exec) {
            screenFlash("magic");
            applyHeroMood("cast");
        }
        if (spec && spec.motion === "error") bump(dom.log, "fx-glitch", 320);
        const after = snapshotState();
        triggerEffects(prevState, after);
        prevState = after;
        saveAndRender();
        pingLog();
        if (spec && spec.cmd === "cat" && spec.known) {
            window.BashcrawlCommandFx.playCat(dom.log, outputs);
        }
    }

    function playCommandFx(line, outputs) {
        const catalog = window.BashcrawlCommandFx;
        if (!catalog) return null;
        const error = (outputs || []).some((out) => out && out.kind === "error");
        return catalog.apply(line, { log: dom.log, form: dom.form, prompt: dom.prompt, error });
    }

    // Semantic events come from the shared presenter; this maps them onto the
    // web's CSS effects (the terminal HUD maps the same events onto toasts).
    function triggerEffects(prev, next) {
        for (const event of Hud.diffEvents(prev, next)) {
            if (event.type === "quest") {
                appendSparkleArt();
                flashPanel(dom.quest);
                applyHeroMood("quest");
            } else if (event.type === "damage") {
                shakePanel(dom.inventory);
                applyHeroMood("hurt");
                screenFlash("damage");
            } else if (event.type === "heal") {
                flashPanel(dom.inventory);
                screenFlash("heal");
            } else if (event.type === "xp") {
                popXp();
                floatXp(event.amount);
                applyHeroMood("xp");
            } else if (event.type === "item") {
                flashPanel(dom.inventory);
                applyHeroMood("item");
            } else if (event.type === "move") {
                flashPanel(dom.room);
                bump(dom.room && dom.room.closest(".tui-panel"), "fx-room-enter", 480);
                bump(dom.map && dom.map.closest(".tui-panel"), "fx-arrive", 700);
            } else if (event.type === "unlock") {
                flashPanel(dom.map);
                shakePanel(dom.map);
                screenFlash("unlock");
            }
            // "levelup" is already celebrated via the runtime's control record
            // (flashLevelUp in this view's onControl).
        }
    }

    function appendSparkleArt() {
        const lines = [
            "      .   *  .   .  *  .   *",
            "    *  ✦  .   *  ✧   .  *  ✦   ✧",
            "      ✦  ✧ ✦  Q U E S T  ✦ ✧ ✦",
            "    *      C O M P L E T E      *",
            "      ✧  *   .  ✦   . *  ✧   ✦",
        ].join("\n");
        append("art", lines);
    }

    // Brief full-screen flash via a transient overlay element (no pseudo-element
    // conflicts with the CRT/level-up layers). Auto-removed; reduced-motion-safe.
    function screenFlash(kind) {
        const el = document.createElement("div");
        el.className = `bc-screenflash bc-screenflash-${kind}`;
        el.setAttribute("aria-hidden", "true");
        document.body.appendChild(el);
        let done = false;
        const cleanup = () => { if (done) return; done = true; el.remove(); };
        el.addEventListener("animationend", cleanup, { once: true });
        setTimeout(cleanup, 1000);
    }

    function flashLevelUp() {
        const shell = document.querySelector(".web-shell");
        if (!shell) return;
        shell.classList.remove("fx-levelup");
        void shell.offsetWidth;
        shell.classList.add("fx-levelup");
        setTimeout(() => shell.classList.remove("fx-levelup"), 950);
    }

    function bump(el, cls, ms) {
        if (!el || !cls) return;
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), ms || 400);
    }

    function pingLog() {
        bump(dom.log, "fx-fresh", 420);
    }

    function flashPanel(el) {
        if (!el) return;
        bump(el.closest(".tui-panel") || el, "fx-sparkle", 1100);
    }

    function shakePanel(el) {
        if (!el) return;
        bump(el.closest(".tui-panel") || el, "fx-shake", 360);
    }

    function popXp() {
        const xpSpan = dom.quest.querySelector(".quest-xp") || dom.quest.querySelector(".kind-dim");
        if (!xpSpan) return;
        xpSpan.classList.remove("fx-pop");
        void xpSpan.offsetWidth;
        xpSpan.classList.add("fx-pop");
        setTimeout(() => xpSpan.classList.remove("fx-pop"), 700);
    }

    function saveAndRender() {
        window.BashcrawlStorage.save(runtime.state);
        docsPanel.setData(data.docs, runtime);
        render();
    }

    function render() {
        // Panels dip while they repaint; bump() owns the class lifetime so the
        // 220ms transition actually runs (add + remove in one frame never paints).
        [dom.quest, dom.inventory, dom.room, dom.map]
            .map((el) => el && el.closest(".tui-panel"))
            .filter(Boolean)
            .forEach((panel) => bump(panel, "is-refreshing", 220));
        recordVisit();
        renderQuest();
        renderInventory();
        renderHpBar();
        renderRoom();
        renderMap();
        renderPrompt();
        renderLog();
        // Concept spotlight: surface what the current room teaches (reference.js).
        if (window.BashcrawlShell) window.BashcrawlShell.onStoryRender(runtime);
    }

    // Record the current room (and its ancestors, so the trunk is always solid)
    // into the persisted visited-set that drives the generative map's fog of war.
    function recordVisit() {
        Hud.ensureVisited(runtime);
    }

    // Collapsible <details> log: every main-story quest plus the optional side
    // quests, each tagged done / active / locked. Collapsed by default to keep
    // the sidebar compact; the at-a-glance current quest stays above it.
    function renderQuestLog(quest) {
        const mainRows = quest.rows.map((row) => (
            `<li class="ql-${row.status}">${row.icon} ${escapeHtml(row.title)}</li>`
        )).join("");
        const sideRows = quest.side.map((side) => (
            `<li class="ql-${side.done ? "done" : "side"}" title="${escapeHtml(side.hint)}">${side.icon} ${escapeHtml(side.name)}</li>`
        )).join("");
        return `<details class="quest-log">`
            + `<summary>Quest Log — ${quest.mainDone}/${quest.mainTotal} main · ${quest.sideDone}/${quest.side.length} side</summary>`
            + `<p class="ql-group">Main Quests</p><ul class="ql-list">${mainRows}</ul>`
            + `<p class="ql-group">Side Quests</p><ul class="ql-list">${sideRows}</ul>`
            + `</details>`;
    }

    function renderQuest() {
        const quest = Hud.questModel(runtime);
        const summary = quest.current
            ? `<p><strong>${escapeHtml(quest.current.title)}</strong></p><p>${escapeHtml(quest.current.objective)}</p><p class="kind-dim quest-xp">${quest.mainDone}/${quest.mainTotal} complete • ${quest.xp} XP</p>`
            : `<p class="kind-success">All quests complete.</p><p class="quest-xp">${quest.xp} XP earned.</p>`;
        dom.quest.innerHTML = summary + renderQuestLog(quest);
    }

    function renderInventory() {
        const inv = Hud.inventoryModel(runtime);
        const itemsHtml = inv.items.length
            ? `<ul class="inv-items">${inv.items.map((item) => `<li>💰 ${escapeHtml(item)}</li>`).join("")}</ul>`
            : `<p class="inv-empty kind-dim">No treasures yet — explore rooms and grab the loot.</p>`;
        dom.inventory.innerHTML =
            `<p class="inv-hp">HP <span class="${inv.hp > 40 ? "kind-success" : "kind-error"}">${inv.hpBar}</span> ${inv.hp}/${inv.hpMax}</p>`
            + `<p class="inv-heading kind-dim">Items carried (${inv.items.length})</p>`
            + itemsHtml;
    }

    function renderRoom() {
        const room = Hud.roomModel(runtime);
        const entries = room.entries.map((entry) => (
            `${entry.icon} ${escapeHtml(entry.name)}${entry.marker}`
        )).join("<br>");
        // Vignette sits under the room name (before the scrollable entry list)
        // so the ambient mascot stays visible even when contents are long. The
        // "In this room" label distinguishes room contents from carried items.
        dom.room.innerHTML = `<p><strong>${escapeHtml(room.title)}</strong></p><p class="kind-dim">${escapeHtml(room.path)}</p>${roomVignetteHtml(room.vignette)}<p class="room-contents-label kind-dim">In this room</p><p>${entries || "(empty)"}</p>`;
    }

    // Fog-of-war dungeon map: the tree itself comes from the shared presenter
    // (Hud.mapModel); this just wraps each row in the css classes.
    function renderMap() {
        if (!dom.map) return;
        const map = Hud.mapModel(runtime);
        const out = map.rows.map((row) => {
            const cls = row.here ? "map-here" : row.seen ? "map-seen" : "map-fog";
            return `${row.prefix}<span class="${cls}">${escapeHtml(row.name)}</span>${row.here ? " ←" : ""}`;
        });
        const legend = `<p class="map-legend kind-dim">${map.explored} room${map.explored === 1 ? "" : "s"} explored · ← you are here</p>`;
        dom.map.innerHTML = `<pre class="map-tree" aria-label="Discovered dungeon map">${out.join("\n")}</pre>${legend}`;
    }

    function renderPrompt() {
        const p = runtime.promptLabel ? runtime.promptLabel() : `${runtime.state.cwd} $`;
        // Route through the shell so an active Arcade prompt isn't clobbered
        // by story re-renders (e.g. an arcade XP award updating the sidebar).
        if (window.BashcrawlShell) {
            window.BashcrawlShell.setPrompt(p, { fromStory: true });
            // Mirror the textContent guard: only story owns the tooltip too.
            if (window.BashcrawlShell.mode() === "story") {
                dom.prompt.setAttribute("title", `Full path: ${runtime.state.cwd}`);
            }
        } else {
            dom.prompt.textContent = p;
            dom.prompt.setAttribute("title", `Full path: ${runtime.state.cwd}`);
        }
    }

    function renderLog() {
        view.flush();
    }

    function historyStep(direction) {
        const value = window.TermForge.input.historyStep(runtime.state, direction);
        if (value != null) dom.input.value = value;
    }

    function completeInput() {
        // Mode-aware: a non-story mode may own completion (the arcade completes
        // against its scoped runtime and echoes candidate lists into its own
        // log). null means the story path below applies.
        const hook = window.BashcrawlShell && window.BashcrawlShell.completions
            ? window.BashcrawlShell.completions(dom.input.value)
            : null;
        const candidates = hook ? hook.list : runtime.completions(dom.input.value);
        const { value, echo } = window.TermForge.input.applyCompletion(dom.input.value, candidates);
        if (value != null) {
            dom.input.value = value;
        } else if (echo && !hook) {
            append("info", echo);
            renderLog();
        }
    }

    function initTheme() {
        const saved = localStorage.getItem("bashcrawl-web-theme");
        if (saved) document.documentElement.setAttribute("data-theme", saved);
        syncThemeLabel();
    }

    function syncThemeLabel() {
        const t = document.documentElement.getAttribute("data-theme") || "dark";
        const isDark = t === "dark";
        dom.themeToggle.textContent = isDark ? "Dark" : "Light";
        dom.themeToggle.setAttribute("aria-pressed", String(isDark));
        dom.themeToggle.setAttribute("title", isDark ? "Switch to light theme" : "Switch to dark theme");
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("bashcrawl-web-theme", next);
        syncThemeLabel();
    }

    // === CRT Retro Mode (mirrors the theme toggle) ===
    // Persists to localStorage 'bashcrawl-web-crt'; default OFF; sets data-crt on <body>.
    function initCrt() {
        const on = localStorage.getItem("bashcrawl-web-crt") === "on";
        document.body.setAttribute("data-crt", on ? "on" : "off");
        syncCrtLabel();
    }

    function syncCrtLabel() {
        const on = document.body.getAttribute("data-crt") === "on";
        dom.crtToggle.textContent = on ? "CRT On" : "CRT Off";
        dom.crtToggle.setAttribute("aria-pressed", String(on));
        dom.crtToggle.setAttribute("title", on ? "Disable retro CRT overlay" : "Enable retro CRT overlay");
    }

    function toggleCrt() {
        const next = document.body.getAttribute("data-crt") === "on" ? "off" : "on";
        document.body.setAttribute("data-crt", next);
        localStorage.setItem("bashcrawl-web-crt", next);
        syncCrtLabel();
    }

    // === Pixel Hero Companion helpers ===
    // Swaps the hero panel's data-mood (drives CSS reactions), then returns to
    // "idle" after the reaction. One tracked timer, cleared before re-arming —
    // no setInterval/rAF. Safe if the panel is absent (every access guarded).
    let heroMoodTimer = null;
    const HERO_MOOD_MS = { hurt: 600, quest: 1500, item: 700, xp: 900, cast: 800, idle: 0 };
    const HERO_MOOD_LABELS = {
        idle: "Catching their breath.",
        hurt: "Ow! That stung.",
        quest: "Quest cleared! Huzzah!",
        item: "Ooh, shiny loot!",
        xp: "Growing stronger...",
        cast: "Magick crackles...",
    };

    function applyHeroMood(mood) {
        const stage = document.getElementById("hero-panel");
        if (!stage) return;
        const label = document.getElementById("hero-mood-label");
        const next = HERO_MOOD_MS[mood] != null ? mood : "idle";
        if (heroMoodTimer) {
            clearTimeout(heroMoodTimer);
            heroMoodTimer = null;
        }
        // Re-trigger the CSS animation even if the same mood repeats.
        stage.dataset.mood = "idle";
        void stage.offsetWidth;
        stage.dataset.mood = next;
        stage.setAttribute("aria-label", `Pixel adventurer companion (${next})`);
        if (label && HERO_MOOD_LABELS[next]) label.textContent = HERO_MOOD_LABELS[next];
        if (next !== "idle") {
            heroMoodTimer = setTimeout(() => {
                stage.dataset.mood = "idle";
                stage.setAttribute("aria-label", "Pixel adventurer companion (idle)");
                if (label) label.textContent = HERO_MOOD_LABELS.idle;
                heroMoodTimer = null;
            }, HERO_MOOD_MS[next]);
        }
    }

    // === Terminal Juice Pack helpers ===
    // (2) Floating "+N XP" number near the quest panel.
    function floatXp(amount) {
        const panel = dom.quest && dom.quest.closest(".tui-panel");
        if (!panel || amount <= 0) return;
        const cs = getComputedStyle(panel);
        if (cs.position === "static") panel.style.position = "relative";
        const node = document.createElement("span");
        node.className = "bc-xp-float";
        node.setAttribute("aria-hidden", "true");
        node.textContent = `+${amount} XP`;
        panel.appendChild(node);
        let done = false;
        const cleanup = () => {
            if (done) return;
            done = true;
            node.remove();
        };
        node.addEventListener("animationend", cleanup, { once: true });
        // Safety net: remove even if animationend never fires (reduced-motion).
        setTimeout(cleanup, 1300);
    }

    // (3) Smooth HP fill bar. One persistent <div> inside #inventory-panel;
    // re-inserted after renderInventory() rewrites innerHTML. The text bar
    // in renderInventory() stays as the fallback.
    function renderHpBar() {
        if (!dom.inventory) return;
        const hp = Math.max(0, Math.min(100, runtime.state.hp));
        let bar = dom.inventory.querySelector(".bc-hpbar");
        if (!bar) {
            bar = document.createElement("div");
            bar.className = "bc-hpbar";
            bar.setAttribute("role", "img");
            const fill = document.createElement("div");
            fill.className = "bc-hpbar-fill";
            bar.appendChild(fill);
            dom.inventory.insertBefore(bar, dom.inventory.firstChild);
        } else if (bar.parentElement !== dom.inventory) {
            dom.inventory.insertBefore(bar, dom.inventory.firstChild);
        }
        const fill = bar.firstElementChild;
        fill.style.setProperty("--hp", String(hp));
        fill.classList.toggle("is-low", hp <= 25);
        fill.classList.toggle("is-mid", hp > 25 && hp <= 50);
        bar.setAttribute("aria-label", `Health ${hp} of 100`);
    }

    // Bridge for the shell router (shell.js): story runtime access for the XP
    // award path, plus the loaded data bundle so shell can boot without
    // re-fetching. The ready event covers the load-order race (shell.js loads
    // after this async IIFE finishes fetching data).
    window.BashcrawlFx = {
        bump,
        screenFlash,
        flashLevelUp,
        playCommandFx,
        warp(el) { bump(el && el.closest ? (el.closest(".tui-content") || el) : el, "fx-warp", 520); },
        glitch(el) { bump(el || dom.log, "fx-glitch", 320); },
        celebrate() {
            screenFlash("magic");
            flashLevelUp();
        },
        powerOn() { screenFlash("poweron"); },
    };
    window.BashcrawlGame = {
        data,
        getRuntime: () => runtime,
        saveAndRender,
        runLine,
    };
    screenFlash("poweron");
    document.dispatchEvent(new CustomEvent("bashcrawl:ready", { detail: { data } }));
})().catch((error) => {
    // Boot failed (most commonly: data/*.json fetches blocked under file://).
    // Surface a plain-text explanation in the log pane instead of a blank UI.
    console.error("Bashcrawl failed to boot:", error);
    const log = document.getElementById("output-log");
    if (log) {
        log.textContent = "Failed to load game data — if you opened index.html directly, "
            + "serve the folder instead: python3 -m http.server. "
            + `(${error && error.message ? error.message : error})`;
    }
});
