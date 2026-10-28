# Claude rules and skills

Rules and skills for Claude Code that fix five specific things:

- **It describes code it never opened.** Now every claim comes with the file and line, so guessing is visible.
- **It assumes instead of asking.** Now questions get written down and sorted before any get answered.
- **It leaves a mess when it changes approach.** Now every pivot gets a written checkpoint — what still holds, what
  to delete, where to restart — and the diff gets checked both ways before anything is called done.
- **It loses the thread while debugging.** Now every hypothesis, check, and log excerpt goes in `debug.md`, which it
  re-reads before answering each follow-up.
- **It learns nothing between tasks.** Now what it worked out goes in a file the next session reads.

Written for Windows (`projects\` layout, PowerShell commands), but nothing in the rules or skills is
platform-specific — only the setup commands are.

**Cost:** a few minutes to install. Then roughly 10–15 extra minutes on a ticket, most of it you reading two
files. Worth it on anything non-trivial, not worth it on a typo — [the loop](docs/HOW-IT-WORKS.md#the-loop) says what
to skip.

## Start here

1. **See what it does:** [docs/EXAMPLE.md](docs/EXAMPLE.md), one real bug, start to finish.
2. **Set it up, and run your first task:** [docs/SETUP.md](docs/SETUP.md), five steps, about fifteen minutes.

Later, when you need them:
- [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md): how a task flows through the skills, and where the files live.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): what to do when something doesn't work.
- [docs/GLOSSARY.md](docs/GLOSSARY.md): the terms this project uses in its own sense, in plain words.
- [docs/FUTURE.md](docs/FUTURE.md): planned work, and what it will need.

## Install

With this repo in the folder that holds your apps, run these in its folder:

```bash
npm install -g .
claude-rules
```

The menu walks you through `setup`, once per computer, and `add-app`, once per app. Then `claude-rules new-task`
starts each ticket, and `claude-rules doctor` checks everything at any time.

## What's where

| Folder | What's in it |
|---|---|
| `docs/` | Setup, the worked example, how it works, the glossary, planned work, and the setup tool's guides |
| `rules/` | `common.md` for every task in every app, plus one file per kind of app: React, TypeScript, microfrontends |
| `skills/` | The skills, one folder each |
| `templates/` | Templates copied into each app |
| `cli/` | The `claude-rules` setup tool |
| `legacy/` | The original prompts, kept as a record |

## Changing this repo

```
npm install
npm run check
```

```
npm run changelog
```

`npm install` sets up the development tools, once. `npm run check` lints and type-checks the setup tool, runs its
tests, and checks the changelog entries. Every change made for a reason gets an entry: a file in
[`changelog/`](changelog/README.md). `npm run changelog` builds `CHANGELOG.md` from them, to read the whole history as
one page. Commit messages follow [CONTRIBUTING.md](CONTRIBUTING.md#commit-convention).
