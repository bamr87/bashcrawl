// The documentation drawer (F1, Ctrl+/, the Docs button): quick start, the
// current room and quest — which follow the game, unlike before — the
// command reference and the glossary, searchable. A command button drops
// its verb into the prompt.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { game, useGame, type GameStore } from "../engine/game-store";
import { fillCommand } from "../terminal/actions";
import { focusPrompt } from "../terminal/prompt-store";
import { setUi, useUi } from "./ui-store";

export function DocsDrawer({ store = game }: { store?: GameStore }) {
    const { docsOpen } = useUi();
    useGame((snap) => snap.version, store);
    const [query, setQuery] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (docsOpen) searchRef.current?.focus();
    }, [docsOpen]);

    function close() {
        setUi({ docsOpen: false });
        focusPrompt();
    }

    const docs = store.data?.docs;
    const runtime = store.runtime;
    const q = query.trim().toLowerCase();
    const matches = (text: string) => !q || text.toLowerCase().includes(q);

    const cards: Array<{ key: string; title: string; body: React.ReactNode }> = [];
    if (docs && runtime) {
        const quick = docs.quick_start ?? [];
        if (!q || quick.some(matches) || matches("quick start")) {
            cards.push({ key: "quick", title: "Quick start", body: <ol>{quick.map((line) => <li key={line}>{line}</li>)}</ol> });
        }
        const room = runtime.currentRoomMeta();
        const roomText = `${room.title ?? ""} ${room.hint ?? ""} ${(room.teaches ?? []).join(" ")}`;
        if (!q || matches(roomText) || matches("current room")) {
            cards.push({
                key: "room",
                title: "Current room",
                body: (
                    <>
                        <p><strong>{room.title ?? runtime.state.cwd}</strong></p>
                        {room.hint && <p>{room.hint}</p>}
                        {room.teaches?.length ? <p>Teaches: {room.teaches.join(", ")}</p> : null}
                        {room.next_steps && <p>Try next: {room.next_steps}</p>}
                    </>
                ),
            });
        }
        const quest = runtime.quests[runtime.state.currentQuestId];
        if (!quest) {
            cards.push({ key: "quest", title: "Active quest", body: <p>All quests complete. Explore freely.</p> });
        } else if (!q || matches(`${quest.title} ${quest.objective} ${quest.hint ?? ""}`) || matches("quest")) {
            cards.push({ key: "quest", title: "Active quest", body: <><p><strong>{quest.title}</strong></p><p>{quest.objective}</p><p className="bc-muted">{quest.hint}</p></> });
        }
        const blocks = Object.entries(docs.commands?.categories ?? {}).map(([key, cat]) => {
            const commands = (cat.commands ?? []).filter((c) => matches(`${c.command} ${c.description} ${cat.title ?? ""}`));
            if (!commands.length && q) return null;
            return (
                <section key={key} className="bc-docs-block" aria-label={cat.title ?? key}>
                    <h4>{cat.title ?? key}</h4>
                    <ul className="bc-list">
                        {commands.map((c) => (
                            <li key={c.command}>
                                <button type="button" className="bc-chip" onClick={() => { fillCommand(c.command.split(" ")[0]); close(); }} title={`Put ${c.command.split(" ")[0]} in the prompt`}>{c.command}</button>
                                <span className="bc-docs-desc"> {c.description}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            );
        }).filter(Boolean);
        if (blocks.length) cards.push({ key: "commands", title: "Command reference", body: <>{blocks}</> });
        const gloss = (docs.glossary ?? []).filter((g) => matches(`${g.term} ${g.definition}`));
        if (gloss.length) {
            cards.push({ key: "glossary", title: "Glossary", body: <dl className="bc-ref-glossary">{gloss.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.definition}</dd></div>)}</dl> });
        }
    }

    return (
        <AnimatePresence>
            {docsOpen && (
                <motion.aside
                    className="bc-docs bc-frame"
                    aria-label="Bashcrawl documentation"
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 40, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                >
                    <div className="bc-dialog-head">
                        <h2 className="bc-display">Documentation</h2>
                        <button type="button" className="bc-btn" onClick={close} aria-label="Close documentation">Close</button>
                    </div>
                    <input
                        ref={searchRef}
                        type="search"
                        className="bc-input"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Escape" || event.key === "F1") { event.preventDefault(); close(); } }}
                        placeholder="Search commands, rooms, quests"
                        aria-label="Search the documentation"
                    />
                    <div className="bc-docs-content">
                        {cards.map((card) => (
                            <section key={card.key} className="bc-docs-card">
                                <h3>{card.title}</h3>
                                {card.body}
                            </section>
                        ))}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
