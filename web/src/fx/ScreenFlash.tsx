// Renders the flash queue as overlays on the fx layer.
import { endFlash, useFlashes } from "./flash-store";

export function ScreenFlash() {
    const items = useFlashes();
    if (!items.length) return null;
    return (
        <>
            {items.map((item) => (
                <div
                    key={item.seq}
                    className="bc-flash"
                    data-kind={item.kind}
                    aria-hidden="true"
                    onAnimationEnd={() => endFlash(item.seq)}
                />
            ))}
        </>
    );
}
