# One repo sets up every Mac and project

This repo becomes the one home for the owner's [shared set](../GLOSSARY.md). Each of these choices had a real
alternative:

- **Personal Macs only.** The Windows work machine keeps its own copy of this repo. Its parts stay in `w365/` and
  follow its rules, including the Claude Code 2.1.39 limit. It uses the same pnpm and Node setup as the rest.
- **Four coding agents:** Claude Code, Codex, Cursor and OpenCode. Each gets every part it supports. A part it can't
  take is listed as a gap, not worked around.
- **Two ways to deliver the shared set:**
  - [Agent-wide items](../GLOSSARY.md) are linked once per Mac by `claude-rules setup`: instructions, skills, agent
    hooks, command policies and dotfiles. Skills stay links, not an npm package.
  - [Project items](../GLOSSARY.md) are npm packages under `@maximsan`, published by a GitHub workflow through npm
    trusted publishing, with no token. Shared GitHub workflows are reusable workflows named `reusable-*.yml`.
  - `claude-rules add-project` adds what a project is missing: its packages, files and MCP servers. A project that
    isn't a Node project gets no npm packages.
- **One tool, not two.** `claude-rules` keeps one shared core. The Mac commands (`setup`, `doctor`, `add-project`)
  and the w365 commands (in `w365/`) build on it.
- **One global instruction file,** linked into each agent's place for it. Cursor has no such place, so its copy is
  pasted by hand, and `doctor` reports when that copy is out of date. It is built from `rules/common.md` and
  `rules/workflows/github-flow.md`. The work machine reads the same `common.md` with `task-flow.md`, so a rule both
  share is written once.
- **One list of [command policies](../GLOSSARY.md),** such as asking before `git push`. `setup` writes it into each
  agent's own format. The approvals an agent saves on its own stay outside the repo, because the agent rewrites that
  file.
- **`setup` owns only the settings that carry the owner's rules.** In Claude Code that is hooks, command policies,
  the `AGENTS.md` setting, attribution and skill overrides. Plugins, model, effort and other settings stay per Mac.
- **`AGENTS.md` is each project's only instruction file.** `setup` sets Claude Code to read `AGENTS.md` alongside any
  `CLAUDE.md`, so a stray `CLAUDE.md` can't hide it.
- **A project's MCP servers live in the project,** set up for every agent that supports them.
- **The dotfiles live here,** in `dotfiles/`, without the old repo's history. They are linked by the same `setup`.
  Volta is the only Node manager.
- **A ruling saved in an agent's private memory moves into the shared instructions or these docs,** so every agent
  sees it.
- **An item is shared when it would work unchanged in any project of its kind,** even before a second project uses
  it.
- **The repo's own tooling:**
  - pnpm workspaces;
  - JavaScript with JSDoc types, checked by `tsc`;
  - Vitest;
  - Changesets for every package's version and changelog;
  - Node 24 or later for the repo's tools. A published package declares the oldest Node it works on;
  - no task runner until the full check gets slow;
  - no branch protection while the owner is the only contributor.

  ESLint stays until the shared lint review picks between it, Biome and Oxlint.

**Cost:**

- Merging, publishing and the work machine's copy all depend on one repo.
- The w365 commands keep working on the core, so a change to the core must keep them passing.
- Renaming the repo's folder breaks every link until `setup` runs again.
- Cursor's global rules can drift between `doctor` runs.
- Nothing but the instructions stops an agent from pushing to `main`.
