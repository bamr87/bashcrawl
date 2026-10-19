// The fog-of-war map: visited rooms, glimpsed doors, and where you stand.
import { game, useModel, type GameStore } from "../engine/game-store";

export function MapPanelBody({ store = game }: { store?: GameStore }) {
    const map = useModel("mapModel", store);
    return (
        <>
            <pre className="bc-map" aria-label="Discovered dungeon map">
                {map.rows.map((row) => (
                    <span key={row.path} className="bc-map-row">
                        {row.prefix}
                        <span className={row.here ? "bc-map-here" : row.seen ? "bc-map-seen" : "bc-map-fog"}>{row.name}</span>
                        {row.here ? " ←" : ""}
                        {"\n"}
                    </span>
                ))}
            </pre>
            <p className="bc-muted bc-map-legend">{map.explored} room{map.explored === 1 ? "" : "s"} explored · ← you are here</p>
        </>
    );
}
