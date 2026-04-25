(function initBashcrawlLiteDemo() {
    const STORAGE_KEY = "bashcrawl-lite-demo-state-v1";
    const MAX_LOG_LINES = 500;
    const DATA = window.BashcrawlLiteData || {};
    const QUESTS = Array.isArray(DATA.QUESTS) ? DATA.QUESTS : [];
    const FILES = DATA.FILES || {};
    const WORLD = DATA.WORLD || {};
    const COMMANDS = Array.isArray(DATA.COMMANDS) ? DATA.COMMANDS : [];

    const dom = {
        subtitle: document.getElementById("lite-subtitle"),
        quest: document.getElementById("quest-panel"),
        inventory: document.getElementById("inventory-panel"),
        room: document.getElementById("room-panel"),
        log: document.getElementById("output-log"),
        prompt: document.getElementById("prompt-label"),
        input: document.getElementById("command-input"),
    };

    if (!dom.input || !dom.log) {
        return;
    }

    let state = loadState();
    let logLines = [];

    if (!state.stats.initialized) {
        append("info", "⚔️ Welcome to Bashcrawl Lite.");
        append("dim", "This browser demo mirrors the TUI layout and first dungeon path.");
        append("dim", "Start with: pwd, ls, cat scroll, cd cellar");
        state.stats.initialized = true;
        persist();
    } else {
        append("dim", "Resumed previous Lite Demo session from browser storage.");
    }

    render();
    dom.input.focus();

    dom.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const line = dom.input.value.trim();
            dom.input.value = "";
            state.historyIndex = -1;
            if (!line) {
                return;
            }
            handleCommand(line);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            historyUp();
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            historyDown();
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();
            completeInput();
        }
    });

    function defaultState() {
        return {
            mode: "classic",
            playerName: "Adventurer",
            cwd: "/entrance",
            hp: 100,
            xp: 0,
            inventory: [],
            aliases: {},
            envVars: {},
            completedQuestIds: [],
            currentQuestId: 0,
            flags: {
                cellarTreasure: false,
                armouryTreasure: false,
                potionTaken: false,
                statueDefeated: false,
            },
            history: [],
            historyIndex: -1,
            stats: {
                initialized: false,
                commands: {},
                catScrollCount: 0,
            },
        };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return defaultState();
            }
            const parsed = JSON.parse(raw);
            return { ...defaultState(), ...parsed, stats: { ...defaultState().stats, ...(parsed.stats || {}) } };
        } catch (_) {
            return defaultState();
        }
    }

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function render() {
        renderHeader();
        renderQuestPanel();
        renderInventoryPanel();
        renderRoomPanel();
        renderPrompt();
        renderLog();
        persist();
    }

    function renderHeader() {
        dom.subtitle.textContent = `${state.playerName} • HP: ${state.hp} • XP: ${state.xp} • ${state.mode}`;
    }

    function renderQuestPanel() {
        const total = QUESTS.length;
        const done = state.completedQuestIds.length;
        let html = `<div><strong>XP:</strong> ${state.xp} &nbsp; <strong>✅</strong> ${done}/${total}</div>`;
        html += '<div class="lite-dim" style="margin-top: 0.4rem;">──────────────────────────</div>';
        if (state.currentQuestId >= total) {
            html += '<div class="lite-success" style="margin-top: 0.5rem;">All quests complete! Explore freely.</div>';
        } else {
            const q = QUESTS[state.currentQuestId];
            html += `<div style="margin-top:0.55rem;"><strong>${escapeHtml(q.title)}</strong></div>`;
            html += `<div class="lite-dim" style="margin-top:0.3rem;">${escapeHtml(q.objective)}</div>`;
        }
        dom.quest.innerHTML = html;
    }

    function renderInventoryPanel() {
        const filled = Math.max(0, Math.min(10, Math.floor(state.hp / 10)));
        const empty = 10 - filled;
        const hpBar = `${"█".repeat(filled)}${"░".repeat(empty)}`;
        const hpClass = state.hp > 50 ? "lite-success" : state.hp > 20 ? "lite-magic" : "lite-error";
        const items = state.inventory.length
            ? state.inventory.map((item) => `◆ ${escapeHtml(item)}`).join("<br>")
            : "<span class='lite-dim'>(empty)</span>";
        dom.inventory.innerHTML = [
            `<div><strong>HP:</strong> <span class="${hpClass}">${hpBar}</span> <span class="lite-dim">${state.hp}/100</span></div>`,
            "<div style='margin-top: 0.55rem;'><strong>Items:</strong></div>",
            `<div style='margin-top: 0.3rem;'>${items}</div>`,
        ].join("");
    }

    function renderRoomPanel() {
        const items = getDirEntries(state.cwd);
        const lines = items.map((entry) => {
            if (entry.type === "dir") {
                return `📁 ${escapeHtml(entry.name)}/`;
            }
            if (entry.type === "exec") {
                return `⚡ ${escapeHtml(entry.name)}*`;
            }
            return `📄 ${escapeHtml(entry.name)}`;
        });

        dom.room.innerHTML = [
            `<div><strong>${escapeHtml(state.cwd)}</strong></div>`,
            "<div class='lite-dim' style='margin-top:0.45rem;'>──────────────────────────</div>",
            `<div style='margin-top:0.55rem;'>${lines.length ? lines.join("<br>") : "<span class='lite-dim'>(empty)</span>"}</div>`,
        ].join("");
    }

    function renderPrompt() {
        dom.prompt.textContent = `${state.cwd} $`;
    }

    function renderLog() {
        const html = logLines.map((line) => {
            const cls = classForKind(line.kind);
            return `<span class="${cls}">${escapeHtml(line.text)}</span>`;
        }).join("\n");
        dom.log.innerHTML = html;
        dom.log.scrollTop = dom.log.scrollHeight;
    }

    function classForKind(kind) {
        if (kind === "error") return "lite-error";
        if (kind === "success") return "lite-success";
        if (kind === "info") return "lite-info";
        if (kind === "magic") return "lite-magic";
        if (kind === "dim") return "lite-dim";
        return "lite-output";
    }

    function append(kind, text) {
        const lines = String(text).split("\n");
        for (const line of lines) {
            logLines.push({ kind, text: line });
        }
        if (logLines.length > MAX_LOG_LINES) {
            logLines = logLines.slice(logLines.length - MAX_LOG_LINES);
        }
    }

    function handleCommand(rawLine) {
        const line = applyAlias(rawLine);
        append("dim", `${state.cwd} $ ${rawLine}`);

        if (!state.history.length || state.history[state.history.length - 1] !== rawLine) {
            state.history.push(rawLine);
        }

        const tokens = tokenize(line);
        if (!tokens.length) {
            render();
            return;
        }

        const cmd = tokens[0];
        const args = tokens.slice(1);
        bumpStat(cmd);

        if (cmd.startsWith("./")) {
            runScript(cmd.slice(2));
            maybeAdvanceQuest();
            render();
            return;
        }

        switch (cmd) {
            case "help":
                append("info", [
                    "Available commands:",
                    "  help, pwd, ls, cd, cat, grep, echo, export, let, alias",
                    "  status, quest, inventory, health, clear, reset",
                    "",
                    "Run room scripts with dot-slash, e.g.: ./treasure  ./potion  ./statue",
                ].join("\n"));
                break;
            case "pwd":
                append("output", state.cwd);
                break;
            case "ls":
                cmdLs(args);
                break;
            case "cd":
                cmdCd(args);
                break;
            case "cat":
                cmdCat(args);
                break;
            case "grep":
                cmdGrep(args);
                break;
            case "echo":
                append("output", expandVars(args.join(" ")));
                break;
            case "export":
                cmdExport(args);
                break;
            case "let":
                cmdLet(args);
                break;
            case "alias":
                cmdAlias(args);
                break;
            case "status":
                append("info", statusText());
                break;
            case "quest":
                append("info", questText());
                break;
            case "inventory":
                append("output", state.inventory.length ? state.inventory.join(",") : "(empty)");
                break;
            case "health":
                append("output", `HP=${state.hp}`);
                break;
            case "clear":
                logLines = [];
                append("dim", "Log cleared.");
                break;
            case "reset":
                state = defaultState();
                logLines = [];
                append("info", "Session reset. Welcome back to the entrance.");
                break;
            default:
                append("error", `Unknown command: ${cmd}. Try 'help'.`);
                break;
        }

        maybeAdvanceQuest();
        render();
    }

    function cmdLs(args) {
        let showMarkers = false;
        let target = "";

        for (const arg of args) {
            if (arg.startsWith("-")) {
                if (arg.includes("F")) {
                    showMarkers = true;
                }
            } else if (!target) {
                target = arg;
            }
        }

        const path = target ? resolvePath(state.cwd, target) : state.cwd;
        if (!WORLD[path]) {
            append("error", `Not a directory: ${target}`);
            return;
        }
        const output = getDirEntries(path).map((entry) => {
            if (!showMarkers) {
                return entry.name;
            }
            if (entry.type === "dir") {
                return `${entry.name}/`;
            }
            if (entry.type === "exec") {
                return `${entry.name}*`;
            }
            return entry.name;
        });
        append("output", output.length ? output.join("  ") : "(empty)");
    }

    function cmdCd(args) {
        if (!args.length) {
            append("error", "cd requires a path");
            return;
        }
        const next = resolvePath(state.cwd, args[0]);
        if (!WORLD[next]) {
            append("error", `Not a directory: ${args[0]}`);
            return;
        }
        state.cwd = next;
        append("success", `Moved to ${state.cwd}`);
    }

    function cmdCat(args) {
        if (!args.length) {
            append("error", "cat requires a file path");
            return;
        }
        const entry = findEntry(state.cwd, args[0]);
        if (!entry) {
            append("error", `No such file: ${args[0]}`);
            return;
        }
        if (entry.type === "dir") {
            append("error", `Is a directory: ${args[0]}`);
            return;
        }
        if (entry.type === "exec") {
            append("info", `Executable script: ${entry.name}\nRun it with ./${entry.name}`);
            return;
        }
        const filePath = `${state.cwd}/${entry.name}`.replace(/\/+/g, "/");
        append("output", FILES[filePath] || "(empty)");
        if (entry.name === "scroll") {
            state.stats.catScrollCount = (state.stats.catScrollCount || 0) + 1;
        }
    }

    function cmdGrep(args) {
        if (args.length < 2) {
            append("error", "grep requires a pattern and file path");
            return;
        }
        const pattern = args[0];
        const entry = findEntry(state.cwd, args[1]);
        if (!entry || entry.type !== "file") {
            append("error", `No such file: ${args[1]}`);
            return;
        }
        const filePath = `${state.cwd}/${entry.name}`.replace(/\/+/g, "/");
        const text = FILES[filePath] || "";
        const matches = text.split("\n").filter((line) => line.includes(pattern));
        append("output", matches.length ? matches.join("\n") : `(no matches for '${pattern}')`);
    }

    function cmdExport(args) {
        if (!args.length) {
            append("error", "export requires VAR=value");
            return;
        }
        const joined = args.join(" ");
        const idx = joined.indexOf("=");
        if (idx < 1) {
            append("error", "Usage: export VAR=value");
            return;
        }
        const key = joined.slice(0, idx).trim();
        const raw = joined.slice(idx + 1).trim();
        const value = expandVars(raw);
        setVar(key, value);
        append("success", `Exported ${key}=${value}`);
    }

    function cmdLet(args) {
        if (!args.length) {
            append("error", "Usage: let \"HP=HP-5\"");
            return;
        }
        const expr = stripQuotes(args.join(" "));
        const match = expr.match(/^([A-Za-z_]\w*)\s*=\s*\1\s*([+-])\s*(\d+)$/);
        if (!match) {
            append("error", "Only + and - arithmetic is supported in this demo.");
            return;
        }
        const key = match[1];
        const op = match[2];
        const amount = Number(match[3]);
        const start = Number(getVar(key) || "0");
        const next = op === "+" ? start + amount : start - amount;
        setVar(key, String(next));
        append("success", `${key}=${next}`);
    }

    function cmdAlias(args) {
        if (!args.length) {
            const aliases = Object.keys(state.aliases);
            if (!aliases.length) {
                append("output", "(no aliases)");
                return;
            }
            append("output", aliases.map((k) => `alias ${k}='${state.aliases[k]}'`).join("\n"));
            return;
        }

        const assignment = args.join(" ");
        const idx = assignment.indexOf("=");
        if (idx === -1) {
            const name = assignment.trim();
            if (state.aliases[name]) {
                append("output", `alias ${name}='${state.aliases[name]}'`);
            } else {
                append("error", `alias: ${name}: not found`);
            }
            return;
        }

        const name = assignment.slice(0, idx).trim();
        const rawValue = assignment.slice(idx + 1).trim();
        const value = stripQuotes(rawValue);
        state.aliases[name] = value;
        append("success", `Alias set: ${name}='${value}'`);
    }

    function runScript(name) {
        const where = state.cwd;

        if (name === "treasure" && where === "/entrance/cellar") {
            if (state.flags.cellarTreasure) {
                append("info", "This treasure has already been taken.");
                return;
            }
            addInventory("amulet");
            state.flags.cellarTreasure = true;
            append("success", "You found an emerald amulet. Inventory updated.");
            return;
        }

        if (name === "treasure" && where === "/entrance/cellar/armoury") {
            if (state.flags.armouryTreasure) {
                append("info", "This treasure has already been taken.");
                return;
            }
            addInventory("sword");
            state.flags.armouryTreasure = true;
            append("success", "You found a silver sword. Inventory updated.");
            return;
        }

        if (name === "potion" && where === "/entrance/cellar/armoury") {
            if (state.flags.potionTaken) {
                append("info", "You already checked that potion bottle.");
                return;
            }
            state.flags.potionTaken = true;
            state.hp = 15;
            setVar("HP", "15");
            append("success", "You drink the potion and set HP to 15.");
            return;
        }

        if (name === "statue" && where === "/entrance/cellar/armoury/chamber") {
            if (state.flags.statueDefeated) {
                append("info", "The statue lies shattered. Nothing more to do here.");
                return;
            }

            state.hp = Math.max(0, state.hp - 5);
            setVar("HP", String(state.hp));
            if (!hasInventory("sword")) {
                state.hp = Math.max(0, state.hp - 5);
                setVar("HP", String(state.hp));
                append("error", "The statue strikes you down. No sword, no victory. (HP -10)");
                return;
            }

            state.hp = Math.max(0, state.hp - 5);
            setVar("HP", String(state.hp));
            state.flags.statueDefeated = true;
            addInventory("diamonds");
            append("magic", "You shatter the statue and claim diamonds. (HP -10 total)");
            return;
        }

        append("error", `Unknown script here: ./${name}`);
    }

    function maybeAdvanceQuest() {
        while (state.currentQuestId < QUESTS.length) {
            const q = QUESTS[state.currentQuestId];
            if (!q.isComplete(state)) {
                return;
            }
            if (!state.completedQuestIds.includes(q.id)) {
                state.completedQuestIds.push(q.id);
                state.xp += q.rewardXp;
                append("magic", `Quest complete: ${q.title} (+${q.rewardXp} XP)`);
            }
            state.currentQuestId += 1;
        }
    }

    function questText() {
        const done = state.completedQuestIds.length;
        if (state.currentQuestId >= QUESTS.length) {
            return `All quests complete (${done}/${QUESTS.length}).`;
        }
        const q = QUESTS[state.currentQuestId];
        return `${q.title}\n${q.objective}\n\nProgress: ${done}/${QUESTS.length}`;
    }

    function statusText() {
        return [
            `Player: ${state.playerName}`,
            `Mode: ${state.mode}`,
            `Location: ${state.cwd}`,
            `HP: ${state.hp}`,
            `XP: ${state.xp}`,
            `Inventory: ${state.inventory.length ? state.inventory.join(",") : "(empty)"}`,
            `Quest: ${state.currentQuestId < QUESTS.length ? QUESTS[state.currentQuestId].title : "complete"}`,
        ].join("\n");
    }

    function tokenize(text) {
        return text.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    }

    function stripQuotes(value) {
        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }
        return value;
    }

    function applyAlias(line) {
        const parts = tokenize(line);
        if (!parts.length) {
            return line;
        }
        const alias = state.aliases[parts[0]];
        if (!alias) {
            return line;
        }
        return [alias, ...parts.slice(1)].join(" ");
    }

    function resolvePath(base, target) {
        const source = target.startsWith("/") ? target : `${base}/${target}`;
        const parts = source.split("/").filter(Boolean);
        const stack = [];
        for (const part of parts) {
            if (part === ".") {
                continue;
            }
            if (part === "..") {
                stack.pop();
                continue;
            }
            stack.push(part);
        }
        return `/${stack.join("/")}` || "/";
    }

    function getDirEntries(path) {
        return (WORLD[path] || []).slice();
    }

    function findEntry(cwd, rawName) {
        const entries = getDirEntries(cwd);
        return entries.find((e) => e.name === rawName) || null;
    }

    function addInventory(item) {
        if (!state.inventory.includes(item)) {
            state.inventory.unshift(item);
        }
        setVar("I", state.inventory.join(","));
    }

    function hasInventory(item) {
        return state.inventory.includes(item);
    }

    function getVar(name) {
        if (name === "HP") {
            return String(state.hp);
        }
        if (name === "I") {
            return state.inventory.join(",");
        }
        return state.envVars[name] || "";
    }

    function setVar(name, value) {
        if (name === "HP") {
            state.hp = Number(value);
        } else if (name === "I") {
            state.inventory = value.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
            state.envVars[name] = value;
        }
    }

    function expandVars(text) {
        return text.replace(/\$([A-Za-z_]\w*)/g, (_, key) => getVar(key));
    }

    function bumpStat(cmd) {
        state.stats.commands[cmd] = (state.stats.commands[cmd] || 0) + 1;
    }

    function historyUp() {
        if (!state.history.length) {
            return;
        }
        if (state.historyIndex === -1) {
            state.historyIndex = state.history.length - 1;
        } else if (state.historyIndex > 0) {
            state.historyIndex -= 1;
        }
        dom.input.value = state.history[state.historyIndex];
        dom.input.setSelectionRange(dom.input.value.length, dom.input.value.length);
    }

    function historyDown() {
        if (state.historyIndex === -1) {
            return;
        }
        state.historyIndex += 1;
        if (state.historyIndex >= state.history.length) {
            state.historyIndex = -1;
            dom.input.value = "";
            return;
        }
        dom.input.value = state.history[state.historyIndex];
        dom.input.setSelectionRange(dom.input.value.length, dom.input.value.length);
    }

    function completeInput() {
        const value = dom.input.value;
        const completions = getCompletions(value);
        if (!completions.length) {
            return;
        }

        const parts = value.split(/\s+/);
        const last = value.endsWith(" ") ? "" : (parts[parts.length - 1] || "");
        const prefix = last ? value.slice(0, value.length - last.length) : value;

        if (completions.length === 1) {
            const suffix = completions[0].endsWith("/") ? "" : " ";
            dom.input.value = `${prefix}${completions[0]}${suffix}`;
            return;
        }

        const common = longestCommonPrefix(completions);
        if (common.length > last.length) {
            dom.input.value = `${prefix}${common}`;
        } else {
            append("dim", completions.join("   "));
            renderLog();
        }
    }

    function getCompletions(text) {
        const parts = text.trimStart().split(/\s+/);
        const first = parts[0] || "";

        if (parts.length <= 1 && !text.includes(" ")) {
            const commandHits = COMMANDS.filter((c) => c.startsWith(first));
            const pathHits = getDirEntries(state.cwd)
                .map((entry) => entry.type === "dir" ? `${entry.name}/` : entry.name)
                .filter((name) => name.startsWith(first));
            return [...new Set([...commandHits, ...pathHits])];
        }

        const last = text.endsWith(" ") ? "" : (parts[parts.length - 1] || "");
        const entries = getDirEntries(state.cwd)
            .map((entry) => entry.type === "dir" ? `${entry.name}/` : entry.name)
            .filter((name) => name.startsWith(last));
        return entries;
    }

    function longestCommonPrefix(items) {
        if (!items.length) {
            return "";
        }
        let prefix = items[0];
        for (let i = 1; i < items.length; i += 1) {
            while (!items[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
                if (!prefix) {
                    return "";
                }
            }
        }
        return prefix;
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
})();
