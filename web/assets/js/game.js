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

    // === Room vignettes: box-safe ASCII mascot per area (banner shimmer is pure CSS) ===
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

    function roomVignetteHtml() {
        const actual = (runtime.actual ? runtime.actual(runtime.state.cwd) : runtime.state.cwd);
        const key = vignetteKeyForRoom(actual, runtime.state.cwd);
        const art = ROOM_VIGNETTES[key] || ROOM_VIGNETTES.deep;
        const safe = art.map(escapeHtml).join("\n");
        return `<pre class="room-vignette" data-room-art="${key}" aria-hidden="true">${safe}</pre>`;
    }

    const logLines = [];
    const BANNER = [
        "       ╔════════════════════════════════════════════════════╗",
        "       ║   ____            __                       __      ║",
        "       ║  / __ )___ ______/ /_  ______________ ___ / /      ║",
        "       ║ / __  / __ `/ ___/ __ \\/ ___/ ___/ __ `__ \\/ /      ║",
        "       ║/ /_/ / /_/ (__  ) / / / /__/ /  / / / / / / /__    ║",
        "       ║\\____/\\__,_/____/_/ /_/\\___/_/  /_/ /_/ /_/____/    ║",
        "       ║                                                    ║",
        "       ║       Type  pwd  to begin the descent. F1 for help ║",
        "       ╚════════════════════════════════════════════════════╝",
    ].join("\n");
    append("banner", BANNER);
    append("info", "Welcome to Bashcrawl Web.");
    append("dim", "Try: pwd, ls -F, cat scroll, cd cellar  •  cat scroll | wc -l  •  hint, map, tree, cowsay hi  •  F1/Ctrl+/ for Docs.");
    append("magic", "🆕 Mini-games:  train  (drill commands)  ·  speedrun  (timed, beat your best)  ·  pathfind  (quest to a room). All earn XP.");
    if (runtime.state.trainer && runtime.state.trainer.active) {
        for (const out of runtime.trainerChallenge()) append(out.kind, out.text);
    }
    render();
    let prevState = snapshotState();

    dom.form.addEventListener("submit", (event) => {
        event.preventDefault();
        const line = dom.input.value.trim();
        dom.input.value = "";
        if (!line) return;
        runLine(line);
    });

    function commandInputKeydown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            const line = dom.input.value.trim();
            dom.input.value = "";
            if (line) runLine(line);
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
            logLines.length = 0;
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
        return {
            xp: runtime.state.xp,
            hp: runtime.state.hp,
            completed: runtime.state.completedQuestIds.length,
            currentQuestId: runtime.state.currentQuestId,
            inventory: runtime.state.inventory.slice(),
        };
    }

    function runLine(line) {
        const promptEcho = runtime.promptLabel ? runtime.promptLabel() : `${runtime.state.cwd} $`;
        append("dim", `${promptEcho} ${line}`);
        if (!runtime.state.history.length || runtime.state.history[runtime.state.history.length - 1] !== line) {
            runtime.state.history.push(line);
        }
        runtime.state.historyIndex = runtime.state.history.length;
        const outputs = runtime.execute(line);
        for (const out of outputs) {
            if (out.action === "clear") {
                logLines.length = 0;
                continue;
            }
            if (out.action === "reset") {
                runtime = new window.BashcrawlRuntime.Runtime(data);
                docsPanel.setData(data.docs, runtime);
                window.BashcrawlStorage.clear();
            }
            append(out.kind, out.text || "");
        }
        const after = snapshotState();
        triggerEffects(prevState, after);
        prevState = after;
        saveAndRender();
    }

    function triggerEffects(prev, next) {
        if (next.completed > prev.completed) {
            appendSparkleArt();
            flashPanel(dom.quest);
            applyHeroMood("quest");
        }
        if (next.hp < prev.hp) {
            shakePanel(dom.inventory);
            applyHeroMood("hurt");
        }
        if (next.xp > prev.xp) {
            popXp();
            floatXp(next.xp - prev.xp);
            applyHeroMood("xp");
        }
        if (next.inventory.length > prev.inventory.length) {
            flashPanel(dom.inventory);
            applyHeroMood("item");
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

    function flashPanel(el) {
        if (!el || !el.parentElement) return;
        const target = el.closest(".tui-panel") || el;
        target.classList.remove("fx-sparkle");
        void target.offsetWidth;
        target.classList.add("fx-sparkle");
        setTimeout(() => target.classList.remove("fx-sparkle"), 1100);
    }

    function shakePanel(el) {
        if (!el || !el.parentElement) return;
        const target = el.closest(".tui-panel") || el;
        target.classList.remove("fx-shake");
        void target.offsetWidth;
        target.classList.add("fx-shake");
        setTimeout(() => target.classList.remove("fx-shake"), 360);
    }

    function popXp() {
        const xpSpan = dom.quest.querySelector(".kind-dim");
        if (!xpSpan) return;
        xpSpan.classList.remove("fx-pop");
        void xpSpan.offsetWidth;
        xpSpan.classList.add("fx-pop");
        setTimeout(() => xpSpan.classList.remove("fx-pop"), 700);
    }

    function append(kind, text) {
        for (const line of String(text).split("\n")) {
            logLines.push({ kind: kind || "output", text: line });
        }
        if (logLines.length > 600) logLines.splice(0, logLines.length - 600);
    }

    function saveAndRender() {
        window.BashcrawlStorage.save(runtime.state);
        docsPanel.setData(data.docs, runtime);
        render();
    }

    function render() {
        renderQuest();
        renderInventory();
        renderHpBar();
        renderRoom();
        renderPrompt();
        renderLog();
    }

    function renderQuest() {
        const quest = runtime.quests[runtime.state.currentQuestId];
        const complete = runtime.state.completedQuestIds.length;
        dom.quest.innerHTML = quest
            ? `<p><strong>${escapeHtml(quest.title)}</strong></p><p>${escapeHtml(quest.objective)}</p><p class="kind-dim">${complete}/${runtime.quests.length} complete • ${runtime.state.xp} XP</p>`
            : `<p class="kind-success">All quests complete.</p><p>${runtime.state.xp} XP earned.</p>`;
    }

    function renderInventory() {
        const hp = Math.max(0, Math.min(100, runtime.state.hp));
        const filled = Math.round(hp / 10);
        const bar = "█".repeat(filled) + "░".repeat(10 - filled);
        dom.inventory.innerHTML = `<p>HP <span class="${hp > 40 ? "kind-success" : "kind-error"}">${bar}</span> ${hp}/100</p><p>${runtime.state.inventory.map(escapeHtml).join(", ") || "(empty)"}</p>`;
    }

    function renderRoom() {
        const meta = runtime.currentRoomMeta();
        const entries = runtime.entries(runtime.state.cwd, false).map((entry) => {
            const marker = entry.type === "dir" ? "/" : entry.type === "exec" ? "*" : "";
            return `${entry.type === "dir" ? "📁" : entry.type === "exec" ? "⚡" : "📄"} ${escapeHtml(entry.name)}${marker}`;
        }).join("<br>");
        // Vignette sits under the room name (before the scrollable entry list)
        // so the ambient mascot stays visible even when contents are long.
        dom.room.innerHTML = `<p><strong>${escapeHtml(meta.title || runtime.state.cwd)}</strong></p><p class="kind-dim">${escapeHtml(runtime.state.cwd)}</p>${roomVignetteHtml()}<p>${entries || "(empty)"}</p>`;
    }

    function renderPrompt() {
        const p = runtime.promptLabel ? runtime.promptLabel() : `${runtime.state.cwd} $`;
        dom.prompt.textContent = p;
        dom.prompt.setAttribute("title", `Full path: ${runtime.state.cwd}`);
    }

    function renderLog() {
        dom.log.innerHTML = logLines.map((line) => `<span class="kind-${line.kind || "output"}">${escapeHtml(line.text)}</span>`).join("\n");
        dom.log.scrollTop = Math.max(0, dom.log.scrollHeight - dom.log.clientHeight);
    }

    function historyStep(direction) {
        const history = runtime.state.history;
        if (!history.length) return;
        runtime.state.historyIndex = Math.max(0, Math.min(history.length, runtime.state.historyIndex + direction));
        dom.input.value = runtime.state.historyIndex >= history.length ? "" : history[runtime.state.historyIndex];
    }

    function completeInput() {
        const completions = runtime.completions(dom.input.value);
        if (completions.length === 1) {
            const parts = dom.input.value.split(/\s+/);
            parts[parts.length - 1] = completions[0];
            dom.input.value = parts.join(" ");
        } else if (completions.length > 1) {
            append("info", completions.join("  "));
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
    const HERO_MOOD_MS = { hurt: 600, quest: 1500, item: 700, xp: 900, idle: 0 };
    const HERO_MOOD_LABELS = {
        idle: "Catching their breath.",
        hurt: "Ow! That stung.",
        quest: "Quest cleared! Huzzah!",
        item: "Ooh, shiny loot!",
        xp: "Growing stronger...",
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

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }
})();
