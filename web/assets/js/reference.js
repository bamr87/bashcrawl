/* Bashcrawl Reference — cheatsheet library, contextual concept spotlight, and
 * inline syntax hints.
 *
 * Three jobs, all fed by the generated bundle (commands.json / docs.json):
 *  1. Reference mode: a browsable, searchable cheatsheet built from the
 *     commands.yaml categories + quick_ref sheets + glossary.
 *  2. Concept spotlight: a story-sidebar card showing what the CURRENT room
 *     teaches (rooms.yaml `teaches` / `essential_commands`), so concepts are
 *     highlighted while the player navigates.
 *  3. Inline hint: a one-line syntax reminder under the prompt while typing.
 */
(function initReference(global) {
    const escapeHtml = global.TermForge.sinks.escapeHtml;

    // One-line syntax hints for the inline helper (command → syntax, note).
    const SYNTAX_HINTS = {
        pwd: ["pwd", "print the full path of where you stand"],
        ls: ["ls [-F|-la|-a] [dir]", "-F marks types · -a shows dotfiles · -la long form"],
        cd: ["cd <dir> · cd .. · cd -", "descend · go up · jump to previous room"],
        cat: ["cat <file>", "print a whole file"],
        less: ["less <file>", "page through a file"],
        head: ["head [-n N] <file>", "first N lines (default 10)"],
        tail: ["tail [-n N] <file>", "last N lines (default 10)"],
        wc: ["wc [-l] <file>", "count lines / words / characters"],
        grep: ["grep [-rilnvc] PATTERN [file...]", "-r search tree · -i any case · -l names only · -c count"],
        find: ["find <dir> -name \"GLOB\" [-type f|d]", "quote the glob so the shell doesn't eat it"],
        sort: ["sort [-r|-n|-u] <file>", "-r reverse · -n numeric · -u unique"],
        uniq: ["uniq [-c|-d]", "adjacent dupes — sort first! -c counts"],
        cut: ["cut -d DELIM -f LIST", "or cut -c LIST for characters"],
        tr: ["tr SET1 SET2 · tr -d SET", "translate or delete characters (pipe into it)"],
        sed: ["sed 's/old/new/g' [file]", "replace text on every line"],
        nl: ["nl <file>", "number lines"],
        rev: ["rev <file>", "mirror each line"],
        mkdir: ["mkdir <name>", "conjure a new room"],
        touch: ["touch <name>", "create an empty file"],
        cp: ["cp <src> <dest>", "duplicate a file"],
        mv: ["mv <src> <dest>", "move or rename"],
        rm: ["rm <file>", "destroy a file (no undo!)"],
        chmod: ["chmod +x <file>", "make a file executable"],
        echo: ["echo $VAR · echo text", "print text or a variable's value"],
        export: ["export NAME=value", "set a variable for later commands"],
        let: ["let \"HP=HP-5\"", "shell arithmetic"],
        env: ["env", "list every environment variable"],
        man: ["man <command>", "read a command's manual"],
        tree: ["tree [dir]", "draw the directory layout"],
        history: ["history", "your past incantations"],
        ln: ["ln -s TARGET NAME", "forge a symbolic link"],
        alias: ["alias name='command'", "shorthand for a longer spell"],
    };

    class ReferencePanel {
        constructor(dom) {
            // dom: { content, search, spotlight, inlineHint, input }
            this.dom = dom;
            this.data = null;
            this.query = "";
            this.category = "all";
        }

        init(data) {
            this.data = data;
            if (this.dom.search) {
                this.dom.search.addEventListener("input", () => {
                    this.query = this.dom.search.value.trim().toLowerCase();
                    this.render();
                });
            }
            if (this.dom.input && this.dom.inlineHint) {
                this.dom.input.addEventListener("input", () => this.renderInlineHint());
            }
            this.render();
        }

        // ── Reference mode (full-page cheatsheets) ───────────────────────
        matches(...fields) {
            if (!this.query) return true;
            return fields.some((f) => String(f || "").toLowerCase().includes(this.query));
        }

        render() {
            if (!this.dom.content || !this.data) return;
            const categories = (this.data.commands && this.data.commands.categories) || {};
            const quickRef = (this.data.commands && this.data.commands.quick_ref) || {};
            const glossary = (this.data.docs && this.data.docs.glossary) || [];
            const parts = [];

            // Category chips (filter)
            const keys = Object.keys(categories);
            const chips = ["all", ...keys].map((key) => {
                const label = key === "all" ? "All" : (categories[key].title || key);
                const active = this.category === key ? " chip-on" : "";
                return `<button type="button" class="chip chip-action${active}" data-cat="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
            }).join(" ");
            parts.push(`<div class="ref-chips" role="tablist" aria-label="Command categories">${chips}</div>`);

            // Command category cards
            for (const [key, category] of Object.entries(categories)) {
                if (this.category !== "all" && this.category !== key) continue;
                const rows = (category.commands || [])
                    .filter((c) => this.matches(c.command, c.description))
                    .map((c) => `<tr><td><code class="ref-cmd" data-copy="${escapeHtml(c.command)}" title="Click to copy">${escapeHtml(c.command)}</code></td><td>${escapeHtml(c.description)}</td></tr>`)
                    .join("");
                if (!rows) continue;
                parts.push(`<section class="ref-card">
                    <h3>${escapeHtml(category.title || key)}</h3>
                    <div class="ref-table-wrap"><table class="ref-table"><tbody>${rows}</tbody></table></div>
                </section>`);
            }

            // Quick-ref sheets (only in "all" view or when searching)
            if (this.category === "all") {
                for (const sheet of Object.values(quickRef)) {
                    const sections = (sheet.sections || []).map((section) => {
                        const items = (section.items || [])
                            .filter((i) => this.matches(i.cmd, i.desc))
                            .map((i) => `<tr><td><code class="ref-cmd" data-copy="${escapeHtml(i.cmd)}" title="Click to copy">${escapeHtml(i.cmd)}</code></td><td>${escapeHtml(i.desc)}</td></tr>`)
                            .join("");
                        return items ? `<h4>${escapeHtml(section.title || "")}</h4><div class="ref-table-wrap"><table class="ref-table"><tbody>${items}</tbody></table></div>` : "";
                    }).filter(Boolean).join("");
                    if (sections) {
                        parts.push(`<section class="ref-card ref-card-sheet"><h3>${escapeHtml(sheet.title || "Quick Reference")}</h3>${sections}</section>`);
                    }
                }

                const glossRows = glossary
                    .filter((g) => this.matches(g.term, g.definition))
                    .map((g) => `<tr><td><strong>${escapeHtml(g.term)}</strong></td><td>${escapeHtml(g.definition)}</td></tr>`)
                    .join("");
                if (glossRows) {
                    parts.push(`<section class="ref-card"><h3>Glossary</h3><div class="ref-table-wrap"><table class="ref-table"><tbody>${glossRows}</tbody></table></div></section>`);
                }

                // Where the dungeon teaches each concept (rooms.yaml `teaches`).
                const rooms = (this.data.docs && this.data.docs.rooms) || {};
                const conceptRows = Object.values(rooms)
                    .filter((room) => Array.isArray(room.teaches) && room.teaches.length && room.title)
                    .filter((room) => this.matches(room.title, (room.teaches || []).join(" ")))
                    .map((room) => `<tr><td><strong>${escapeHtml(room.title)}</strong></td><td>${(room.teaches || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join(" ")}</td></tr>`)
                    .join("");
                if (conceptRows) {
                    parts.push(`<section class="ref-card"><h3>Where the Dungeon Teaches It</h3><div class="ref-table-wrap"><table class="ref-table"><tbody>${conceptRows}</tbody></table></div></section>`);
                }
            }

            if (parts.length <= 1) parts.push(`<p class="kind-dim ref-empty">Nothing matches “${escapeHtml(this.query)}”.</p>`);
            this.dom.content.innerHTML = parts.join("");

            this.dom.content.querySelectorAll("[data-cat]").forEach((el) => {
                el.addEventListener("click", () => {
                    this.category = el.dataset.cat;
                    this.render();
                });
            });
            this.dom.content.querySelectorAll(".ref-cmd").forEach((el) => {
                el.addEventListener("click", () => this.copy(el.dataset.copy, el));
            });
        }

        copy(text, el) {
            const done = () => {
                el.classList.add("ref-copied");
                setTimeout(() => el.classList.remove("ref-copied"), 800);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, done);
            } else {
                done();
            }
        }

        // ── Concept spotlight (story sidebar) ────────────────────────────
        renderSpotlight(runtime) {
            if (!this.dom.spotlight || !runtime) return;
            const meta = runtime.currentRoomMeta ? runtime.currentRoomMeta() : {};
            const teaches = Array.isArray(meta.teaches) ? meta.teaches : [];
            const essentials = Array.isArray(meta.essential_commands) ? meta.essential_commands : [];
            if (!teaches.length && !essentials.length) {
                this.dom.spotlight.innerHTML = `<p class="kind-dim">Explore on — each room highlights the concepts it teaches.</p>`;
                return;
            }
            const chipRow = teaches.length
                ? `<p class="spotlight-chips">${teaches.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join(" ")}</p>`
                : "";
            // essential_commands entries are {command, description} objects
            // (rooms.yaml); tolerate plain strings too.
            const cheatRows = essentials.slice(0, 4).map((entry) => {
                const cmd = typeof entry === "string" ? entry : String(entry.command || "");
                const note = typeof entry === "string"
                    ? (SYNTAX_HINTS[cmd.split(" ")[0]] || [])[1]
                    : entry.description;
                if (!cmd) return "";
                return `<p class="cheat-line"><code>${escapeHtml(cmd)}</code>${note ? `<span class="kind-dim"> ${escapeHtml(note)}</span>` : ""}</p>`;
            }).join("");
            this.dom.spotlight.innerHTML = chipRow + cheatRows;
        }

        // ── Inline syntax hint (under the prompt) ────────────────────────
        renderInlineHint() {
            const el = this.dom.inlineHint;
            if (!el) return;
            const value = this.dom.input.value.trimStart();
            const base = value.split(/\s+/)[0];
            const hint = base && SYNTAX_HINTS[base];
            if (hint && value.length >= base.length) {
                el.innerHTML = `<code>${escapeHtml(hint[0])}</code><span> — ${escapeHtml(hint[1])}</span>`;
                el.hidden = false;
            } else {
                el.hidden = true;
            }
        }
    }

    global.BashcrawlReference = { ReferencePanel, SYNTAX_HINTS };
})(window);
