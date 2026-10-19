// A HUD window: nameplate title that folds the body, the pixel frame, and
// an anchor the effects layer can pulse (data-fx-anchor = the pane id).
import { useEffect, useRef, type ReactNode } from "react";

import { registerAnchor } from "../fx/anchors";

export interface PanelFrameProps {
    id: string;
    title: string;
    icon?: string;
    collapsed: boolean;
    onToggle: () => void;
    children: ReactNode;
    className?: string;
}

export function PanelFrame({ id, title, icon, collapsed, onToggle, children, className }: PanelFrameProps) {
    const ref = useRef<HTMLElement>(null);
    useEffect(() => registerAnchor(id, ref.current), [id]);
    const bodyId = `bc-pane-${id}`;
    return (
        <section ref={ref} className={`bc-panel bc-frame ${className ?? ""}`} data-hud-pane={id} data-collapsed={collapsed || undefined}>
            <h2 className="bc-panel-title bc-display">
                <button type="button" className="bc-panel-toggle" aria-expanded={!collapsed} aria-controls={bodyId} onClick={onToggle}>
                    <span className="bc-panel-caret" aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
                    {icon && <span className="bc-panel-icon" aria-hidden="true">{icon}</span>}
                    <span>{title}</span>
                </button>
            </h2>
            <div id={bodyId} className="bc-panel-body" hidden={collapsed}>
                {children}
            </div>
        </section>
    );
}
