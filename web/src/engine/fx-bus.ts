// The FX bus: everything that happened as a result of a command (or an
// award from the arcade), published once so the effects layer, the audio
// and the hero portrait can all react without the store knowing them.
import type { HudEvent, Line } from "./types";

export type FxEvent =
    | {
        type: "command";
        line: string;
        outputs: Line[];
        events: HudEvent[];
        error: boolean;
        /** The quest this command completed, for its title card and its chapter. */
        questTitle?: string;
        questId?: number;
        /** The command entered a room for the first time. */
        discovered?: boolean;
    }
    | { type: "award"; amount: number; label: string; events: HudEvent[] }
    | { type: "boot" }
    | { type: "celebrate" }
    | { type: "mode"; mode: string };

type Handler = (event: FxEvent) => void;

class FxBus {
    private handlers = new Set<Handler>();

    subscribe(handler: Handler): () => void {
        this.handlers.add(handler);
        return () => { this.handlers.delete(handler); };
    }

    publish(event: FxEvent): void {
        for (const handler of Array.from(this.handlers)) {
            try {
                handler(event);
            } catch (err) {
                console.error("Bashcrawl fx handler failed:", err);
            }
        }
    }
}

export const fxBus = new FxBus();
