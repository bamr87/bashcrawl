---
title: "Copying and moving"
teaches: [cp, mv, renaming]
xp: 25
objectives:
  - text: "Copy inbox/notes.txt into archive: cp inbox/notes.txt archive"
    when: {file_exists: /lab/workshop/archive/notes.txt}
    hint: "When the destination is a directory, the copy keeps its name"
    solution: "cp inbox/notes.txt archive"
  - text: "Move and rename the draft in one step: mv inbox/report-draft.txt archive/report.txt"
    when: {all: [{file_exists: /lab/workshop/archive/report.txt}, {not: {file_exists: /lab/workshop/inbox/report-draft.txt}}]}
    hint: "mv SOURCE NEW-PATH both moves and renames"
    solution: "mv inbox/report-draft.txt archive/report.txt"
---
- `cp SOURCE DEST` **copies**, so the original stays.
- `mv SOURCE DEST` **moves**, so the original is gone. There's no separate rename command: renaming is just moving to a new name.

If DEST is an existing directory, the file goes *inside* it and keeps its name.

```
cp inbox/notes.txt archive
mv inbox/report-draft.txt archive/report.txt
ls archive
```

Real world: before editing a config, copy it first. `cp nginx.conf nginx.conf.bak` is cheap insurance.
