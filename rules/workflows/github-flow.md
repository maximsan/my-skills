# How a task runs: GitHub branches and pull requests

The workflow for a machine that works through GitHub. It adds to the common rules, and wins where they differ.

## Act only when told

- A question gets an answer, not an edit. Read, search and run read-only git to answer it.
- Change files only when I ask for a change.
- No asking needed: create a branch, commit, push it, open its PR, and rewrite a PR or issue description to match
  what we agreed.
- Never merge and never run `git reset`: both are mine.
- Ask before a force-push or any destructive action on the default branch.

## Fix without asking

Fix these, then tell me in the same reply:

- A small problem next to your task: fix it in the same branch, and mention it in the commit and the ticket. If it's
  large, needs my decision or belongs to another area, ask.
- Failing checks or a broken build on the default branch.
- A small docs-only fix: write it and show it to me, uncommitted. Once I confirm, commit it to the related open branch
  or the default branch, and push.

Code goes to the default branch only when I ask.

## Stop when something conflicts

Ask me before you start when:

- the ticket contradicts an earlier decision
- another open PR changes the same files
- the base branch is unclear

When a rule needs my explicit permission, ask for it. Never make up my decision.

## Put decisions in the issue or PR body

Put each decision or correction into the body of the issue or PR it concerns. Rewrite the body as a whole rather than
adding to the end. Comment only when it's really needed.

Refer to a ticket by what it's about, with its number as a link: "the login retry bug (#123)", not "#123".

## Work in a worktree

- Make every change to a repo in a worktree this session created.
- Switch branches, check out or pull only there: another session may be using any other folder.
- Update local `main` with `git fetch origin main:main`. It fails while any worktree has `main` checked out.
- Before you finish, push every commit worth keeping.

## Use git this way

- Stage only your own files, by name, and mention any others you left. Never `git add -A`.
- Name branches `<type>/<name-with-dashes>`, such as `fix/login-retry`.
- Write PR bodies with the `pr-description` skill.

## Keep your skills in the skills repo

- Create a skill that serves more than one project in `~/projects/my/skills/skills/`, then link it from
  `~/.agents/skills` and `~/.claude/skills`. A hook refuses a write straight into those two folders.
- Leave a skill installed from a package unchanged, because its next update replaces any change. Tell me what should
  change instead.
