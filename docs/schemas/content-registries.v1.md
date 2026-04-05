# Content Registry Contract (v1)

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

## CI enforcement

- `scripts/generate_content_index.py --check` validates disk/registry/walkthrough consistency.
- `scripts/validate_walkthrough_fs.py` validates room paths, encounter paths, and non-empty scrolls.
