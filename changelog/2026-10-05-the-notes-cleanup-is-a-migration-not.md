## 2026-10-05 — The notes cleanup is a migration, not a skill mode

Moving an app's old topic notes files into `NOTES.md` was a "prune" mode inside `task-learn`. That was the wrong
home, for two reasons:

- **It loaded everywhere.** The skill's description carried the prune trigger words in every session, including
  apps that never had the old files.
- **It read as routine.** Sitting next to the normal end-of-task steps, it looked like something to run again. It
  isn't. Each app needs it once, and new apps never do.

It's now a plain instruction file, `v2/migrations/001-notes-into-one-file.md`. A plain file never loads on its
own, so it costs nothing in apps that don't need it. Its first step stops if none of the old files exist.

Later layout changes each get their own numbered file in the same folder. One file per migration means Claude reads
only the job it's running, and `doctor` can point at an exact path. The number shows the order an old app runs them
in. `v2/migrations/README.md` is the index: one row per migration, with what it changes and how to tell an app
needs it. A single `MIGRATIONS.md` was considered and rejected. Claude would read every migration each time, and
`doctor` would have to point at a section heading, which breaks when the heading is renamed.

Remembering which apps are old was the remaining problem, so `claude-rules doctor` now checks it. It warns when an
app's `docs/ai/` still has `PATTERNS.md`, `GOTCHAS.md` or `DECISIONS.md`, and prints the exact line to tell Claude.
The file list and the migration's path are each written once in the CLI, in `app-paths.mjs` and `layout.mjs`.

A routine `task-learn` run on an old app now stops and points at the migration. Otherwise it would add new notes
next to the old files, and repeat what the migration exists to remove.

One behavior change in `doctor` came with it. An app with several things worth a look used to show only the first:
a path with a space hid the "still to fill in" warning. All of them are now listed together.
