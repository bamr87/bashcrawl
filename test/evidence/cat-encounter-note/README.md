# Evidence: `cat` on an encounter script (#114)

Captured with Playwright in Chromium against `web/dist` (built with `npm run build`), served by `python3 -m http.server` on 127.0.0.1, Story mode, on 2026-11-16. Desktop shots are a 1280×720 viewport; the mobile shot is 390×844. The log was scrolled so the command block sits below the floating quest card.

| File | What it shows |
|---|---|
| `desktop-before-cat-treasure.png` | Before: `cat treasure` in the cellar with `main`'s `runtime.js`. The script source starts straight after the command. |
| `desktop-after-cat-treasure.png` | After: the same command prints one dim line first, "treasure is an encounter, not a scroll: cast it with `./treasure`. `cat` shows its source, as on a real system.", then the unchanged source. `./treasure` and `cat` are click-to-type chips. |
| `mobile-cat-other-room.png` | After, at 390 px: `cat cellar/treasure` from the entrance. The note says to cd into its room and cast it with `./treasure`; the line wraps and the page has no horizontal scroll. |

No console errors came from the app. Two loads of the local static server reset connections under the parallel script requests (Python's `http.server` backlog), and a reload fixed them.
