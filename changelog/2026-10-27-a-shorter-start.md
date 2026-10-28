## 2026-10-27 — A shorter start

Getting started meant reading a 497-line `SETUP.md`, and the first task began with two long PowerShell commands.

- **`SETUP.md` is five steps:** put the repo next to your apps, install, set up and add the apps, check it works, and
  run your first task. It says how to update a copied folder, not only a clone.
- **The rest moved where its readers look.** Troubleshooting, removing the setup and setting it up by hand are in
  [`docs/TROUBLESHOOTING.md`](../docs/TROUBLESHOOTING.md). The lite version of the loop, what to do after five tasks
  and why your notes don't show in `git status` are in [`docs/HOW-IT-WORKS.md`](../docs/HOW-IT-WORKS.md). Keeping
  the rules short is in [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- **`claude-rules new-task <app> <ticket>`** creates the ticket's folder and `task.md`, and prints the
  `/task-investigate` line to give Claude. Once an app is added, the menu suggests it.
- **Claude fills in an app's notes on its first task there:** the commands, run once each to check them, the folder
  layout, and the Exemplars. It waits for your approval before its first edit. `add-app` no longer asks for Exemplars,
  and `doctor` no longer warns about unfilled notes.
- **`doctor` reads your answer to Claude's import question** from Claude Code's `~/.claude.json`. A No fails, with the
  fix. When the file can't be read, it says "can't tell", and keeps its old reminder.
- **`investigations/` and `docs/` in the projects folder no longer count as apps.**
- **Each app's notes no longer copy a table of the `docs/ai/` files**, which went stale in every copy.
- **Running `setup` or `add-app` again asks less.** `setup` asks "Your apps live in …?" only the first time, and
  offers "Add an app now?" only while an app isn't added. `add-app` on an added app keeps the stacks in its
  `CLAUDE.local.md`, instead of asking again with the detected ones marked.
- **The upgrade from the old manual setup is gone**, now that every app has been moved over. Removed:
  - the `migrations/` folder, and the upgrade steps in `TROUBLESHOOTING.md`;
  - `task-learn`'s stop on old notes files;
  - three `doctor` checks: old notes files, a `CLAUDE.md` line in the global git ignore file, and stack lines in
    `projects/CLAUDE.md`.
- **`task.md` follows the shape tickets already have:** Description, Steps to Reproduce, Actual Behavior and Expected
  Behavior. A new "Important" section starts with the reminders most tickets repeat, such as which `docs/` pages to
  read and which app owns the flow.
