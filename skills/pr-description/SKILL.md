---
name: pr-description
description: Write a PR description or a change summary the way the user wants it. Use whenever composing a pull request body, a merge request description, or a summary of what a change did.
---

# PR descriptions and change summaries

**Check for a project template first** (`.github/PULL_REQUEST_TEMPLATE.md`
or the project's workflow doc). Its sections and their order win; the rules
below say how to fill them. Where the template puts "what changed" in the
title and opens the body with why, rule 1 is the title and rule 2 opens the
body. Without a template, rule 1 is the body's first line.

The writing rules in the global `CLAUDE.md` apply first. On top of them:

1. **Start with what you changed, in plain words:** "Replaced X with Y."
2. **Then say why, in one sentence:** what was wrong or missing before.
3. **Describe what the user sees first, then how the code does it.**
4. **When a change affects existing data, users or behavior, say what
   happens to it:** kept, converted, hidden or deleted.
5. **Mark anything done on purpose that looks like a mistake:**
   "Note: X is intentional because Y."

Then the body's shape:

- It points at the ticket and does not restate it. Once the ticket carries
  the spec and the decisions, the PR spends its length on what only the PR
  knows: what review changed, defects found in the work, engineering calls a
  reviewer should look at, new test scaffolding, dependency moves.
- Anything that can break the default branch (a merge-order collision, a
  migration) goes right after the opening line, under its own heading.
- What was verified goes last, in one line: format, analysis, tests, CI.
- It stays short. If a bullet only proves the work was done, delete it.
- The closing keyword (`Closes #N`, one keyword per issue) survives every
  edit. Check it after each rewrite.
- Rewrite the body as a whole when the work changes; never append.
- Written in a Claude Code session, its last line is
  `Claude-Session-Id: <id>`, the value of `$CLAUDE_CODE_SESSION_ID`, so
  `claude --resume <id>` reopens the session. Commits get the same line from
  the global git hook.

## Examples

Bad: "The counts that branched on `== 1` are ICU plurals, so a language can
have more than two forms. Seven of those, and the two review-deck lines keep
their leading space."

Good: "Replaced 7 `count == 1` checks with proper plural messages. The old
check only works for English; Polish needs 3 forms (1 karta, 2 karty,
5 kart). Note: the 2 review-deck strings start with a space on purpose,
because they're appended to other text."

Bad: "The open state of Lessons and Games lives in a kept-alive provider, so
the card above can reach it. It survives leaving the tab, as the prototype's
component state does, and is shut on every launch."

Good: "Lessons and Games remember if they're open: switching tabs keeps them
as they were; each app launch starts them closed. The state lives in a
kept-alive provider (not the widget) so the card above can read it."
