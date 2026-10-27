# motion/

> Where Bashcrawl's ASCII Motion art lives — stage clips and static art — and how to change a picture.

Every picture Bashcrawl draws is an [ASCII Motion](https://ascii-motion.app) session file here:

- `clips/`: command-stage animations (radar, scan, warp, ...).
- `art/`: static art (banner, encounter portraits, room vignettes, ...).

Each file is registered in [`src/help/data/motion.yaml`](../src/help/data/motion.yaml) and bundled by `make web-build`. To change a picture, open the `.asciimtn` in the editor, export a session over the file, and rebuild. Preview with `make motion CLIP=motion/art/encounter-ghost.asciimtn`. Full workflow: [docs/termforge/ascii-motion.md](../docs/termforge/ascii-motion.md).
