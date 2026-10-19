// A real not-found route (UPS-FE-15), in the game's own voice.
import { MODES, MODE_META } from "../app/modes";
import { hrefFor } from "../app/useHashRoute";

export function NotFound({ path }: { path: string }) {
    return (
        <section className="bc-page bc-frame" aria-labelledby="bc-404-title">
            <h1 id="bc-404-title" className="bc-display">You have wandered out of bounds</h1>
            <p>
                There is no room at <code>#{path}</code>. The catacombs have four doors:
            </p>
            <div className="bc-doors">
                {MODES.map((mode) => (
                    <a key={mode} className="bc-btn" href={hrefFor(mode)}>
                        <span aria-hidden="true">{MODE_META[mode].icon}</span> {MODE_META[mode].label}
                    </a>
                ))}
            </div>
        </section>
    );
}
