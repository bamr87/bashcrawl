# Evidence: prompt bar polish (#112, #115)

Captured on 2026-11-15 from the Vite dev server (`npx vite --host 127.0.0.1 --port 5391`) in a real browser, Story mode, hero "Brynar". Desktop shots are a 1280×800 viewport downscaled to 800×500 by the capture tool; the mobile shot is 390×844 at 2×.

Path: a new game, `pwd`, then `cd /entrance/.chapel/courtyard/aviary/hall/library` (the deepest room the web world reaches by typing alone; `.study` needs a reveal first).

| File | What it shows |
| --- | --- |
| `desktop-prompt-before.png` | The prompt with `PromptBar.tsx` as on `main` at c9c2f04: `/entrance/.chapel/courtyard/aviary/ha…`, the room clipped off the end (#112). |
| `desktop-prompt-after.png` | The prompt with this change: `~/.chapel/…/library $`, nothing clipped. |
| `desktop-before.jpg`, `desktop-after-reload-recap.jpg` | The whole screen for the two prompts above, each right after a reload. Only `PromptBar.tsx` was reverted for the "before" shot, so both logs end with the new recap line `Welcome back — you're in /entrance/.chapel/courtyard/aviary/hall/library. Current quest: Eyes to See (type quest).` (#115). |
| `desktop-typed-line.jpg`, `desktop-after-ctrl-c.jpg` | `ls -la` typed, then Ctrl+C: the line is echoed dimmed as `… $ ls -la^C` and the prompt is empty (#115). |
| `desktop-shortcuts-ctrl-c.jpg` | The keyboard shortcuts dialog lists Ctrl+C (#115). |
| `mobile-after-reload.jpg` | At 390 px the prompt still reads `library $` (the narrow-screen `shortLabel()` is unchanged), and the recap line wraps cleanly. |

No console errors were logged during the session.
