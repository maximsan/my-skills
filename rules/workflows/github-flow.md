# How a task runs: GitHub branches and pull requests

The workflow for a machine that works through GitHub. It adds to the common rules, and wins where they differ.

## Act only on explicit instructions

- A question gets an answer, not an edit. Reading, searching and read-only git are part of answering. Changing files,
  regenerating artifacts or running a long suite to prove the answer are not. Say what is unverified, or offer to run it.
- Change no code without an explicit instruction.
- Creating a branch, committing, pushing it and opening its PR need no asking.
- Never merge and never reset anything: both are the owner's.
- A force-push or other destructive action on the default branch needs the owner's yes first.
- To match what we agreed, rewrite a PR description, issue description or existing comment in place, without asking.

## Finish it here

These need no asking. Fix them first, then say so in the same reply:

- A small adjacent problem is fixed in the branch already open for the asked-for work, and named in its commit and
  ticket body. It is never filed as a new ticket. Raise it instead if it is large, needs a decision that isn't yours, or
  belongs to another area.
- Failing checks or a broken build on the default branch are fixed on sight.
- A small docs-only change needs no ticket, branch or PR. Write it into the working files and show it to the
  owner. Before the owner confirms it, it stays uncommitted. Once confirmed, commit it into the branch already open for related work, or
  to the default branch, and push it there without asking again. Code never goes to the default branch unasked. If a doc
  fix's branch has already landed, write the fix into the body of the ticket that owns it.

## Stop on a contradiction or blocker

A ticket that contradicts a ruling, an open PR on the same files, or an unclear base branch is the owner's call. Raise
it as a question before implementing, not first in the summary afterwards. When a rule demands an explicit
authorization, ask for it, and never invent the ruling. Writing up a ruling the owner already made is not inventing one.

## Keep decisions in the body

The owner doesn't read tracker comments. A resolution, correction or ruling goes into the issue or PR body, rewritten
as a whole, never appended. Post a new comment only when it is really needed. A force-push needs no comment, because
GitHub records it in the PR's timeline.

A skill's internal names for its stages never reach the owner or a ticket: say the plain thing. Describe a ticket in
words, and use its number only as a link. Short means fewer topics, never compressed sentences. A ticket a person
cannot read is rewritten, title and body, before work on it starts.

## Give each document one home

- A decision is written down once, in whatever the project uses for decisions, as the ruling and its cost. The
  reasoning stays in the ticket.
- Project instruction files do not repeat each other or restate config.
- Write no counts in prose, and no version numbers except one fixed on purpose, quoted beside its reason.
- A README is the owner's cheat sheet: its commands and examples stay. Only stale facts and duplicates of a linked doc go.

## Work in a worktree

- Any work that changes a repo gets its own worktree. Reading and answering need none.
- Switch branches, check out or pull only in a worktree this session created, because another session may be working in
  any other folder. Update local `main` from anywhere with `git fetch origin main:main`. Git refuses while any worktree
  has `main` checked out.
- Before you finish, push every commit worth keeping to GitHub. Treat `/private/tmp` as disposable.

## Use git this way

- Stage by explicit path after `git status --short`, confirming each path is yours this turn. Leave other changes
  unstaged and say so. Never `git add -A`.
- Name each branch `<type>/<kebab-slug>`, where the type is `feat`, `fix`, `chore`, `docs`, `refactor`, `test`,
  `prototype` or `research`.
- A PR body follows the `pr-description` skill, once that skill is in this repo. It lives on the Mac for now.

## Write code a reader understands on the first read

- If a workaround needs a paragraph of comment to justify it, fix the code. The exception is a real external bug: one
  line and a link.
- Match complexity to the real problem. Add a layer only when you can say in one sentence what problem it solves
  today. Cut no corners either: no hardcoding, no copy-paste, no quick hacks.
- Comment only the non-obvious: a trap, the reason a value is what it is, a third-party integration. Use the
  project's comment style, or else the language's own doc-comment form.
- Pick the name last, once the code exists, for what it carries to the caller: what it returns (`blockReason()`), what
  it does (`recordReview()`) or what it answers (`opensPullRequest()`).
- Use one word per idea in a file. Never "refuse" in one place and "block" in another for the same act.
- Reach data by name, not by position: `match.groups.folder`, not `match[1]`.

## Run at most three subagents at once

More share one usage limit and stop together.
