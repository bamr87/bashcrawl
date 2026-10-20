# Authoring Courses

A course is a directory of Markdown files. You can add one without writing any JavaScript: the frontmatter carries the machine-readable parts, and the body is the lesson text learners read. It's the same shape as a bashOS slash command, one spec per file.

```text
courses/
  pipelines/
    course.md                 the course: frontmatter + intro
    01-grep.md                lesson 1
    02-first-pipe.md          lesson 2  (files are ordered by their NN- prefix)
    lab/                      practice files, seeded at /lab/pipelines/
      guild.log
      ledger.csv
```

`scripts/course_loader.py` compiles everything into `web/data/courses.json` (`make web-build`). Every surface then serves it: the web trainer, `bashcrawl tty` and the telnet server. `bashcrawl lab pipelines` copies the lab into a real directory for practice in a real shell.

## course.md

```yaml
---
id: pipelines                 # must match the directory name (kebab-case)
title: "The Pipeline Forge"
summary: "grep, sort, uniq, cut and the | that joins them."
level: intermediate           # beginner | intermediate | advanced
order: 3                      # position in the catalogue
requires: [reading]           # soft prerequisites: shown as "best after"
skills: [grep, sort, uniq]    # skills from progression.yaml's skill map
xp: 75                        # bonus for finishing the course (default 50)
---
The intro, shown once when a learner enrolls.
```

## NN-lesson.md

```yaml
---
title: "Your first pipe"
teaches: [pipes, "|", "wc -l"]
xp: 30                         # paid when every objective is met (default 25)
objectives:
  - text: "Count only the deposits: grep deposit guild.log | wc -l"
    when: {all: [{command: wc}, {piped: true}, {line_includes: grep}, {line_includes: deposit}]}
    hint: "grep picks the deposit lines; wc -l counts them"
    solution: "grep deposit guild.log | wc -l"
---
The lesson text, in Markdown. Headings, lists, `inline code` and fenced
code blocks render in every surface.
```

The lesson id comes from the file name (`02-first-pipe.md` → `first-pipe`), or from an explicit `id:`.

### Objectives

- `text` is the checklist line, and it should name the command to try.
- `when` is a [TermForge rule](schemas/rules.v1.md).
- `hint` is shown by `lesson hint`.
- `solution` is required. It's one command line that meets the objective from the lab root, after the objectives before it. The course test runs it.
- `allow_errors: true` lets a command that printed an error count. By default, a failed command never meets an objective.

Objectives can be met in any order, and once met they stay met. Rules are checked twice:

- after **each command**, with that command's context: `command`, `arg`, `option`, `piped`, `output_includes`, `line_includes`
- after **each line**, with state and filesystem only

The second check is why a redirect (`sort x > y`) meets a "y exists" objective on the same line.

### Rule cookbook

| The learner should… | `when:` |
|---|---|
| run a command | `{command: tree}` |
| run it with a flag | `{all: [{command: ls}, {option: a}]}` |
| run it on a file | `{all: [{command: cat}, {args_contains: ballad.txt}]}` |
| use it in a pipeline | `{all: [{command: wc}, {piped: true}, {line_includes: grep}]}` |
| see a specific result | `{all: [{command: find}, {output_includes: gem.txt}]}` |
| end up somewhere | `{all: [{command: cd}, {cwd: /lab/navigator/north}]}` |
| create or change a file | `{file_contains: /lab/pipelines/alice.txt, text: alice}` |
| make a directory | `{dir_exists: /lab/workshop/archive}` |
| delete something | `{all: [{command: rm}, {not: {file_exists: /lab/workshop/inbox/junk.old}}]}` |
| set a variable or alias | `{exists: envVars.GUILD}` / `{exists: aliases.ll}` |

Prefer absolute `/lab/<id>/…` paths in filesystem rules. The learner might be anywhere in the tree.

## The lab

Everything under `lab/` is seeded into the session as real, writable files under `/lab/<id>/` the first time a learner enrolls. Lessons can teach `>`, `mv` and `rm` on files that are safe to break, and `lab reset` restores them. Keep lab files small UTF-8 text (64 KB cap). Check that `git check-ignore` doesn't swallow a name: `*.tmp` is ignored repo-wide.

The seed happens once. Resuming a course (`learn NAME`) or typing `lab` never re-creates a file the learner removed or renamed, so an objective such as *remove junk.old* stays met; only `lab reset` and `learn restart` rewrite the lab. If you add a file to a lab after learners have it, they see it on their next `lab reset`.

`lesson skip` defers a lesson, it does not forgive it: the learner moves on without XP, a skipped lesson comes back once the others are earned, and the course bonus is paid only when every lesson has been. Design each lesson so it can be earned in any order after the first.

## Style

- **One paragraph per line**: the repo's prose rule, enforced by `tools/unwrap-prose.py` in CI.
- Start each course's first lesson with `cd /lab/<id>`.
- Keep a lesson to one idea, two to four objectives, and an example block.
- End with a **Real world:** line that ties the command to what people do with it at work.
- Use only what the emulator supports. If a solution fails, `courses.test.js` tells you which objective and shows the output.

## Checking your work

```bash
make web-build                     # compile courses.json (fails on authoring errors)
make validate-contracts            # ids, levels, rule structure, requires
node --test termforge/test/courses.test.js   # every lesson winnable, none free
bin/bashcrawl courses              # see it in the catalogue
```
