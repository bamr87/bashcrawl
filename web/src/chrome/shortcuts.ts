// The one list of keyboard shortcuts (UPS-FE-22), rendered by ShortcutsHelp
// and the footer. None of them override browser defaults.
export interface Shortcut {
    keys: string[];
    does: string;
}

export const SHORTCUTS: Shortcut[] = [
    { keys: ["Enter"], does: "run the command in the prompt" },
    { keys: ["Tab"], does: "complete a command or file name" },
    { keys: ["↑", "↓"], does: "walk back through your command history" },
    { keys: ["Alt", "1–4"], does: "switch door: Story · Learn · Arcade · Reference" },
    { keys: ["F1"], does: "open or close the documentation drawer" },
    { keys: ["Ctrl", "L"], does: "clear the log" },
    { keys: ["?"], does: "this list (with an empty prompt)" },
    { keys: ["Esc"], does: "close a dialog or the side panels" },
];
