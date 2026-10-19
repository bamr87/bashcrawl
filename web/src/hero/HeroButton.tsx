// The hero in the header: mini sprite, name and rank; opens the profile.
import { game, useModel, type GameStore } from "../engine/game-store";
import { openOverlay } from "../chrome/ui-store";
import { HeroFigure } from "./HeroFigure";
import { DEFAULT_NAME, useHero } from "./hero-store";

export function HeroButton({ store = game }: { store?: GameStore }) {
    const who = useHero();
    const status = useModel("statusModel", store);
    const name = who?.name ?? DEFAULT_NAME;
    return (
        <button
            type="button"
            className="bc-btn bc-hero-btn"
            onClick={() => openOverlay("profile")}
            title="Your hero: profile, look, path, new game"
            aria-label={`Hero ${name}, ${status.rank}. Open the profile`}
        >
            <span aria-hidden="true">
                <HeroFigure look={who?.look ?? 0} size="sm" className="bc-hero-mini" />
            </span>
            <span className="bc-hero-btn-name">{name}</span>
            <span className="bc-hero-btn-rank">{status.rank}</span>
        </button>
    );
}
