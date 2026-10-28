## 2026-10-27 — Calmer output from every command

A plain `add-app` printed about 45 lines, and the part to act on was the last five. The same facts were repeated, and
long paths filled whole lines. Now:

- **Each step is reported once.** When a step ends, its progress line turns into its result, so the separate list at
  the end is gone. One line closes the run, e.g. "All 5 done."
- **Locations read from your home folder**, e.g. `~/projects/web-shop` instead of `C:/Users/<you>/projects/web-shop`.
  The install tip is now `npm install -g .`, run in the repo's folder.
- **The header is one line:** the title, then what the command may change. Its description stays in the menu and
  `--help`.
- **The plan says what each step will do, once:** "create the link" instead of "will do: there's no link yet; setup
  creates it".
- **`doctor` lists an app's findings one per line**, under the app, with one fix for the notes file.
- **Skills are counted the same way everywhere.** `add-app` said "13 folders" where `setup` said "12 skills", because
  it counted the folder the skills share.
- **`add-app` offers the next app** when it ends: "Add another app? 9 left."
- **The numbered list wraps each description** in its own column. Terminals that can't send single key presses get
  that list.

What stays the same: the order of the stages, every question, `--yes`, `--dry-run`, the exit codes, every safety
check and every `Fix:` line.
