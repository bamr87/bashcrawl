// The Vim Catacombs stage: the buffer is the map, shown above the trial log.
// The cursor cell is highlighted (a block in normal mode, a bar while
// inserting), gems and spikes are coloured, the gutter numbers the lines —
// relative to the cursor once counts are learned, as `relativenumber` would —
// and a mode line reads like vim's. Edit levels show the target beside the
// buffer. React renders it from the game's context on every published
// version; a click hands focus back to the prompt, where the keys are read.
import type { ReactNode } from "react";

import { focusPrompt } from "../terminal/prompt-store";
import { useArcade, type ArcadeStore } from "./arcade-store";

const GEM = "*";
const SPIKE = "!";
const HEARTS = 3;

function cells(line: string, cursor: number): ReactNode[] {
    const nodes: ReactNode[] = [];
    let run = "";
    const flush = () => {
        if (run) nodes.push(<span key={`t${nodes.length}`}>{run}</span>);
        run = "";
    };
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        const classes: string[] = [];
        if (i === cursor) classes.push("bc-vim-cursor");
        if (ch === GEM) classes.push("bc-vim-gem");
        else if (ch === SPIKE) classes.push("bc-vim-spike");
        if (!classes.length) {
            run += ch;
            continue;
        }
        flush();
        nodes.push(<span key={`c${i}`} className={classes.join(" ")}>{ch}</span>);
    }
    flush();
    // Past the last character: an empty line, or insert mode at the end.
    if (cursor >= line.length) nodes.push(<span key="end" className="bc-vim-cursor"> </span>);
    return nodes;
}

function gutter(n: number): string {
    return String(n).padStart(3, " ");
}

export function VimStage({ store }: { store: ArcadeStore }) {
    useArcade((snap) => snap.version, store);
    const ctx = store.ctx;
    const buffer = ctx?.vim;
    const level = ctx?.level;
    if (!ctx || !buffer || !level) return null;
    const { row, col, mode, pending } = buffer;
    const relative = (ctx.allowed ?? []).includes("count");
    const total = ctx.total ?? 0;
    const taken = ctx.taken ?? 0;
    const hp = Math.max(0, Math.min(HEARTS, ctx.hp ?? HEARTS));
    const spikes = level.lines.some((line) => line.includes(SPIKE));
    const status = mode === "insert" ? "-- INSERT --" : pending.length ? pending.join("") : "-- NORMAL --";
    const legend = [total > 0 && `${GEM} gem`, spikes && `${SPIKE} spike`].filter(Boolean).join(" · ");
    return (
        <div
            className="bc-vim"
            data-mode={mode}
            role="group"
            aria-label={`Vim buffer: line ${row + 1}, column ${col + 1}, ${mode} mode`}
            onClick={() => focusPrompt()}
        >
            <div className="bc-vim-head">
                <span>Level {(ctx.index ?? 0) + 1} · {level.title}</span>
                <span>{legend}{legend ? " · " : ""}keys {ctx.keys ?? 0} / par {ctx.par}</span>
            </div>
            <div className="bc-vim-panes">
                <pre className="bc-vim-buffer" aria-hidden="true">
                    {buffer.lines.map((line, r) => (
                        <div key={r} className="bc-vim-line" data-current={r === row ? "" : undefined}>
                            <span className="bc-vim-gutter">{gutter(relative && r !== row ? Math.abs(r - row) : r + 1)}</span>
                            {cells(line, r === row ? col : -1)}
                        </div>
                    ))}
                </pre>
                {level.target && (
                    <pre className="bc-vim-target" aria-label="Target buffer">
                        <span className="bc-vim-target-label">target</span>
                        {level.target.map((line, r) => (
                            <div key={r} className="bc-vim-line"><span className="bc-vim-gutter">{gutter(r + 1)}</span>{line}</div>
                        ))}
                    </pre>
                )}
            </div>
            <div className="bc-vim-modeline" aria-live="polite">
                <span className="bc-vim-mode">{status}</span>
                {total > 0 && <span className="bc-vim-gems">✦ {taken}/{total}</span>}
                <span className="bc-vim-hp" aria-label={`${hp} of ${HEARTS} hearts`}>{"♥".repeat(hp)}{"♡".repeat(HEARTS - hp)}</span>
                <span className="bc-vim-pos">{row + 1},{col + 1}</span>
            </div>
        </div>
    );
}
