# Does Cursor show a skill twice when it sits in two skill folders?

Question from issue [#24](https://github.com/maximsan/my-skills/issues/24).
On the owner's Macs, each `~/.claude/skills/<name>` is a symbolic link to `~/.agents/skills/<name>`.
Cursor reads both folders.
Does Cursor list each skill once or twice?

Researched 2026-11-24 without Cursor installed, so nothing here was tested.

## Short answer

Probably once, on Cursor 3.17 or newer, but no source settles the symbolic-link case.
It must be tested on the Mac that has Cursor.

## What the sources say

### Cursor reads both folders

- Cursor loads user skills from `~/.agents/skills/` and `~/.cursor/skills/`.
  ([Cursor docs: Skills](https://cursor.com/docs/context/skills))
- "For compatibility, Cursor also loads skills from Claude and Codex directories", including `~/.claude/skills/`.
  ([Cursor docs: Skills](https://cursor.com/docs/context/skills))
- The docs page says nothing about duplicates, precedence or symbolic links.
  ([Cursor docs: Skills](https://cursor.com/docs/context/skills))

### Cursor staff on duplicates

All quotes below are by Dean Rie, whose forum account is in the `CursorStaff` group.
The group is shown in the forum's post data for each of his posts.

- January 2026: Cursor "loads Skills from different directories and treats them as separate entities, even though it's the same skill with the same name."
  The bug was logged as "deduplication of Skills".
  ([forum, post 4](https://forum.cursor.com/t/critical-issue-duplicate-skills-loading-causing-context-window-waste-and-confusion/150137/4))
- May 2026: "normalization works for ~/.claude/skills vs ~/.cursor/skills".
  A user's duplicates stayed because their tool used `~/.agent/skills` (no `s`), and "we only detect ~/.agents/skills".
  ([forum, post 5](https://forum.cursor.com/t/excessive-token-usage-cursor-auto-loads-too-many-skills-from-claude-skills-at-conversation-start/160677/5))
- August 14, 2026: "the fix for excessive skill loading from hidden directories inside ~/.claude/skills/ and for duplicate skill loading landed in Cursor 3.17."
  He asked users to send a screenshot if "duplicates don't collapse".
  ([forum, post 16](https://forum.cursor.com/t/excessive-token-usage-cursor-auto-loads-too-many-skills-from-claude-skills-at-conversation-start/160677/16))
- August 28, 2026: a user saw every skill twice.
  The cause was two separate installs: a Claude Code plugin and a copy in `~/.cursor/skills`.
  The advice was "Remove one of them and the duplicates will go away."
  ([forum, post 5](https://forum.cursor.com/t/duplicate-skills-and-unknown-origins/169575/5))

### Same name in different projects

- June 2026: two repos in one workspace with a skill of the same name made the skill disappear from the `/` menu.
  Staff (Mohit Jain, `CursorStaff`) called it "a confirmed bug in how skills are resolved across folders in a multi-root workspace."
  ([forum, post 6](https://forum.cursor.com/t/workspace-skill-resolution-issue-with-identical-skill-names/162287/6))
- This case is two project folders, not two user folders, so it does not answer issue #24 directly.

### The Agent Skills spec

- The spec defines what goes inside a skill folder only.
  It says nothing about duplicates or where skills live.
  ([Agent Skills specification](https://agentskills.io/specification))
- The guide for tools that load skills says: "When two skills share the same `name`, apply a deterministic precedence rule."
  Within one scope, first-found or last-found is acceptable, with a warning to the user.
  ([Agent Skills: adding skills support](https://agentskills.io/client-implementation/adding-skills-support))
- This guide is advice to tool makers.
  It does not say what Cursor does.

### Cursor changelog

- The public changelog lists dated entries, not version numbers.
  Its current entries do not mention skill duplicates or 3.17.
  ([Cursor changelog](https://cursor.com/changelog))

## What stays open

- No source says whether Cursor matches duplicates by skill name or by real file path.
  A symbolic link gives the same name and the same real path, so either rule would collapse it.
- No source mentions symbolic links at all.
- The staff "normalization" quote names `~/.claude/skills` vs `~/.cursor/skills`, not `~/.claude/skills` vs `~/.agents/skills`.

## How to test on the Mac that has Cursor

1. Check the Cursor version is 3.17 or newer.
2. Open a chat and type `/` to list skills.
3. Pick a skill that exists as `~/.agents/skills/<name>` with a link at `~/.claude/skills/<name>`.
4. Done when that skill appears once or twice in the `/` list. Note which.
5. If it appears twice, turn off "Include third-party Plugins, Skills, and other configs" in Settings → Rules, Skills, Subagents and check again.
   Staff say this setting stops loading the `.claude/`, `.codex/` and `.agents/` roots.
   ([forum, post 5](https://forum.cursor.com/t/excessive-token-usage-cursor-auto-loads-too-many-skills-from-claude-skills-at-conversation-start/160677/5))
