// The Reference door: every command the dungeon teaches as searchable
// cheatsheets, the quick-reference sheets, a glossary, and where each
// concept is taught. Click a command to copy it; ▶ drops it into the Story
// prompt.
import { useState } from "react";

import { toast } from "../chrome/toast-store";
import { game, type GameStore } from "../engine/game-store";
import { tryCommand } from "../terminal/actions";

function CommandCell({ cmd }: { cmd: string }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        const done = () => {
            setCopied(true);
            toast(`Copied: ${cmd}`, "success", 1400);
            setTimeout(() => setCopied(false), 800);
        };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(cmd).then(done, done);
        else done();
    }
    return (
        <td className="bc-ref-cmd-cell">
            <button type="button" className="bc-ref-cmd" data-copied={copied || undefined} onClick={copy} title="Click to copy">
                <code>{cmd}</code>
            </button>
            <button type="button" className="bc-ref-try" onClick={() => tryCommand(cmd)} title="Try it in the Story terminal" aria-label={`Try ${cmd} in the Story terminal`}>▶</button>
        </td>
    );
}

function Table({ rows }: { rows: Array<{ cmd: string; desc: string }> }) {
    return (
        <div className="bc-ref-table-wrap">
            <table className="bc-ref-table">
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.cmd}>
                            <CommandCell cmd={row.cmd} />
                            <td>{row.desc}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function ReferenceScreen({ store = game }: { store?: GameStore }) {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");
    const data = store.data;
    if (!data) return null;
    const q = query.trim().toLowerCase();
    const matches = (...fields: Array<string | undefined>) => !q || fields.some((f) => String(f ?? "").toLowerCase().includes(q));
    const categories = data.commands.categories ?? {};
    const quickRef = data.commands.quick_ref ?? {};
    const glossary = data.docs.glossary ?? [];
    const rooms = Object.values(data.docs.rooms ?? data.world.rooms ?? {});

    const sections: Array<{ key: string; title: string; body: React.ReactNode }> = [];
    for (const [key, cat] of Object.entries(categories)) {
        if (category !== "all" && category !== key) continue;
        const rows = (cat.commands ?? []).filter((c) => matches(c.command, c.description)).map((c) => ({ cmd: c.command, desc: c.description }));
        if (rows.length) sections.push({ key, title: cat.title ?? key, body: <Table rows={rows} /> });
    }
    if (category === "all") {
        for (const [key, sheet] of Object.entries(quickRef)) {
            const parts = (sheet.sections ?? []).map((section) => {
                const rows = (section.items ?? []).filter((i) => matches(i.cmd, i.desc)).map((i) => ({ cmd: i.cmd, desc: i.desc }));
                return rows.length ? (
                    <div key={section.title ?? ""}>
                        {section.title && <h4>{section.title}</h4>}
                        <Table rows={rows} />
                    </div>
                ) : null;
            }).filter(Boolean);
            if (parts.length) sections.push({ key: `sheet-${key}`, title: sheet.title ?? "Quick Reference", body: <>{parts}</> });
        }
        const gloss = glossary.filter((g) => matches(g.term, g.definition));
        if (gloss.length) {
            sections.push({
                key: "glossary",
                title: "Glossary",
                body: (
                    <dl className="bc-ref-glossary">
                        {gloss.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.definition}</dd></div>)}
                    </dl>
                ),
            });
        }
        const concepts = rooms.filter((room) => room.title && room.teaches?.length && matches(room.title, room.teaches?.join(" ")));
        if (concepts.length) {
            sections.push({
                key: "where",
                title: "Where the dungeon teaches it",
                body: (
                    <ul className="bc-list bc-ref-where">
                        {concepts.map((room) => (
                            <li key={room.title}>
                                <strong>{room.title}</strong>
                                <span className="bc-tags">{room.teaches?.map((t) => <span key={t} className="bc-tag">{t}</span>)}</span>
                            </li>
                        ))}
                    </ul>
                ),
            });
        }
    }

    return (
        <section className="bc-reference" aria-label="Command reference and cheatsheets">
            <div className="bc-ref-controls">
                <input
                    type="search"
                    className="bc-input bc-ref-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search commands, flags, concepts…"
                    aria-label="Search the reference"
                />
                <div className="bc-chips" role="tablist" aria-label="Command categories">
                    {["all", ...Object.keys(categories)].map((key) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={category === key}
                            className={`bc-chip${category === key ? " bc-chip-on" : ""}`}
                            onClick={() => setCategory(key)}
                        >
                            {key === "all" ? "All" : categories[key].title ?? key}
                        </button>
                    ))}
                </div>
            </div>
            <div className="bc-ref-content">
                {sections.length ? sections.map((section) => (
                    <section key={section.key} className="bc-ref-card bc-frame">
                        <h3 className="bc-display">{section.title}</h3>
                        {section.body}
                    </section>
                )) : (
                    <p className="bc-muted bc-ref-empty">Nothing matches “{query}”.</p>
                )}
            </div>
        </section>
    );
}
