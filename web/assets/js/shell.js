/* Bashcrawl Shell — top-level mode router: Story · Arcade · Reference.
 *
 * Owns the nav tabs, the landing/onboarding overlay, hash routing
 * (#/story #/arcade #/reference), input routing to the Practice Arcade, and
 * the XP bridge that lets arcade wins feed the story hero. Loads last so it
 * can see every other module; waits for game.js to announce readiness via the
 * `bashcrawl:ready` event (which carries the loaded data bundle).
 */
(function initShell(global) {
    const PREFS_KEY = "bashcrawl-web-shell-v1";
    const MODES = ["story", "arcade", "reference"];

    const dom = {
        nav: document.getElementById("mode-nav"),
        story: document.getElementById("mode-story"),
        arcade: document.getElementById("mode-arcade"),
        reference: document.getElementById("mode-reference"),
        inputRow: document.getElementById("command-form"),
        input: document.getElementById("command-input"),
        prompt: document.getElementById("prompt-label"),
        inlineHint: document.getElementById("inline-hint"),
        landing: document.getElementById("landing-overlay"),
        footerHint: document.getElementById("footer-mode-hint"),
    };

    const prefs = global.BashcrawlStorage.loadKey(PREFS_KEY, { mode: null, onboarded: false });
    let currentMode = "story";
    let arcade = null;
    let reference = null;
    let gameData = null;
    let storyPrompt = "$";

    // ── toast ───────────────────────────────────────────────────────────
    let toastTimer = null;
    function toast(message) {
        let el = document.getElementById("bc-toast");
        if (!el) {
            el = document.createElement("div");
            el.id = "bc-toast";
            el.setAttribute("role", "status");
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.add("bc-toast-show");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("bc-toast-show"), 2600);
    }

    // ── mode switching ──────────────────────────────────────────────────
    function mode() {
        return currentMode;
    }

    function setMode(next, { updateHash = true } = {}) {
        if (!MODES.includes(next)) next = "story";
        currentMode = next;
        if (dom.story) dom.story.hidden = next !== "story";
        if (dom.arcade) dom.arcade.hidden = next !== "arcade";
        if (dom.reference) dom.reference.hidden = next !== "reference";
        if (dom.inputRow) dom.inputRow.hidden = next === "reference";
        if (dom.nav) {
            dom.nav.querySelectorAll("[data-mode]").forEach((btn) => {
                const on = btn.dataset.mode === next;
                btn.classList.toggle("mode-tab-on", on);
                btn.setAttribute("aria-selected", String(on));
            });
        }
        if (dom.footerHint) {
            dom.footerHint.textContent = next === "story"
                ? "Story: explore the dungeon with real commands"
                : next === "arcade"
                    ? "Arcade: quit abandons a trial · hint helps (score cost)"
                    : "Reference: click any command to copy it";
        }
        if (updateHash) {
            try { global.history.replaceState(null, "", `#/${next}`); } catch (_) { /* file:// quirk */ }
        }
        prefs.mode = next;
        global.BashcrawlStorage.saveKey(PREFS_KEY, prefs);

        if (next === "arcade" && arcade) {
            arcade.renderSide();
            if (!arcade.active) arcade.renderHome();
        }
        if (next === "reference" && reference) reference.render();
        if (next === "story") setPrompt(storyPrompt, { fromStory: true });
        if (next === "arcade" && arcade) setPrompt(arcade.promptLabel());
        if (next !== "reference" && dom.input) dom.input.focus();
    }

    function setPrompt(label, { fromStory = false } = {}) {
        if (fromStory) storyPrompt = label;
        // Only paint the prompt for the mode that owns the input right now.
        if (!dom.prompt) return;
        if ((fromStory && currentMode === "story") || (!fromStory && currentMode === "arcade")) {
            dom.prompt.textContent = label;
        }
    }

    // ── input routing (game.js delegates non-story lines here) ──────────
    function handleInput(line) {
        if (currentMode === "arcade" && arcade) {
            arcade.input(line);
            return true;
        }
        return false;
    }

    // Mode-aware Tab completion (game.js hook): null → story owns completion;
    // otherwise the arcade's scoped runtime supplies candidates and we echo
    // multi-candidate lists into the ARCADE log ourselves — game.js only
    // fills a single match into the shared input field.
    function completions(text) {
        if (currentMode !== "arcade" || !arcade) return null;
        const list = arcade.completions(text) || [];
        if (list.length > 1) arcade.echoInfo(list.join("  "));
        return { list };
    }

    // Mode-aware Ctrl+L (game.js hook): true when a non-story mode consumed
    // the clear (so the story log is left untouched).
    function clearLog() {
        if (currentMode === "arcade" && arcade) {
            arcade.clearLog();
            return true;
        }
        return false;
    }

    // ── XP bridge: arcade wins feed the story hero ──────────────────────
    function awardXp(amount, label) {
        const game = global.BashcrawlGame;
        if (!game || !amount) return;
        const runtime = game.getRuntime();
        runtime.state.xp += amount;
        game.saveAndRender();
        toast(`+${amount} XP — ${label}`);
    }

    // ── landing overlay ─────────────────────────────────────────────────
    function showLanding() {
        if (!dom.landing) return;
        dom.landing.hidden = false;
        const choose = (launch) => {
            prefs.onboarded = true;
            global.BashcrawlStorage.saveKey(PREFS_KEY, prefs);
            dom.landing.hidden = true;
            setMode(launch);
        };
        const doors = dom.landing.querySelectorAll("[data-launch]");
        doors.forEach((btn) => {
            btn.addEventListener("click", () => choose(btn.dataset.launch), { once: true });
        });
        // Escape dismisses the dialog to the default door (story).
        dom.landing.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                choose("story");
            }
        });
        // Move focus into the dialog so keyboard users land on a door.
        if (doors.length) doors[0].focus();
    }

    // ── boot ────────────────────────────────────────────────────────────
    async function boot(data) {
        gameData = data;

        // Load the arcade bundle (not part of game.js's data set).
        let arcadeData = { pipe_puzzles: [], hunt_scenarios: [], flash_decks: [] };
        try {
            const response = await fetch("./data/arcade.json");
            if (response.ok) arcadeData = await response.json();
        } catch (_) { /* arcade degrades to empty gracefully */ }

        arcade = new global.BashcrawlArcade.ArcadeManager();
        arcade.init(
            { world: data.world, commands: data.commands, arcade: arcadeData },
            {
                home: document.getElementById("arcade-home"),
                log: document.getElementById("arcade-log"),
                objective: document.getElementById("arcade-objective"),
                stats: document.getElementById("arcade-stats"),
                best: document.getElementById("arcade-best"),
                cheats: document.getElementById("arcade-cheats"),
            },
            { awardXp, toast, setPrompt }
        );

        reference = new global.BashcrawlReference.ReferencePanel({
            content: document.getElementById("reference-content"),
            search: document.getElementById("ref-search"),
            spotlight: document.getElementById("spotlight-panel"),
            inlineHint: dom.inlineHint,
            input: dom.input,
        });
        reference.init(data);
        // The first story render happened before this boot — paint the
        // spotlight for the starting room now.
        if (global.BashcrawlGame) reference.renderSpotlight(global.BashcrawlGame.getRuntime());

        // Nav tabs + keyboard shortcuts.
        if (dom.nav) {
            dom.nav.querySelectorAll("[data-mode]").forEach((btn) => {
                btn.addEventListener("click", () => setMode(btn.dataset.mode));
            });
        }
        document.addEventListener("keydown", (event) => {
            if (!event.altKey || event.ctrlKey || event.metaKey) return;
            const target = { "1": "story", "2": "arcade", "3": "reference" }[event.key];
            if (target) {
                event.preventDefault();
                setMode(target);
            }
        });
        global.addEventListener("hashchange", () => {
            const fromHash = (global.location.hash.match(/^#\/(\w+)/) || [])[1];
            if (fromHash && MODES.includes(fromHash) && fromHash !== currentMode) setMode(fromHash, { updateHash: false });
        });

        // Initial mode: URL hash > saved pref > story. First-timers get the landing.
        const fromHash = (global.location.hash.match(/^#\/(\w+)/) || [])[1];
        const initial = MODES.includes(fromHash) ? fromHash : (MODES.includes(prefs.mode) ? prefs.mode : "story");
        setMode(initial, { updateHash: !fromHash });
        if (!prefs.onboarded && !fromHash) showLanding();
    }

    // game.js announces readiness (and hands over the loaded data bundle).
    if (global.BashcrawlGame && global.BashcrawlGame.data) {
        boot(global.BashcrawlGame.data);
    } else {
        document.addEventListener("bashcrawl:ready", (event) => boot(event.detail.data), { once: true });
    }

    global.BashcrawlShell = { mode, setMode, handleInput, awardXp, toast, setPrompt, completions, clearLog,
        onStoryRender(runtime) {
            if (reference) reference.renderSpotlight(runtime);
        },
    };
})(window);
