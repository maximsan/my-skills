# Planned work

What's planned but not built yet, and what it will need. Remove an entry once it ships.

## Skills that edit tickets on GitHub

Skills that create and edit GitHub issues from a task folder. They'll run the GitHub CLI, `gh`, so every computer that
uses them needs it installed and signed in.

## One setup for every agent and machine

The goal is one set of rules, skills and checks that Claude Code, Codex, OpenCode and Cursor all follow, on the owner's personal Macs.

Decided:

- This repo holds the shared setup for the owner's personal Macs. The work laptop keeps its own fork of this repo, so
  no Windows setup is planned here.
- A small install script and a read-only check for anything out of sync do the work. Git gives history and undo. A failed install is fixed by hand.
- Each agent gets the setup through its own supported mechanism, and a project's own rules can only tighten it.
- `~/.agents/skills` stays the folder agents find skills in, linked to this repo.

### Next steps, in order

1. **Bring in the Mac's skills and hooks.** They sit outside git today: `check-prose`, `disk-audit`, `pr-description`, `repo-checks`, `review-and-fix` and the hooks. Read each for private details first, because this repo is public. Personal settings files stay out. Bring each script's lint findings to zero with this repo's ESLint config as it moves in: most are spacing and line
   breaks, which `eslint --fix` corrects.
2. **Merge `my-dotfiles` into this repo, keeping its history.** That repo is public, so before
   [its open PR](https://github.com/maximsan/my-dotfiles/pull/1) merges, decide what in its `.gitconfig` stays
   private. After it merges, follow its "After merging" steps. Then merge the repo in.
3. **Write the install script and the check.** The script stops with a clear message if Git is older than 2.54 or
  `node` is missing. The global git hooks need both. Run the hook tests from `npm run check`.
4. **Prove each agent loads the setup.** A fresh session in each agent must show the expected rules and skills. Back up the current files first.

### Postponed

Each item waits for the steps above, unless it says otherwise.

**Parts built for the work machine**

- The `claude-rules` setup tool, `rules/workflows/task-flow.md` and the task skills were built for the work laptop.
  Decide which of them the personal Macs use.
- Turn the rules for TypeScript, React and microfrontends into skills, so each loads only for that kind of work. They
  are `rules/typescript.md`, `rules/react.md` and `rules/microfrontend.md`. Put them next to the `using-zod` skill.
  Merge the general parts of `typescript-diagnostics`, from the `maximsan` project, into the TypeScript skill. Review
  the new skills' wording line by line.

**Other repos**

- Merge `devkit` into this repo, keeping its history, after `my-dotfiles`. Combine its `devclean` command with `disk-audit`, which overlap.

**The Mac's global rules**

- Shrink `~/.claude/CLAUDE.md` to pointers at `rules/common.md` and `rules/workflows/github-flow.md`. Personal lines, such as the owner's language, stay in that file.
- Remove the Cloudflare rule from that file once a provider skill covers it. Move the design rules out at the same time, because `design-preferences` now holds them.

**Agent gaps**

- OpenCode has no temp-clone warning and no temp-folder rule. It reads the global `CLAUDE.md` as a fallback for now.
- Cursor's app was removed from the Mac, so its hooks are untested. When it's back, test them.
- **Owner's note:** paste this into Cursor under Customize → Rules, because its global rules live in that settings screen:

  > Before you finish, push every commit worth keeping.

- The review gate runs in Claude Code, Codex and OpenCode. Add it to Cursor once the app is back.
- Rename or retire existing `codex/` branches. The branch-name rule only stops new ones.
- Replace the old Codex command-line install. It can't read the current config, so `codex` fails in a terminal.
- Test `review-and-fix` in Codex and OpenCode, because it depends on each agent's sub-agents.
- The `git add` and zsh gates run only in Claude Code. The prose gate checks only `gh` issue and PR bodies in the other agents, and not questions or file edits.
- Check that Codex and OpenCode run their hooks in a real session. So far they have run only with sample input.

**Clean-up found along the way**

- Move app-specific details out of the global Claude settings and into that app.
- Fix the skills that point at a missing `~/.agents/references/definition-of-done.md`.
- Compare which skills each agent can start on its own. Claude Code limits many of them to manual use, and Codex doesn't.
- Pick one PR workflow from `pr` and `pr-description`.
- Point `pr-description` and `review-and-fix` at the shared rules instead of the global `CLAUDE.md`.
- Review the skills kept inside projects: `flutter-mobile-design` in `brewpath` and `react-component-architecture` in `cleanup-photos`. Move the general parts here, and leave what is about one project in that project.

**Disk use**

- Add a script that lists clean, merged worktrees for the owner to approve for removal.
- Try `worktree.symlinkDirectories` so worktrees can share large folders such as `node_modules`.

**Left out on purpose**

- Copilot, until it's clear which Copilot product is in use.
- A custom installer with previews, transactions and its own rollback command. Add one only if a failed install causes real damage.
