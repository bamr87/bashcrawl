// Where you are: the room's name and path, its ambient vignette (an ASCII
// Motion loop that crossfades when the area changes) and what is in it.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef } from "react";

import { game, useModel, type GameStore } from "../engine/game-store";
import type { AsciiClip } from "../engine/types";
import { useAmbientClip } from "../fx/useAmbientClip";

function Vignette({ clip, art, roomKey }: { clip: AsciiClip | null; art: string[]; roomKey: string }) {
    const ref = useRef<HTMLPreElement>(null);
    useAmbientClip(ref, clip, true);
    return (
        <motion.pre
            ref={ref}
            className="bc-vignette"
            data-room-art={roomKey}
            aria-hidden="true"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3, filter: "blur(1.5px)" }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        >
            {clip ? "" : art.join("\n")}
        </motion.pre>
    );
}

export function RoomPanelBody({ store = game }: { store?: GameStore }) {
    const room = useModel("roomModel", store);
    const key = room.vignette.key;
    const clip = useMemo<AsciiClip | null>(() => {
        const library = store.runtime?.artLibrary() ?? null;
        return library ? library.get(`room-${key}`) ?? library.get("room-deep") : null;
    }, [store, key]);
    return (
        <>
            <p className="bc-room-title">{room.title}</p>
            <p className="bc-muted bc-room-path">{room.path}</p>
            <div className="bc-vignette-slot">
                <AnimatePresence mode="popLayout" initial={false}>
                    <Vignette key={key} clip={clip} art={room.vignette.art} roomKey={key} />
                </AnimatePresence>
            </div>
            <p className="bc-group-label">In this room</p>
            {room.entries.length ? (
                <ul className="bc-list bc-room-entries">
                    {room.entries.map((entry) => (
                        <li key={entry.name} data-type={entry.type}>
                            <span aria-hidden="true">{entry.icon} </span>{entry.name}{entry.marker}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="bc-muted">(empty)</p>
            )}
        </>
    );
}
