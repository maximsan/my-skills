## 2026-10-25 — Skills are linked in each app, one link per skill

Claude Code skipped the skills link `setup` made at `projects\.claude\skills` in every app that is a git repo. It
reads skills from a folder above the app only when the app isn't its own git repo. Tests on macOS and Windows showed
it; the macOS tests used Claude Code 2.1.308:

- a skill in `<folder>/.claude/skills`, with Claude started in `<folder>/app`, and the app a git repo: not found;
- the same, with the app not a git repo: found;
- the same skill in `<folder>/app/.claude/skills`: found.

So `add-app` now makes the links, in each app:

- One link per skill, `.claude/skills/<name>` → `prompts/skills/<name>`. A team that commits its own skills in
  `.claude/skills` keeps them; a skill of theirs with the same name as ours is left alone.
- One more link, to `skills/shared/`. Claude Code resolves a skill's `../shared/` from the link's path, not from
  `prompts/skills`, so the shared files need a link beside the skills.
- Each link goes in the app's `.git/info/exclude`. The line has no slash at the end, because git sees a link as a
  file, and a line ending in `/` never matches it.
- Committed skill links, or one link for the whole `.claude/skills` folder from the manual setup, stop `add-app` with
  the command that fixes it. So does a link to an old `prompts` folder, or to a skill that's gone. The tool never
  changes what git tracks, and never removes a link itself.

Rejected:

- One link for the whole folder. New skills would reach every app at once, but it can't sit beside a team's own
  `.claude/skills`.
- A link in `~/.claude/skills`. Claude would see the skills in every repo on the machine, not only the apps.

What it costs: a skill added to `prompts/skills` later reaches an app only when `add-app` runs there again. `doctor`
lists the app as not set up until then.

`setup` no longer makes the projects-level link. If one is left from an older version, `doctor` gives the command that
removes it, and nothing removes it automatically.
