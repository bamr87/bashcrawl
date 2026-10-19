// The Hero pane: the pixel figure in the hero's look, reacting to what
// happens through data-mood, with the name plate, path, rank and level.
import { game, useModel, type GameStore } from "../engine/game-store";
import { HERO_MOOD_LABELS, useHeroMood } from "../fx/hero-mood";
import { HeroFigure } from "../hero/HeroFigure";
import { DEFAULT_NAME, roleMeta, useHero } from "../hero/hero-store";

export function HeroPanelBody({ store = game }: { store?: GameStore }) {
    const hero = useModel("heroModel", store);
    const who = useHero();
    const { mood, nonce } = useHeroMood();
    const name = who?.name ?? DEFAULT_NAME;
    const path = who ? roleMeta(who.role) : null;
    return (
        <HeroFigure appearance={who?.appearance} mood={mood} nonce={nonce} label={`${name}, pixel adventurer (${mood})`}>
            <p className="bc-hero-name bc-display">{name}</p>
            {path && <p className="bc-muted bc-hero-path"><span aria-hidden="true">{path.icon} </span>{path.title}</p>}
            <p className="bc-hero-rank bc-display">{hero.rank}</p>
            <p className="bc-muted bc-hero-meta">Lv {hero.level} · {hero.xp} XP · {hero.badges}/{hero.badgeTotal} badges</p>
            <p className="bc-muted bc-hero-mood">{HERO_MOOD_LABELS[mood]}</p>
        </HeroFigure>
    );
}
