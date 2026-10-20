// The arcade floor: five trials as cards, the Command Flash decks and the
// Vim Catacombs levels (a chip per level; cleared ones are marked).
import { motion } from "motion/react";

import type { ArcadeStore } from "./arcade-store";
import { useArcade } from "./arcade-store";

export function ArcadeHome({ store }: { store: ArcadeStore }) {
    useArcade((snap) => snap.version, store);
    const flashDecks = (store.data?.arcade.flash_decks ?? []).slice(0, 12);
    const vimLevels = store.data?.arcade.vim_levels ?? [];
    const vimCleared = store.records.games.vim?.cleared ?? [];
    return (
        <div className="bc-arcade-home">
            <header className="bc-arcade-intro">
                <h2 className="bc-display">Practice Arcade</h2>
                <p className="bc-muted">Five trials — four on one real bash kernel, one in a vim buffer. Scores feed your story XP.</p>
            </header>
            <div className="bc-arcade-grid">
                {store.games.map((gameDef, i) => {
                    const rec = store.records.games[gameDef.id];
                    return (
                        <motion.button
                            key={gameDef.id}
                            type="button"
                            className="bc-arcade-card bc-frame"
                            onClick={() => store.start(gameDef.id)}
                            aria-label={`Play ${gameDef.title}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.25, ease: [0.2, 0, 0, 1] }}
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span className="bc-arcade-icon" aria-hidden="true">{gameDef.icon}</span>
                            <strong className="bc-display">{gameDef.title}</strong>
                            <span className="bc-arcade-tagline">{gameDef.tagline}</span>
                            <span className="bc-tags">{gameDef.concepts.map((c) => <span key={c} className="bc-tag">{c}</span>)}</span>
                            <span className="bc-muted bc-arcade-stats">{rec?.plays ? `best ${rec.best} · ${rec.plays} run${rec.plays === 1 ? "" : "s"}` : "not yet attempted"}</span>
                        </motion.button>
                    );
                })}
            </div>
            {vimLevels.length > 0 && (
                <section className="bc-arcade-decks" aria-label="Vim Catacombs levels">
                    <p className="bc-group-label">Vim Catacombs levels</p>
                    <p className="bc-chips">
                        {vimLevels.map((level, i) => {
                            const done = vimCleared.includes(level.id);
                            return (
                                <button
                                    key={level.id}
                                    type="button"
                                    className={`bc-chip${done ? " bc-chip-on" : ""}`}
                                    onClick={() => store.start("vim", level.id)}
                                    title={level.brief}
                                    aria-label={`Level ${i + 1}: ${level.title}${done ? ", cleared" : ""}`}
                                >
                                    {i + 1} · {level.title}{done ? " ✓" : ""}
                                </button>
                            );
                        })}
                    </p>
                </section>
            )}
            {flashDecks.length > 0 && (
                <section className="bc-arcade-decks" aria-label="Command Flash decks">
                    <p className="bc-group-label">Command Flash decks</p>
                    <p className="bc-chips">
                        {flashDecks.map((deck) => (
                            <button key={deck.id} type="button" className="bc-chip" onClick={() => store.start("flash", deck.id)}>
                                {deck.title} ({deck.cards.length})
                            </button>
                        ))}
                    </p>
                </section>
            )}
        </div>
    );
}
