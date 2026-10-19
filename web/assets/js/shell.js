/* Bashcrawl Shell — top-level mode router: Story · Learn · Arcade · Reference.
 *
 * Owns the nav tabs, the landing/onboarding overlay, hash routing
 * (#/story #/learn #/arcade #/reference), input routing to the Practice
 * Arcade, and the XP bridge that lets arcade wins feed the story hero. Learn
 * is a layout over the story section — the same runtime and log, plus the
 * lesson reader (learn.js) — so the prompt keeps working in both. Loads last
 * so it can see every other module; waits for game.js to announce readiness
 * via the `bashcrawl:ready` event (which carries the loaded data bundle).
 */
(function initShell(global) {
    const PREFS_KEY = "bashcrawl-web-shell-v1";
    const MODES = ["story", "learn", "arcade", "reference"];
    const FOOTER_HINTS = {
        story: "Story: explore the dungeon with real commands",
        learn: "Learn: read on the left, type on the right · lesson hint when stuck",
        arcade: "Arcade: quit abandons a trial · hint helps (score cost)",
        reference: "Reference: click any command to copy it",
    };

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
        learnReader: document.getElementById("learn-reader"),
    };

    const prefs = global.BashcrawlStorage.loadKey(PREFS_KEY, { mode: null, onboarded: false });
    let currentMode = "story";
    let arcade = null;
    let reference = null;
    let learnView = null;
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

    // Story and Learn share the story runtime, log and prompt.
    function storyOwnsInput() {
        return currentMode === "story" || currentMode === "learn";
    }

    // A section fading in as it takes the screen (CSS gates it on
    // prefers-reduced-motion; the class is inert otherwise).
    function animateEnter(section) {
        if (!section || section.hidden) return;
        section.classList.remove("mode-enter");
        void section.offsetWidth;
        section.classList.add("mode-enter");
        section.addEventListener("animationend", () => section.classList.remove("mode-enter"), { once: true });
    }

    function setMode(next, { updateHash = true } = {}) {
        if (global.BashcrawlCommandFx) {
            document.querySelectorAll(".tui-content").forEach(global.BashcrawlCommandFx.clearStage);
        }
        if (!MODES.includes(next)) next = "story";
        const changed = next !== currentMode;
        currentMode = next;
        if (reference) reference.renderInlineHint();
        const storyish = next === "story" || next === "learn";
        if (dom.story) {
            dom.story.hidden = !storyish;
            dom.story.classList.toggle("layout-learn", next === "learn");
        }
        if (dom.learnReader) dom.learnReader.hidden = next !== "learn";
        if (dom.arcade) dom.arcade.hidden = next !== "arcade";
        if (dom.reference) dom.reference.hidden = next !== "reference";
        if (dom.inputRow) dom.inputRow.hidden = next === "reference";
        if (changed) animateEnter(storyish ? dom.story : next === "arcade" ? dom.arcade : dom.reference);
        if (dom.nav) {
            dom.nav.querySelectorAll("[data-mode]").forEach((btn) => {
                const on = btn.dataset.mode === next;
                btn.classList.toggle("mode-tab-on", on);
                btn.setAttribute("aria-selected", String(on));
            });
        }
        if (dom.footerHint) dom.footerHint.textContent = FOOTER_HINTS[next];
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
        if (next === "learn" && learnView && global.BashcrawlGame) learnView.render(global.BashcrawlGame.getRuntime());
        if (storyish) setPrompt(storyPrompt, { fromStory: true });
        if (next === "arcade" && arcade) setPrompt(arcade.promptLabel());
        if (next !== "reference" && dom.input) dom.input.focus();
    }

    function setPrompt(label, { fromStory = false } = {}) {
        if (fromStory) storyPrompt = label;
        // Only paint the prompt for the mode that owns the input right now.
        if (!dom.prompt) return;
        if ((fromStory && storyOwnsInput()) || (!fromStory && currentMode === "arcade")) {
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

    // ── page art ────────────────────────────────────────────────────────
    // Art in the page shell (<pre data-art="name">) is drawn from the same
    // ASCII Motion clips as the game (motion/art/, bundled in art-clips.js).
    // A multi-frame clip plays once (ambient.js); a still is painted as is.
    function paintArt(root) {
        const am = global.TermForge && global.TermForge.asciiMotion;
        const ambient = global.BashcrawlAmbient;
        const clips = global.BashcrawlArtClips || {};
        if (!am || !root) return;
        root.querySelectorAll("[data-art]").forEach((node) => {
            const source = clips[node.dataset.art];
            if (!source) return;
            if (ambient && ambient.once(node, source)) return;
            try {
                node.textContent = am.renderFrame(am.parse(source), 0).text;
            } catch (_err) {
                node.textContent = "";
            }
        });
    }

    // ── landing overlay ─────────────────────────────────────────────────
    function showLanding() {
        if (!dom.landing) return;
        paintArt(dom.landing);
        dom.landing.hidden = false;
        let chosen = false;
        const choose = (launch) => {
            if (chosen) return;
            chosen = true;
            prefs.onboarded = true;
            global.BashcrawlStorage.saveKey(PREFS_KEY, prefs);
            setMode(launch);
            // Fade the overlay out over the mode it opened (CSS keyframe;
            // under reduced motion the animation never starts, so hide now).
            const reduced = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (reduced) { dom.landing.hidden = true; return; }
            dom.landing.classList.add("is-leaving");
            const done = () => { dom.landing.hidden = true; dom.landing.classList.remove("is-leaving"); };
            dom.landing.addEventListener("animationend", done, { once: true });
            setTimeout(done, 600);
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
        if (global.BashcrawlLearn) learnView = new global.BashcrawlLearn.LearnView({ reader: dom.learnReader });
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
            const target = { "1": "story", "2": "learn", "3": "arcade", "4": "reference" }[event.key];
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

    global.BashcrawlShell = { mode, setMode, storyOwnsInput, handleInput, awardXp, toast, setPrompt, completions, clearLog,
        onStoryRender(runtime) {
            if (reference) reference.renderSpotlight(runtime);
            if (learnView && currentMode === "learn") learnView.render(runtime);
        },
    };
})(window);
