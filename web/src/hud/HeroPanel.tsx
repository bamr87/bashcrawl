// The hero's portrait: a CSS pixel sprite (no glyphs) that reacts to what
// happens through data-mood, with the rank and level under it.
import { game, useModel, type GameStore } from "../engine/game-store";
import { HERO_MOOD_LABELS, useHeroMood } from "../fx/hero-mood";

export function HeroPanelBody({ store = game }: { store?: GameStore }) {
    const hero = useModel("heroModel", store);
    const { mood, nonce } = useHeroMood();
    return (
        <div className="bc-hero" data-mood={mood} role="img" aria-label={`Pixel adventurer (${mood})`}>
            <div className="bc-hero-sprite" key={nonce}>
                <span className="bc-hero-shadow" />
                <span className="bc-hero-px bc-hero-helm" />
                <span className="bc-hero-px bc-hero-face" />
                <span className="bc-hero-px bc-hero-torso" />
                <span className="bc-hero-px bc-hero-arm bc-hero-arm-l" />
                <span className="bc-hero-px bc-hero-arm bc-hero-arm-r" />
                <span className="bc-hero-px bc-hero-legs" />
                <span className="bc-hero-px bc-hero-blade" />
                <span className="bc-hero-spark bc-hero-spark-1" />
                <span className="bc-hero-spark bc-hero-spark-2" />
                <span className="bc-hero-spark bc-hero-spark-3" />
            </div>
            <p className="bc-hero-rank bc-display">{hero.rank}</p>
            <p className="bc-muted bc-hero-meta">Lv {hero.level} · {hero.xp} XP · {hero.badges}/{hero.badgeTotal} badges</p>
            <p className="bc-muted bc-hero-mood">{HERO_MOOD_LABELS[mood]}</p>
        </div>
    );
}
