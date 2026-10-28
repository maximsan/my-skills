## 2026-10-26 — Commands described once, and a review checklist for the CLI

After the skill links moved from `setup` to `add-app`, `docs/SETUP.md` still said `setup` links the skills. Neither
the change nor its review caught it, because five docs each described what the commands do.

- [The user guide](../docs/cli/user-guide.md) is now the one place that says what each command does. `SETUP.md`,
  the CLI's README and the glossary name the commands and link to it.
- [docs/cli/review.md](../docs/cli/review.md) lists what a reviewer checks that no test can: paths inside an app, fix
  commands that touch only our own files, and docs. Each rule comes from a bug the checks missed.

What it costs: a reader of `SETUP.md` follows a link to learn what a command does.
