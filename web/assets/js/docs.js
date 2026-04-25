(function initDocs(global) {
    function htmlEscape(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    class DocsPanel {
        constructor({ drawer, content, search, input, onOpenChange }) {
            this.drawer = drawer;
            this.content = content;
            this.search = search;
            this.input = input;
            this.onOpenChange = onOpenChange;
            this.drawer.inert = true;
            this.drawer.hidden = true;
            this.docs = null;
            this.runtime = null;
            this.search.addEventListener("input", () => this.render());
            this.content.addEventListener("click", (event) => {
                const button = event.target.closest("[data-command]");
                if (!button) return;
                this.input.value = button.getAttribute("data-command");
                this.input.focus();
            });
        }

        setData(docs, runtime) {
            this.docs = docs;
            this.runtime = runtime;
            this.render();
        }

        isOpen() {
            return this.drawer.classList.contains("open");
        }

        open() {
            this.drawer.hidden = false;
            this.drawer.classList.add("open");
            this.drawer.setAttribute("aria-hidden", "false");
            this.drawer.inert = false;
            this.search.focus();
            if (this.onOpenChange) this.onOpenChange(true);
        }

        close() {
            this.drawer.classList.remove("open");
            this.drawer.setAttribute("aria-hidden", "true");
            this.drawer.inert = true;
            this.drawer.hidden = true;
            this.input.focus();
            if (this.onOpenChange) this.onOpenChange(false);
        }

        toggle() {
            if (this.drawer.classList.contains("open")) this.close();
            else this.open();
        }

        render() {
            if (!this.docs || !this.runtime) return;
            const query = this.search.value.trim().toLowerCase();
            const parts = [
                this.renderQuickStart(query),
                this.renderCurrentRoom(query),
                this.renderActiveQuest(query),
                this.renderCommands(query),
                this.renderGlossary(query),
            ].filter(Boolean);
            this.content.innerHTML = parts.join("");
        }

        matches(query, text) {
            return !query || String(text).toLowerCase().includes(query);
        }

        card(title, body) {
            return `<section class="docs-card"><h3>${htmlEscape(title)}</h3>${body}</section>`;
        }

        renderQuickStart(query) {
            const lines = this.docs.quick_start || [];
            if (query && !lines.some((line) => this.matches(query, line)) && !this.matches(query, "quick start")) return "";
            return this.card("Quick Start", `<ol>${lines.map((line) => `<li>${htmlEscape(line)}</li>`).join("")}</ol>`);
        }

        renderCurrentRoom(query) {
            const room = this.runtime.currentRoomMeta();
            const text = `${room.title || ""} ${room.hint || ""} ${(room.teaches || []).join(" ")}`;
            if (query && !this.matches(query, text) && !this.matches(query, "current room")) return "";
            return this.card(
                "Current Room",
                [
                    `<p><strong>${htmlEscape(room.title || this.runtime.state.cwd)}</strong></p>`,
                    room.hint ? `<p>${htmlEscape(room.hint)}</p>` : "",
                    room.teaches?.length ? `<p>Teaches: ${room.teaches.map(htmlEscape).join(", ")}</p>` : "",
                    room.next_steps ? `<p>Try next: ${htmlEscape(room.next_steps)}</p>` : "",
                ].join(""),
            );
        }

        renderActiveQuest(query) {
            const quest = this.runtime.quests[this.runtime.state.currentQuestId];
            if (!quest) return this.card("Active Quest", "<p>All quests complete. Explore freely.</p>");
            const text = `${quest.title} ${quest.objective} ${quest.hint || ""}`;
            if (query && !this.matches(query, text) && !this.matches(query, "quest")) return "";
            return this.card("Active Quest", `<p><strong>${htmlEscape(quest.title)}</strong></p><p>${htmlEscape(quest.objective)}</p><p>${htmlEscape(quest.hint || "")}</p>`);
        }

        renderCommands(query) {
            const categories = this.docs.commands?.categories || {};
            const rendered = [];
            let catIndex = 0;
            for (const [key, category] of Object.entries(categories)) {
                const commands = (category.commands || []).filter((cmd) => this.matches(query, `${cmd.command} ${cmd.description} ${category.title}`));
                if (!commands.length && query) continue;
                const catId = `docs-cat-${catIndex++}`;
                const listItems = commands
                    .map(
                        (cmd) =>
                            `<li><button class="docs-command" type="button" data-command="${htmlEscape(cmd.command.split(" ")[0])}">${htmlEscape(cmd.command)}</button> <span class="docs-cmd-desc">${htmlEscape(cmd.description)}</span></li>`,
                    )
                    .join("");
                rendered.push(
                    `<section class="docs-cmd-block" aria-labelledby="${htmlEscape(catId)}">` +
                        `<h4 class="docs-cmd-cat" id="${htmlEscape(catId)}">${htmlEscape(category.title || key)}</h4>` +
                        `<ul class="docs-cmd-list">${listItems}</ul>` +
                        `</section>`,
                );
            }
            if (!rendered.length) return "";
            return this.card("Command Reference", rendered.join(""));
        }

        renderGlossary(query) {
            const items = (this.docs.glossary || []).filter((item) => this.matches(query, `${item.term} ${item.definition}`));
            if (!items.length) return "";
            return this.card("Glossary", `<dl>${items.map((item) => `<dt><strong>${htmlEscape(item.term)}</strong></dt><dd>${htmlEscape(item.definition)}</dd>`).join("")}</dl>`);
        }
    }

    global.BashcrawlDocs = { DocsPanel };
})(window);
