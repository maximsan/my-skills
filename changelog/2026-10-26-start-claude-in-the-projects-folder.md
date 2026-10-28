## 2026-10-26 — Start Claude in the projects folder, with tickets there

Most work starts in the projects folder, where Claude can reach every app at once. The setup assumed Claude starts
inside one app, so from the projects folder three things broke:

- No skills, until Claude opened a file in an app. PR #14 had removed the projects-level skills link.
- The search for past tickets found none, because tickets were already kept as `investigations/<app>/<TICKET>/` in
  the projects folder, and the skills looked inside the app.
- An app's `CLAUDE.local.md`, with its build and test commands, wasn't loaded until a file in the app was opened.

Now:

- `setup` links `projects/.claude/skills` again, and `doctor` checks it. `add-app` still links each skill into each
  app, for starting there: an app that is its own git repo never reads the folder above it.
- The common rules define the projects folder and the task folder, `investigations/<app>/<TICKET>/`, once. The
  skills point at it, and the past-work search covers every app.
- Started in the projects folder, Claude names the app first, then reads its `CLAUDE.local.md` itself.
- `add-app` no longer creates `investigations/` in each app.

Tested with Claude Code 2.1.308 on macOS. Started in the projects folder, Claude loaded an app's `CLAUDE.local.md`
only once it had opened a file in that app.

What it costs: started in the projects folder, every app Claude opens adds a second copy of each skill to the list,
named like `my-app:debug`. Both copies are the same files.
