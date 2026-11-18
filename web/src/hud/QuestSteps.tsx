// The active quest's checklist (quests.yaml `steps`, evaluated by
// Hud.questModel): one line per step, ticked once its rule holds. The Quest
// panel and the story tracker both draw it; a quest without steps draws
// nothing.
import type { QuestStep } from "../engine/types";

export function QuestSteps({ steps, className = "" }: { steps: QuestStep[]; className?: string }) {
    if (!steps.length) return null;
    const done = steps.filter((step) => step.done).length;
    return (
        <ul className={`bc-list bc-quest-steps ${className}`.trim()} aria-label={`Quest steps, ${done} of ${steps.length} done`}>
            {steps.map((step) => (
                <li key={step.label} className={step.done ? "bc-ql-done" : "bc-ql-side"} data-done={step.done || undefined}>
                    <span aria-hidden="true">{step.done ? "☑" : "☐"} </span>
                    {step.label}
                    {step.done && <span className="bc-visually-hidden"> (done)</span>}
                </li>
            ))}
        </ul>
    );
}
