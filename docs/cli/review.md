# Reviewing a CLI change

Read this with the diff, after `npm run check` passes. Lint, types and tests already cover everything they can, so
these are only the calls a reader has to make. Each one comes from a real bug that passed every check.

## Paths inside an app

- **Check every level of a path before writing under it, without following links.** For `.claude/skills/debug`,
  look at `.claude` and `.claude/skills` too. A file there stops the write; a link there sends it into another
  folder, and git refuses to look past it. `lib/skill-links.mjs` reads each level with `inspectPath`.
- **A link is ours only when it points at this repo.** Any other link, or a real folder, belongs to the team or to an
  older setup. Report it, and leave it alone.

## Fix commands

- **A fix command names only our own paths.** `git rm -r --cached .claude/skills` would also untrack the team's
  committed skills; `git rm -r --cached -- .claude/skills/debug` doesn't. Read every printed command as if the team
  had their own files next to ours.
- **Every new blocked or skipped case has a test** that shows its reason and its fix command.

## Docs

- **What a command does is described once, in [the user guide](user-guide.md).** A change to a command updates that
  guide. Then search `docs/`, `cli/README.md` and `README.md` for the command's name and the old behaviour: every
  other mention links to the guide and doesn't repeat it.
- **Every doc comment matches the code it sits on.** Read each changed comment against its code. Comments written by a
  helper agent need this most.
- **A changelog entry**, as a new file in `changelog/`, for any change made for a reason worth keeping.
