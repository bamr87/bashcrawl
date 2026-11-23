// The home page's terminal: a real one. It runs the game's own engine over a
// sandbox copy of the dungeon (a bare runtime, like an arcade trial), so what
// a visitor types here behaves exactly as it will in the game, and nothing
// is saved. Suggested commands sit underneath; after a few, it points at the
// real thing.
import { CornerDownLeft } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { track } from "../analytics/client";
import { requireEngine } from "../engine";
import { game, useGame, type GameStore } from "../engine/game-store";
import type { Runtime, TerminalView } from "../engine/types";

const SUGGESTIONS = ["pwd", "ls -F", "cat scroll", "cd cellar"];

interface Session {
    runtime: Runtime;
    view: TerminalView;
}

export function TryIt({ store = game, onContinue }: { store?: GameStore; onContinue: () => void }) {
    const ready = useGame((snap) => snap.phase === "ready", store);
    const failed = useGame((snap) => snap.phase === "error", store);
    const logRef = useRef<HTMLPreElement>(null);
    const session = useRef<Session | null>(null);
    const tried = useRef(false);
    const [value, setValue] = useState("");
    const [prompt, setPrompt] = useState("~ $");
    const [runs, setRuns] = useState(0);

    useEffect(() => {
        const log = logRef.current;
        const data = store.data;
        if (!ready || !data || !log) return;
        const { TermForge, BashcrawlRuntime: RT } = requireEngine();
        const runtime = new RT.Runtime(
            { world: data.world, quests: { quests: [] }, commands: { categories: {}, quick_ref: {}, runtime: [] } },
            RT.defaultState(data.world.root),
            { bare: true },
        );
        log.replaceChildren();
        const view = new TermForge.view.TerminalView({ sink: new TermForge.sinks.DomSink(log), cap: 200, onControl: () => true });
        view.appendLine("dim", "You are standing at the dungeon's entrance. Type a command, or pick one below.");
        view.flush();
        session.current = { runtime, view };
        setPrompt(runtime.promptLabel());
        return () => {
            session.current = null;
            log.replaceChildren();
        };
    }, [ready, store]);

    function run(line: string) {
        const current = session.current;
        const text = line.trim();
        if (!current || !text) return;
        current.view.appendLine("dim", `${current.runtime.promptLabel()} ${text}`);
        current.view.appendOutputs(current.runtime.execute(text));
        current.view.flush();
        const log = logRef.current;
        if (log) log.scrollTop = log.scrollHeight;
        setPrompt(current.runtime.promptLabel());
        setValue("");
        if (!tried.current) {
            tried.current = true;
            track("landing_cta_clicked", { cta: "try_it", surface: "home" });
        }
        setRuns((count) => count + 1);
    }

    function onSubmit(event: FormEvent) {
        event.preventDefault();
        run(value);
    }

    return (
        <div className="bc-try" data-ready={ready || undefined}>
            <div className="bc-try-bar" aria-hidden="true">
                <span className="bc-try-dots"><i /><i /><i /></span>
                <span className="bc-try-title">sandbox — nothing here is saved</span>
            </div>
            <pre ref={logRef} className="bc-log bc-try-log" role="log" aria-live="polite" aria-label="Sandbox terminal output" tabIndex={0}>
                {ready ? null : failed ? "The dungeon did not load. Reload the page to try again." : "Loading the dungeon…"}
            </pre>
            <form className="bc-try-prompt" onSubmit={onSubmit}>
                <label className="bc-try-label" htmlFor="bc-try-input">{prompt}</label>
                <input
                    id="bc-try-input"
                    className="bc-try-input"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="type a command"
                    aria-label="Sandbox command"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={!ready}
                />
                <button type="submit" className="bc-btn bc-btn-ghost bc-btn-icon" aria-label="Run the command" disabled={!ready}>
                    <CornerDownLeft aria-hidden="true" />
                </button>
            </form>
            <div className="bc-try-chips" role="group" aria-label="Commands to try">
                {SUGGESTIONS.map((command) => (
                    <button key={command} type="button" className="bc-try-chip" onClick={() => run(command)} disabled={!ready}>
                        {command}
                    </button>
                ))}
                {runs >= 3 && (
                    <button type="button" className="bc-try-chip bc-try-go" onClick={onContinue}>
                        Keep going in the real dungeon →
                    </button>
                )}
            </div>
        </div>
    );
}
