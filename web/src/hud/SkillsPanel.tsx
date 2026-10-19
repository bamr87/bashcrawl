// The skill map's summary: the strongest skills as mini gauges, the count
// practised, what is due for review.
import { game, useModel, type GameStore } from "../engine/game-store";
import { Chip } from "./Chip";
import { Gauge } from "./Gauge";

export function SkillsPanelBody({ store = game }: { store?: GameStore }) {
    const skills = useModel("skillsModel", store);
    return (
        <>
            {skills.top.length ? (
                <ul className="bc-list bc-skills">
                    {skills.top.map((row) => (
                        <li key={row.name}>
                            <code>{row.name}</code>
                            <Gauge value={row.level} max={5} segments={5} label={`${row.name}: level ${row.level} of 5`} tone="skill" className="bc-gauge-skill" />
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Every command you run grows a skill.</p>
            )}
            <p className="bc-muted">{skills.practised}/{skills.total} practised{skills.due ? ` · ${skills.due} due for review` : ""}</p>
            <p className="bc-chips">
                <Chip run="skills" store={store}>Skill map</Chip>
                <Chip run="review" store={store}>Review</Chip>
            </p>
        </>
    );
}
