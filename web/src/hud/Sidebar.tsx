// The HUD sidebar: the panes the layout says, in its order, folded as it
// says. On small screens it is an overlay opened from the status bar.
import type { ReactNode } from "react";

import { useUi } from "../chrome/ui-store";
import { game, useGame, type GameStore } from "../engine/game-store";
import { HeroPanelBody } from "./HeroPanel";
import { InventoryPanelBody } from "./InventoryPanel";
import { LessonPanelBody } from "./LessonPanel";
import { MapPanelBody } from "./MapPanel";
import { PanelFrame } from "./PanelFrame";
import { QuestPanelBody } from "./QuestPanel";
import { RoomPanelBody } from "./RoomPanel";
import { SkillsPanelBody } from "./SkillsPanel";
import { SpotlightPanelBody } from "./SpotlightPanel";
import { PANE_META } from "./panes";

const BODIES: Record<string, (store: GameStore) => ReactNode> = {
    quest: (store) => <QuestPanelBody store={store} />,
    room: (store) => <RoomPanelBody store={store} />,
    pack: (store) => <InventoryPanelBody store={store} />,
    lesson: (store) => <LessonPanelBody store={store} />,
    map: (store) => <MapPanelBody store={store} />,
    skills: (store) => <SkillsPanelBody store={store} />,
    hero: (store) => <HeroPanelBody store={store} />,
    spotlight: (store) => <SpotlightPanelBody store={store} />,
};

export interface SidebarProps {
    store?: GameStore;
    /** Restrict to these panes (the Learn door keeps the lab's files, skills and the hero). */
    only?: string[];
}

export function Sidebar({ store = game, only }: SidebarProps) {
    useGame((snap) => snap.version, store);
    const { panelsOpen } = useUi();
    const layout = store.layout();
    const panes = layout.panes.filter((pane) => pane.visible && BODIES[pane.id] && (!only || only.includes(pane.id)));
    return (
        <aside id="bc-sidebar" className="bc-sidebar" aria-label="Game status panels" data-open={panelsOpen || undefined}>
            {panes.map((pane) => (
                <PanelFrame
                    key={pane.id}
                    id={pane.id}
                    title={PANE_META[pane.id].title}
                    icon={PANE_META[pane.id].icon}
                    collapsed={pane.collapsed}
                    onToggle={() => store.applyLayout({ op: "toggle", id: pane.id, field: "collapsed" })}
                    className={`bc-panel-${pane.id}`}
                >
                    {BODIES[pane.id](store)}
                </PanelFrame>
            ))}
        </aside>
    );
}
