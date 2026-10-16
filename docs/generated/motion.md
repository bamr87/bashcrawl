# Motion Clips and Art

Generated from `src/help/data/motion.yaml`. Every file below is an
[ASCII Motion](https://github.com/cameronfoxly/Ascii-Motion) `.asciimtn`
session: open it at <https://ascii-motion.app>, edit, export a session, and
replace the file. Workflow:
[docs/termforge/ascii-motion.md](../termforge/ascii-motion.md).

## Stage clips

| Motion | Title | Aliases | File | Plays on |
|---|---|---|---|---|
| `radar` | Radar sweep | — | `motion/clips/radar.asciimtn` | A sweep arm rotates around the player's position — pwd, whoami. |
| `scan` | Room manifest | — | `motion/clips/scan.asciimtn` | A scanline runs down a manifest of the room's exits and items — ls. |
| `warp` | Warp ring | `climb`, `rewind`, `home` | `motion/clips/warp.asciimtn` | A portal ring opens and collapses — cd, and unlocking a hidden room. |
| `spark` | Spark burst | — | `motion/clips/spark.asciimtn` | Particles scatter outward — quest progress, inventory, xp. |
| `cast` | Casting circle | — | `motion/clips/cast.asciimtn` | A rune circle charges around a sigil — running ./scripts, and level-ups. |
| `steam` | Steam engine | — | `motion/clips/steam.asciimtn` | The train puffs across the stage — sl. |
| `burn` | Burning crate | — | `motion/clips/burn.asciimtn` | A crate catches fire and burns down — rm. |
| `error` | Warning sign | — | `motion/clips/error.asciimtn` | A flashing "do not enter" sign — unknown commands and failures. |

Game events that replace the command's motion (first match wins):

- `levelup` → `cast`
- `quest` → `spark`
- `unlock` → `warp`

## Art

Static one-frame clips drawn with `Shell#art(name)`.

| Name | Title | File | Used for |
|---|---|---|---|
| `banner` | Title banner | `motion/art/banner.asciimtn` | The BASHCRAWL logo the session opens with (and `banner`). |
| `landing-brand` | Landing logo | `motion/art/landing-brand.asciimtn` | The logo on the first-visit landing card (web/index.html data-art). |
| `encounter-treasure` | Treasure chest | `motion/art/encounter-treasure.asciimtn` | Portrait for ./treasure. |
| `encounter-monster` | Coiled serpent | `motion/art/encounter-monster.asciimtn` | Portrait for ./monster. |
| `encounter-ghost` | Restless ghost | `motion/art/encounter-ghost.asciimtn` | Portrait for ./ghost. |
| `encounter-potion` | Glowing potion | `motion/art/encounter-potion.asciimtn` | Portrait for ./potion. |
| `encounter-statue` | Stone guardian | `motion/art/encounter-statue.asciimtn` | Portrait for ./statue. |
| `encounter-goblet` | Jeweled goblet | `motion/art/encounter-goblet.asciimtn` | Portrait for ./goblet. |
| `encounter-spell` | Igniting rune | `motion/art/encounter-spell.asciimtn` | Portrait for ./spell. |
| `encounter-crystal` | Murmuring crystal | `motion/art/encounter-crystal.asciimtn` | Portrait for ./crystal. |
| `encounter-penguin` | Dapper penguin | `motion/art/encounter-penguin.asciimtn` | Portrait for ./penguin. |
| `encounter-nyarlathotep` | The crawling chaos | `motion/art/encounter-nyarlathotep.asciimtn` | Portrait for ./nyarlathotep. |
| `encounter-fountain` | Wishing fountain | `motion/art/encounter-fountain.asciimtn` | Portrait for ./fountain. |
| `room-entrance` | Entrance vignette | `motion/art/room-entrance.asciimtn` | Room panel art for the entrance and workshop. |
| `room-cellar` | Cellar vignette | `motion/art/room-cellar.asciimtn` | Room panel art for the cellar, armoury, and chamber. |
| `room-graveyard` | Graveyard vignette | `motion/art/room-graveyard.asciimtn` | Room panel art for the chapel and graveyard. |
| `room-vault` | Vault vignette | `motion/art/room-vault.asciimtn` | Room panel art for the vault and stronghold. |
| `room-rift` | Rift vignette | `motion/art/room-rift.asciimtn` | Room panel art for the rift. |
| `room-deep` | Deep vignette | `motion/art/room-deep.asciimtn` | Room panel art for every other room. |
| `arena-open` | Training arena | `motion/art/arena-open.asciimtn` | Header for the `train` drills. |
| `arena-done` | Arena cleared | `motion/art/arena-done.asciimtn` | Footer when a `train` run ends. |
| `pathfind` | Compass rose | `motion/art/pathfind.asciimtn` | Header for `pathfind` journeys. |
| `levelup` | Level up | `motion/art/levelup.asciimtn` | Burst printed on a level-up. |
| `profile` | Character sheet | `motion/art/profile.asciimtn` | Header for `profile`. |

Framework defaults (`termforge/motion/`, bundled into `termforge/core/art.js`;
an app's `art` option overrides them by name): `banner`, `cow`, `sl`.
