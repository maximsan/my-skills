# Planned work

What's planned but not built yet, and what it will need. Remove an entry once it ships.

## Skills that edit tickets on GitHub

Skills that create and edit GitHub issues from a task folder. They'll run the GitHub CLI, `gh`, so every computer that
uses them needs it installed and signed in.

### Installing `gh` without admin rights

For a Windows computer where you can't run installers, such as a managed Windows environment. In Git Bash:

```bash
# 1. Find the latest version, e.g. 2.103.3
VERSION=$(curl -sI https://github.com/cli/cli/releases/latest | grep -i '^location:' | sed 's#.*/tag/v##' | tr -d '\r')

# 2. Download the portable zip, and extract it. The zip holds bin/gh.exe
curl -L -o ~/gh.zip "https://github.com/cli/cli/releases/download/v${VERSION}/gh_${VERSION}_windows_amd64.zip"
mkdir -p ~/gh-cli && unzip -o ~/gh.zip -d ~/gh-cli

# 3. Put it on your PATH, now and in every new terminal
export PATH="$HOME/gh-cli/bin:$PATH"
echo 'export PATH="$HOME/gh-cli/bin:$PATH"' >> ~/.bashrc

# 4. Check it, then sign in
gh --version
gh auth login
```

If `unzip` isn't found, extract with the `tar` that comes with Windows: `/c/Windows/System32/tar.exe -xf ~/gh.zip -C
~/gh-cli`.

To update, run the same steps again.

**Don't run `npm install -g gh`.** That npm package is a different tool. It installs its own `gh` command, which can
hide the real GitHub CLI on your PATH.

## One setup for every agent and machine

The goal is one set of rules, skills and checks that Claude Code, Codex, OpenCode and Cursor all follow, on the Mac and on Windows.

Decided:

- This repo holds the shared setup. The Mac comes first, and Windows follows once the Mac works.
- A small install script and a read-only check for anything out of sync do the work. Git gives history and undo. A failed install is fixed by hand.
- Each agent gets the setup through its own supported mechanism, and a project's own rules can only tighten it.
- `~/.agents/skills` stays the folder agents find skills in, linked to this repo.

### Next steps, in order

1. **Settle the shared rules.** Review the differences between the Mac's global rules, its Codex rules and `rules/common.md`. Load `rule-author` before writing them.
   - Agents ask whenever a step could go more than one way, and never pick silently.
   - The detailed writing rules stay in the shared rules, so every agent loads them.
   - Decisions go in the issue or PR body. An agent comments only when a comment is really needed.
   - Any work that changes a repo gets its own worktree. Reading and answering need none.
   - Each machine keeps its own rule for small problems nearby: the Mac fixes them in the open branch, and Windows lists them in its Backlog.
   - An example may be made up if it's clearly labelled. An invented result, measurement or scenario is never presented as real.
   - Before finishing, an agent pushes every commit worth keeping to GitHub, and treats `/private/tmp` as disposable.
   - Glossaries and comment syntax follow each project. Checks match the size of the risk. Design and provider preferences move into their own skills.
2. **Split the rules.** `rules/common.md` keeps what both machines share. A workflow file for each machine takes the rest, including this file's Windows workflow rules, unchanged.
3. **Bring in the Mac's skills and hooks.** They sit outside git today: `check-prose`, `disk-audit`, `pr-description`, `repo-checks`, `review-and-fix` and the hooks. Read each for private details first, because this repo is public. Personal settings files stay out.
4. **Write the install script and the check.** Run the hook tests from `npm run check`.
5. **Prove each agent loads the setup.** A fresh session in each agent must show the expected rules and skills. Back up the current files first.

### Postponed

Each item waits for the steps above, unless it says otherwise.

**Windows**

- Install the shared setup on Windows. The rules here must keep working on the Claude Code version named in `CONTRIBUTING.md`.

**Other repos**

- Merge `devkit` into this repo as a monorepo, keeping its history. Combine its `devclean` command with `disk-audit`, which overlap.
- Merge `my-dotfiles` the same way. Decide first what stays private, and commit or drop the changes waiting in its `.zshrc` and `.gitconfig`. `~/.zshenv` isn't tracked anywhere yet.

**Agent gaps**

- OpenCode has no temp-clone warning and no temp-folder rule. It reads the global `CLAUDE.md` as a fallback for now.
- Cursor's app was removed from the Mac, so its hooks are untested. When it's back, test them.
- **Owner's note:** paste this into Cursor under Customize → Rules, because its global rules live in that settings screen:

  > Before you finish, push every commit worth keeping to GitHub. Treat `/private/tmp` as disposable.

- The review gate runs in Claude Code, Codex and OpenCode. Add it to Cursor once the app is back.
- Rename or retire existing `codex/` branches. The branch-name rule only stops new ones.
- Track `~/.git-hooks` in git, because the branch-name rule and attribution stripping live there, outside any repo.
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

**Disk use**

- Add a script that lists clean, merged worktrees for the owner to approve for removal.
- Try `worktree.symlinkDirectories` so worktrees can share large folders such as `node_modules`.

**Left out on purpose**

- Copilot, until it's clear which Copilot product is in use.
- A custom installer with previews, transactions and its own rollback command. Add one only if a failed install causes real damage.
