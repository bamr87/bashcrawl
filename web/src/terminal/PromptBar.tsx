// The one shared prompt. Enter runs the line through whoever owns the input
// (story or arcade), ↑/↓ walk history, Tab completes, Ctrl+L clears, F1 and
// Ctrl+/ toggle the docs, `?` on an empty line opens the shortcuts. The
// label shows the full path and, on narrow screens, just the room's name.
import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";

import { setUi, toggleDocs, toggleHelp } from "../chrome/ui-store";
import type { InputTarget } from "./input-target";
import { labelPath, shortLabel } from "./prompt-label";
import { setPromptValue, usePrompt } from "./prompt-store";

export interface PromptBarProps {
    target: InputTarget;
    label: string;
    placeholder: string;
}

export function PromptBar({ target, label, placeholder }: PromptBarProps) {
    const { value, focusNonce } = usePrompt();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!focusNonce) return;
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, [focusNonce]);

    function submit(event?: FormEvent) {
        event?.preventDefault();
        const line = value.trim();
        setPromptValue("");
        if (!line && !target.acceptsEmpty()) return;
        target.execute(line);
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Enter") {
            event.preventDefault();
            submit();
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const next = target.historyStep(event.key === "ArrowUp" ? -1 : 1);
            if (next != null) setPromptValue(next);
        } else if (event.key === "Tab") {
            event.preventDefault();
            const next = target.complete(value);
            if (next != null) setPromptValue(next);
        } else if (event.key === "/" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            toggleDocs();
        } else if (event.key === "?" && !value.trim() && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            toggleHelp();
        } else if (event.key.toLowerCase() === "l" && event.ctrlKey) {
            event.preventDefault();
            target.clearLog();
        } else if (event.key === "Escape") {
            setUi({ helpOpen: false, docsOpen: false });
        }
    }

    const full = label;
    const short = shortLabel(label);
    const path = labelPath(label);
    return (
        <form className="bc-prompt" onSubmit={submit} data-owner={target.id}>
            <label htmlFor="command-input" className="bc-prompt-label" title={path ? `Full path: ${path}` : undefined}>
                <span className="bc-prompt-full">{full}</span>
                <span className="bc-prompt-short" aria-hidden="true">{short}</span>
            </label>
            <input
                ref={inputRef}
                id="command-input"
                className="bc-input"
                value={value}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Command"
            />
        </form>
    );
}
