# Content Registry Contract (v1)

> The minimum fields `rooms.yaml`, `encounters.yaml` and `quests.yaml` must carry for the shell and Python runtimes, and how CI enforces them.

This contract defines the minimum fields used by both shell and Python runtimes.

## `rooms.yaml`

- Top-level key: `rooms` (mapping).
- Each room entry must include:
  - `path` (logical path, e.g. `entrance/cellar`)
  - `hidden` (boolean)
  - `children` (list of room names)
  - `description` (string)

## `encounters.yaml`

- Top-level key: `encounters` (mapping).
- Each encounter entry must include:
  - `script` (script file name)
  - `room` (room slug where script exists)
  - `type` (encounter type)
  - `description` (string)

## `quests.yaml`

- Top-level key: `quests` (list).
- Each quest entry must include:
  - `id` (integer)
  - `title` (string)
  - `completion.command` (string)
- A quest may add `steps`: its checklist, a non-empty list of `{label, when}` entries with distinct labels, where `when` is a [TermForge rule](rules.v1.md) over the session state. The web Quest panel, the story tracker and the terminal HUD draw the steps under the objective and tick each one while its rule holds; a step that newly holds emits one `quest-step` HUD event (`Hud.diffEvents`). Steps are feedback only: they grant no XP, and `completion` alone finishes the quest. `make validate-contracts` rejects a malformed entry.

## CI enforcement

- `scripts/generate_content_index.py --check` validates disk/registry/walkthrough consistency.
- `scripts/validate_walkthrough_fs.py` validates room paths, encounter paths, and non-empty scrolls.
