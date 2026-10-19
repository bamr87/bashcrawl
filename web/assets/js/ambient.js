/* Bashcrawl Ambient — ASCII Motion clips playing in the page itself.
 *
 * The command stage (fx.js) plays a clip once under the log. This module
 * plays clips everywhere else a picture sits: the room vignette in the
 * Location panel (a loop), the landing logo (a reveal), celebration art.
 * One timer per node; it pauses while the tab is hidden, stops when the
 * node leaves the document, and under prefers-reduced-motion paints the
 * clip's resting frame instead (a loop rests on its first frame, a reveal
 * on its last). Cells in the clip's default colour (#ffffff) inherit the
 * CSS colour, so a clip follows the theme and only its highlights carry
 * their own hue. Loads after fx.js; game.js and shell.js call it.
 */
(function initAmbient(global) {
    const INHERIT = "#ffffff";
    const states = new WeakMap(); // node -> { gen, timer, tick, pending }
    const active = new Set();

    function motion() {
        return global.TermForge && global.TermForge.asciiMotion;
    }

    function reduced() {
        return Boolean(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function cssColor(value) {
        return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || "")) ? value : "";
    }

    // Paint one rendered frame into a <pre>: runs of cells that share a
    // colour become one span, inherited cells stay text nodes.
    function paint(node, frame, opts) {
        const doc = global.document;
        const options = opts || {};
        const inherit = options.inherit || INHERIT;
        const width = options.width || frame.width || 0;
        const height = options.height || frame.height || 0;
        const map = new Map();
        for (const item of frame.cells || []) map.set(`${item.x},${item.y}`, item);
        node.replaceChildren();
        let run = "";
        let runColor = "";
        let runBg = "";
        const flush = () => {
            if (!run) return;
            if (runColor || runBg) {
                const span = doc.createElement("span");
                if (runColor) span.style.color = runColor;
                if (runBg) span.style.backgroundColor = runBg;
                span.textContent = run;
                node.appendChild(span);
            } else {
                node.appendChild(doc.createTextNode(run));
            }
            run = "";
        };
        for (let y = 0; y < height; y += 1) {
            if (y) { flush(); node.appendChild(doc.createTextNode("\n")); }
            for (let x = 0; x < width; x += 1) {
                const item = map.get(`${x},${y}`);
                const fg = item && item.color !== inherit ? cssColor(item.color) : "";
                const bg = item && item.bgColor !== "transparent" ? cssColor(item.bgColor) : "";
                if (fg !== runColor || bg !== runBg) { flush(); runColor = fg; runBg = bg; }
                run += item ? item.char : " ";
            }
        }
        flush();
    }

    function resolve(source) {
        const am = motion();
        if (!am || source == null) return null;
        try {
            return typeof source === "object" && source.format && Array.isArray(source.frames) ? source : am.parse(source);
        } catch (_err) {
            return null;
        }
    }

    function stop(node) {
        const st = node && states.get(node);
        active.delete(node);
        if (!st) return;
        st.gen += 1;
        if (st.timer) clearTimeout(st.timer);
        st.timer = null;
        states.delete(node);
    }

    function play(node, source, options) {
        const am = motion();
        const clip = resolve(source);
        if (!am || !node || !clip || !global.document) return null;
        stop(node);
        const opts = options || {};
        const looping = Boolean(opts.loop);
        const player = new am.Player({ clip, looping, speed: opts.speed || 1, effects: opts.effects });
        const frameOpts = { width: clip.width, height: clip.height, inherit: opts.inherit };
        if (reduced() || clip.frames.length < 2) {
            player.seek(looping ? 0 : Math.max(0, player.duration() - 1));
            paint(node, player.frame(), frameOpts);
            if (!looping && typeof opts.onDone === "function") opts.onDone();
            return clip;
        }
        const st = { gen: 0, timer: null, tick: null, pending: false, source, opts };
        states.set(node, st);
        active.add(node);
        const gen = st.gen;
        let painted = false;
        st.tick = () => {
            if (st.gen !== gen) return;
            // The first frame paints even before the node is attached (a
            // caller may build the picture and then insert it); afterwards a
            // detached node ends its loop.
            if (painted && !node.isConnected) { stop(node); return; }
            painted = true;
            const frame = player.frame();
            paint(node, frame, frameOpts);
            if (frame.done) {
                st.timer = null;
                active.delete(node);
                states.delete(node);
                if (typeof opts.onDone === "function") opts.onDone();
                return;
            }
            st.timer = setTimeout(() => {
                st.timer = null;
                if (st.gen !== gen) return;
                if (global.document.hidden) { st.pending = true; return; }
                player.advance(frame.hold);
                st.tick();
            }, Math.max(16, frame.hold || 80));
        };
        st.tick();
        return clip;
    }

    function loop(node, source, options) {
        return play(node, source, { ...(options || {}), loop: true });
    }

    function once(node, source, options) {
        return play(node, source, { ...(options || {}), loop: false });
    }

    function isPlaying(node) {
        return active.has(node);
    }

    // A hidden tab parks every clip on its current frame; coming back
    // resumes them. A switch to reduced motion restarts each on its rest
    // frame (play() handles the rest).
    if (global.document && global.document.addEventListener) {
        global.document.addEventListener("visibilitychange", () => {
            if (global.document.hidden) return;
            for (const node of [...active]) {
                const st = states.get(node);
                if (st && st.pending && st.tick) { st.pending = false; st.tick(); }
            }
        });
    }
    if (global.matchMedia) {
        global.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
            for (const node of [...active]) {
                const st = states.get(node);
                if (st) play(node, st.source, st.opts);
            }
        });
    }

    global.BashcrawlAmbient = { paint, play, loop, once, stop, isPlaying, INHERIT };
})(window);
