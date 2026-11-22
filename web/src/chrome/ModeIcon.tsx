// One icon per door, drawn as line icons in currentColor. `MODE_META.icon`
// (an emoji) remains for places that print text: the engine's log, titles.
import { BookOpen, Gamepad2, GraduationCap, Swords, type LucideIcon } from "lucide-react";

import type { Mode } from "../app/modes";

const ICONS: Record<Mode, LucideIcon> = {
    story: Swords,
    learn: GraduationCap,
    arcade: Gamepad2,
    reference: BookOpen,
};

export function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
    const Icon = ICONS[mode];
    return <Icon className={className} aria-hidden="true" focusable="false" />;
}
