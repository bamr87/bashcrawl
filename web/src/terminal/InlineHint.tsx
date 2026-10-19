// A one-line syntax reminder under the prompt while you type a known command.
import { hintFor } from "../reference/syntax-hints";
import { usePrompt } from "./prompt-store";

export function InlineHint() {
    const { value } = usePrompt();
    const hint = hintFor(value);
    if (!hint) return null;
    return (
        <p className="bc-inline-hint" aria-live="polite">
            <code>{hint[0]}</code>
            <span> — {hint[1]}</span>
        </p>
    );
}
