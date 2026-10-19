// CRT on/off.
import { setCrt, useCrt } from "./crt-store";

export function CrtToggle() {
    const { on } = useCrt();
    return (
        <button
            type="button"
            className="bc-btn"
            aria-pressed={on}
            onClick={() => setCrt(!on)}
            title={on ? "Disable the retro CRT overlay" : "Enable the retro CRT overlay"}
            aria-label={on ? "CRT overlay on. Turn it off" : "CRT overlay off. Turn it on"}
        >
            CRT
        </button>
    );
}
