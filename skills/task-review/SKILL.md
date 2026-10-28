---
name: task-review
description: This skill should be used when the user asks to "review my change", for finished work such as a diff, a branch or a PR, or asks "is this ready to merge". Reviews the change against its task and plan. For a rule or skill file, use rule-author.
---

# Review

**This must run in a fresh chat.** This is the one task skill where that matters. If this session wrote the code
earlier, stop and say so rather than reviewing it. The review would treat its own reasoning as evidence and defend its
own choices. Everything needed is in the files below.

Review this as a stranger's code. Defend none of it. The author's account of what they did is not evidence: check
every claim in the files.

Read, in this order, from the task folder the common rules define:

1. `task.md` — what was actually asked for
2. `plan.md` — what was approved, including how each step would be checked
3. `progress.md` — what they flagged, assumed, or abandoned
4. `git diff <commit-from-plan-header>..HEAD` — what actually changed
5. The reading under *Start of every task* in the common rules. Use the `NOTES.md` entries for this area to tell a
   convention breach from a style preference, and a deliberate oddity from a bug

---

## What to check, most important first

### 1. Is it correct?

For each changed block, read the code around it and the places that call it — not just the diff.

Does it hold up with empty input, with `null`, when the request fails, when it's called twice, when two things
happen at once?

Give a concrete way it breaks — specific input, specific wrong result — or don't raise it at all.

### 2. Does it match what was asked?

Ask two separate questions. The second one is usually invisible to whoever did the work:

- Where does the code differ from the plan, including changes the plan never asked for?
- Where does the plan differ from the original task?

### 3. Do the checks actually pass?

Run the verification commands and the tests first-hand. A ticked box with no proof next to it is an unchecked box.
Report what the run actually showed.

### 4. What got left behind?

This is where working alone reliably fails. Check every item in [`../shared/leftovers.md`](../shared/leftovers.md)
and name the ones found. Report a guard for a case nothing can produce as a correctness finding, not a tidiness one.

### 5. Was anything removed without knowing why it was there?

For every deleted or rewritten block in the diff, reworded comments included, use the `why-this-exists` skill. Run
its checks for reviewing someone else's diff. Each check that fails is a finding, whatever the plan said.

### 6. Was the cleanup done?

Everything on the plan's cleanup list actually deleted. A change that only adds is usually unfinished.

**If `progress.md` shows the approach changed part-way**, the plan's cleanup list may describe the *original*
approach. Grep `progress.md` for `↪ Pivot:` to find out. Check what the final code actually replaces, not just what
the plan predicted it would. The old implementation the new one superseded should be gone, whether or not the plan
named it.

### 7. Are the tests real tests?

**If this fixes a bug, check the new test actually catches it**: follow [`take-out-the-fix.md`](take-out-the-fix.md).

Then:

- Would each test fail if the code were wrong? Try breaking it and see.
- Do they check real behavior, or just that a mock got called?
- Do the existing tests still cover what they used to?

### 8. Do the rules apply, and were they followed?

Which of the user's rules apply to this diff? Quote the rule and the line that breaks it.

**New files:** name the model file each one was compared against. A new file has no surrounding code, so a
convention breach in one shows up only next to its model file.

### 9. What did the plan miss?

Grep for everywhere the changed code is called. Is there a caller, test, doc, or config file that should have been
updated and wasn't?

---

## How to report

- Give the file path and line number for every finding. No reference, no finding.
- Check before reporting. If something can't be confirmed, mark it `NOT CONFIRMED` and say what would settle it.
- Sort by how bad it is. One real bug beats ten style notes.
- If a section is clean, say so in one line.

**Write this to `review.md` in the task folder** as well as saying it in chat. `task-learn` reads that file
later, and a review that only exists in a closed chat can't be read by anything.

```markdown
## Verdict
Ship it / fix these first / needs rework — one sentence why.

## Real problems
1. <how bad> — <file:line> — <what's wrong> — <how it breaks> — <how I confirmed it>

## Left behind
Orphan code, dead code from abandoned attempts, duplicates, copied documents. `None` if clean.

## Removed without knowing why
Anything deleted or rewritten whose original commit points at a fix, bug, or ticket. Give the commit and what it
was for. `None` if every removal was accounted for.

## Doesn't match
Code vs plan. Plan vs original task.

## Checks I re-ran
- [x] / [ ] <check> — what I actually saw
- Fix taken out: <the new test's failing output>, or `not a bug fix`

## Couldn't confirm
Anything claimed that I wasn't able to verify.

## Clean
Sections I checked and found fine.

## Decisions
Filled in by the user after reading: fix now / backlog / won't fix + why. Leave the headings empty.
```

Then stop. Don't fix anything, and don't offer to. This review has just argued these are problems. If the same session
then switches to defending them, that's how findings get quietly downgraded.

End the reply with the three routes, so the next step is obvious:

> Findings are in `investigations/<app>/<TICKET>/review.md`. For each one, tell me: **fix now**, **backlog**, or
> **won't fix**. Fixing goes back to `task-implement` — the chat that built it, if it's still open. Anything you
> disagree with, say why and I'll record it, so the next review doesn't raise it again.
