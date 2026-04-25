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
    };

    const data = await loadData();
    let runtime = new window.BashcrawlRuntime.Runtime(data, window.BashcrawlStorage.load(() => window.BashcrawlRuntime.defaultState(data.world.root)));
    const docsPanel = new window.BashcrawlDocs.DocsPanel({
        drawer: dom.docsDrawer,
        content: dom.docsContent,
        search: dom.docsSearch,
        input: dom.input,
    });
    docsPanel.setData(data.docs, runtime);

    const logLines = [];
    append("info", "Welcome to Bashcrawl Web.");
    append("dim", "Start with: pwd, ls -F, cat scroll, cd cellar. Press F1 for docs.");
    render();

    dom.form.addEventListener("submit", (event) => {
        event.preventDefault();
        const line = dom.input.value.trim();
        dom.input.value = "";
        if (!line) return;
        runLine(line);
    });

    dom.input.addEventListener("keydown", (event) => {
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
        } else if (event.key.toLowerCase() === "l" && event.ctrlKey) {
            event.preventDefault();
            logLines.length = 0;
            renderLog();
        }
    });

    dom.docsToggle.addEventListener("click", () => docsPanel.toggle());
    dom.docsClose.addEventListener("click", () => docsPanel.close());
    dom.themeToggle.addEventListener("click", toggleTheme);

    initTheme();
    dom.input.focus();

    async function loadData() {
        const entries = await Promise.all(Object.entries(DATA_PATHS).map(async ([key, path]) => {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to load ${path}`);
            return [key, await response.json()];
        }));
        return Object.fromEntries(entries);
    }

    function runLine(line) {
        append("dim", `${runtime.state.cwd} $ ${line}`);
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
        saveAndRender();
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
        dom.room.innerHTML = `<p><strong>${escapeHtml(meta.title || runtime.state.cwd)}</strong></p><p class="kind-dim">${escapeHtml(runtime.state.cwd)}</p><p>${entries || "(empty)"}</p>`;
    }

    function renderPrompt() {
        dom.prompt.textContent = `${runtime.state.cwd} $`;
    }

    function renderLog() {
        dom.log.innerHTML = logLines.map((line) => `<span class="kind-${line.kind || "output"}">${escapeHtml(line.text)}</span>`).join("\n");
        dom.log.scrollTop = dom.log.scrollHeight;
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
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("bashcrawl-web-theme", next);
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }
})();
