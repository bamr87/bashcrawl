// `?` (or the header button) opens the one list of keyboard shortcuts
// (UPS-FE-22). None of them override browser defaults.
import { Dialog } from "./Dialog";
import { SHORTCUTS } from "./shortcuts";
import { setUi, useUi } from "./ui-store";

export function ShortcutsHelp() {
    const { helpOpen } = useUi();
    return (
        <Dialog open={helpOpen} title="Keyboard" onClose={() => setUi({ helpOpen: false })}>
            <dl className="bc-shortcuts">
                {SHORTCUTS.map((row) => (
                    <div key={row.does} style={{ display: "contents" }}>
                        <dt>
                            {row.keys.map((key, i) => (
                                <span key={key}>
                                    {i > 0 && <span aria-hidden="true"> + </span>}
                                    <kbd className="bc-kbd">{key}</kbd>
                                </span>
                            ))}
                        </dt>
                        <dd>{row.does}</dd>
                    </div>
                ))}
            </dl>
        </Dialog>
    );
}
