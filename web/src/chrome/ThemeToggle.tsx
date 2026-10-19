// Light / dark / auto, cycled by one button (UPS-FE-12). The visible label
// names the current preference; the accessible name says what a press does.
import { cycleTheme, THEME_LABELS, useTheme, type ThemePref } from "../theme/theme-store";

const ICON: Record<ThemePref, string> = { dark: "☾", light: "☀", auto: "◐" };
const NEXT: Record<ThemePref, ThemePref> = { dark: "light", light: "auto", auto: "dark" };

export function ThemeToggle() {
    const { pref } = useTheme();
    return (
        <button
            type="button"
            className="bc-btn"
            onClick={() => cycleTheme()}
            aria-label={`Theme: ${THEME_LABELS[pref]}. Switch to ${THEME_LABELS[NEXT[pref]].toLowerCase()}`}
            title={`Theme: ${THEME_LABELS[pref]} — click for ${THEME_LABELS[NEXT[pref]].toLowerCase()}`}
        >
            <span aria-hidden="true">{ICON[pref]}</span>
            <span>{THEME_LABELS[pref]}</span>
        </button>
    );
}
