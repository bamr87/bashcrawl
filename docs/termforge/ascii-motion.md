# ASCII Motion in TermForge

Every picture TermForge and Bashcrawl draw is an [ASCII Motion](https://github.com/cameronfoxly/Ascii-Motion) file. That covers the command-stage animations, the encounter portraits, the room vignettes, the banners, and the cow in `cowsay`. No art is written into the code as string literals. Each file is a `.asciimtn` session, the format the editor at
<https://ascii-motion.app> opens and saves. So changing a picture means opening
the file in the editor, not editing JavaScript.

## Where the art lives

| Files | Registry | Bundled into | Drawn by |
|---|---|---|---|
| `termforge/motion/*.asciimtn` (banner, cow, sl) | file name | `termforge/core/art.js` (`TermForge.art`, vendored) | `Shell#art(name)`, the flavour pack |
| `motion/art/*.asciimtn` (banner, encounters, rooms, …) | `src/help/data/motion.yaml` `art:` | `web/assets/js/art-clips.js` | the game `Runtime` (`art` option), `hud.js`, `shell.js` (`data-art`) |
| `motion/clips/*.asciimtn` (radar, scan, warp, …) | `src/help/data/motion.yaml` `clips:` | `web/assets/js/fx-clips.js` (+ manifest) | `fx.js` (web stage), `apps/bashcrawl-motion.js` (TTY/telnet stage) |

`scripts/build_motion.py` (run by `make web-build`) writes all three bundles. `make web-test`, `make test`, and CI fail when a bundle is stale. The generated index is [docs/generated/motion.md](../generated/motion.md).

## Workflow: change a picture

1. Open the `.asciimtn` at <https://ascii-motion.app> (☰ → Import, or drag the file in).
2. Draw. Add frames, color, layers, keyframes, or effects. All of it plays (see below).
3. Export → **Session (.asciimtn)** and save it over the original file.
4. Preview it in a terminal: `make motion CLIP=motion/art/encounter-ghost.asciimtn`.
5. `make web-build && make validate-contracts && make test-js`, then commit the
   `.asciimtn` together with the regenerated bundles.

## Workflow: add a picture

- **Art the game prints:** save `motion/art/<name>.asciimtn`, add
`art.<name>` (file, title, description) to `motion.yaml`, then draw it with `this.art("<name>")` in the runtime. Encounter portraits are found by name (`encounter-<script basename>`), and so are room vignettes (`room-<key>` for each key in `BashcrawlHud.VIGNETTE_KEYS`). Page markup uses `<pre data-art="<name>"></pre>`. The validator fails when the code asks for a name with no registry entry.
- **A stage animation for a command:** save `motion/clips/<motion>.asciimtn`,
where `<motion>` is a motion name from `web/assets/js/fx.js`. Then add `clips.<motion>` to `motion.yaml`. `aliases` reuse a clip for other motions, and `events` let a game event (levelup/quest/unlock) replace the command's motion.
- **Framework default art:** save `termforge/motion/<name>.asciimtn`. It has
  to stay brand-neutral (`test/content-separation.test.js`).

Have existing text art? Convert it with `node termforge/node/motion-cli.js from-text art.txt --name ghost -o motion/art/ghost.asciimtn`.

## The CLI

```bash
node termforge/node/motion-cli.js info FILE...          # size, frames, duration, warnings
node termforge/node/motion-cli.js cat FILE [--frame N] [--ansi]
node termforge/node/motion-cli.js play FILE [--loop] [--speed X] [--plain]
node termforge/node/motion-cli.js session FILE [-o OUT]  # any format -> .asciimtn v1 (flattens v2)
node termforge/node/motion-cli.js from-text FILE|- [-o OUT] [--name N] [--color HEX]
node termforge/node/motion-cli.js text FILE              # -> text export
make motion CLIP=motion/clips/warp.asciimtn ARGS="--loop"
make motion-info
```

Session files are written one cell per line, so diffs stay reviewable.

## What plays

`core/ascii-motion.js` (`TermForge.asciiMotion`) reads every open format the editor writes:

- the JSON export (`frames[].content` and color maps; the MCP server's `cells` form)
- the text export (frames split on a lone `,`)
- HTML frame grids
- session v1 (`animation.frames[].data`)
- session v2 layer timelines (`version` 2.x with `layers`), flattened frame by frame like the editor's compositor:
  - layer z-order, visibility, solo, and hidden content frames
  - layer groups (group transform and visibility)
  - keyframed position, scale, rotation, and anchor, with the editor's cubic-bezier easing presets and custom curves, plus keyframe looping
  - effect tracks at layer, group, and global scope, active only inside their time range, with keyframed settings

Identical neighbouring frames merge into one longer frame.

The cell effects use the editor's own settings and math: `levels`, `hue-saturation`, `remap-colors`, `remap-characters`, `scatter`, `wave-warp` (`axis`/`frequency`/`amplitude`/`speed`/`phase`), `wiggle` (wave modes, and a `noise` mode ported from simplex-noise so the offsets match), and `motion-trails` (`trailCount`/`frameDelay`/`trailColorN`, reading earlier frames). One deliberate difference: time effects use the session's real frame rate, where the editor's compositor assumes 12 fps.

Not rendered: procedural generator layers and WebGL post effects. `flattenSession` lists them in `clip.warnings`, and `motion-cli.js info` prints those warnings. To use them, bake the generator into frames in the editor first.

API: `parse`, `flattenSession`, `Player`, `renderFrame` (cells, text, 24-bit ANSI, Line-protocol `art` records), `Library` (named clips + aliases, each parsed once), `describe`, `toSession`, `toText`, `evaluateEasing`, `interpolateKeyframes`.

## Authoring with an AI agent (optional)

The [`ascii-motion-mcp`](https://www.npmjs.com/package/ascii-motion-mcp) MCP server lets an agent draw and animate in the editor. The original stage clips were made with it. It is not in the repo's `.mcp.json`, so the blank-slate playtest never starts it. To use it, add it to your own client config:

```json
{
  "mcpServers": {
    "ascii-motion": {
      "command": "npx",
      "args": ["-y", "ascii-motion-mcp", "--live", "--project-dir", "motion"]
    }
  }
}
```

Ask the agent to export a **session**, save it under `motion/`, and register it in `motion.yaml`. Then follow the workflow above.

## Out of scope

- **Terminal-core** (`entrance/` scrolls and encounter scripts) is pure POSIX
shell played with real `cat`. Its heredoc art stays plain text, because the game has no dependencies and no JSON reader.
- **`node/gem.js` sprites** are pixel bitmaps for the half-block `PixelBuffer`,
  not text art. The golden pixel-identity contract pins them.
