// `less` in the browser: the file in a modal reader, formatted by the same
// prose classifier as the log. Space/PgDn page down, b/PgUp page up, q or
// Esc close, a click on a command types it and closes; focus returns to
// the prompt.
import { useCallback, useRef, type KeyboardEvent, type MouseEvent } from "react";

import { Dialog } from "../chrome/Dialog";
import { game, useGame, type GameStore } from "../engine/game-store";
import { fillPrompt, focusPrompt } from "./prompt-store";
import { renderProseHtml } from "./prose";

export function Pager({ store = game }: { store?: GameStore }) {
    const page = useGame((snap) => snap.page, store);
    const preRef = useRef<HTMLPreElement>(null);
    const close = useCallback(() => {
        store.closePage();
        focusPrompt();
    }, [store]);
    const initialFocus = useCallback(() => preRef.current, []);
    // renderProseHtml escapes every character of the file through the
    // engine's escapeHtml; only its own class spans are markup.
    const html = page == null ? "" : renderProseHtml(page, store.proseContext());

    function onClick(event: MouseEvent<HTMLPreElement>) {
        const hit = (event.target as HTMLElement).closest?.("[data-fill]");
        if (!(hit instanceof HTMLElement) || !hit.dataset.fill) return;
        close();
        fillPrompt(hit.dataset.fill);
    }

    function onKeyDown(event: KeyboardEvent<HTMLPreElement>) {
        const el = event.currentTarget;
        if (event.key === "q") {
            event.preventDefault();
            close();
        } else if (event.key === " " || event.key === "PageDown") {
            event.preventDefault();
            el.scrollTop += el.clientHeight;
        } else if (event.key === "b" || event.key === "PageUp") {
            event.preventDefault();
            el.scrollTop -= el.clientHeight;
        }
    }

    return (
        <Dialog open={page != null} title="Scroll" onClose={close} className="bc-pager" initialFocus={initialFocus}>
            <p className="bc-pager-help">Space / PgDn next · b / PgUp back · q / Esc close</p>
            <pre ref={preRef} className="bc-pager-text" tabIndex={0} onKeyDown={onKeyDown} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
        </Dialog>
    );
}
