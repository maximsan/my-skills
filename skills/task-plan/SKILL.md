---
name: task-plan
description: This skill should be used when the user asks to "plan this", or asks "how would you implement" something. Writes a step-by-step plan.md without implementing it. To build an approved plan, use task-implement.
---

# Plan

Write a step-by-step plan. **Plan only. Implement nothing.**

Task file: the path the user gave, or `task.md` in the task folder, as the common rules define it.

---

## Step 1 — Orient

Do the reading under *Start of every task* in the common rules. Print the three lines at the start, plus one:

```
Commit:  <short sha> (<branch>)
```

The commit goes in the plan's header. That's how anyone can tell later whether the plan has gone out of date.

Read the task file. If it's missing or unreadable, stop and ask. That alone is a blocker.

## Step 2 — Get the facts

Look for `findings.md` in the task folder.

**If it's there** — use it. Pick three of its code references and check they still point at what it claims. If any is
wrong, say so and re-check the rest before building on it.

**If it's not there** — do the reading now, to the standard below. Never plan from the task description
alone.

### The rule that matters most

Mention a function, component, endpoint, table, config key, or test in the plan only after opening it. Each one
needs its file path and line number.

A plan built on a guessed function signature wastes an entire implementation session. The plan carries a
**What the code does** table proving nothing was guessed.

## Step 3 — Questions and blockers

Work through [`../shared/open-questions.md`](../shared/open-questions.md), starting from the questions already in
`findings.md`. Then act on each kind:

- **BLOCKER**: stop and ask in chat. Write `plan.md` only once it's answered.
- **ASSUMPTION**: log it and keep going.
- **PROBE**: run the read-only ones now and fold in the results.

For anything that genuinely needs the user, use the same marker as everywhere else. `rework` finds every assumption
in the task folder by grepping for it. It will never see a second spelling. Write it like this:

```
⚠️ Assumed: <what> because <why>
   Needs your input: <the question this is standing in for>
```

## Step 4 — Check the draft

- **Use a subagent to read code** — narrow job, clear brief.
- **Use another to attack the finished draft** — its value is the empty context, not extra intelligence. Give it a
  hostile job: *"find the step that will fail in practice."* A polite request for a review gets nothing.
- **Don't use one to write the plan.** That needs the whole picture.

Check the draft against three things:

1. Everything in Step 5, as a literal checklist.
2. **Could someone who knows nothing about this conversation follow the plan without asking a single question?**
   If not, something's missing or a question belongs in the blockers.
3. Do all the code references still match the files at this commit?

## Step 5 — What the plan must contain

- A checkbox on every step, check, and test.
- **A "Done when" line that can actually be checked.** "Done when: the endpoint returns 201 with an order id in the
  body" — not "done when the endpoint works correctly."
- **The files each step touches.** Steps small enough to verify on their own.
- For each new file: why an existing file can't hold it, and **the model file it will copy** — the nearest existing
  file of the same kind. Default to extending what's already there. The model is cheapest to correct now, at
  planning time. `create` reads it later.
- Only what the task needs. No extra refactoring or cleanup.
- Details the task needs but doesn't spell out — write them down rather than leaving them to be improvised.
- **A verification plan.** Manual checks that the behavior is right, with the exact commands and expected output.
- **A test plan based on this repo's real setup**, looked at first-hand: the framework, how a single test is run,
  where fixtures live, what the naming convention is. Cover whatever this project actually requires. No generic
  test boilerplate.
- **If this is a bug fix, Step 1 is always a failing test.** Its "Done when" is *the test fails, and the failure
  message matches the reported symptom* — not "the test is written". The fix comes after, as its own step. A bug that
  can't be reproduced in a test belongs in Questions rather than in a plan. See `failing-test-first` for what counts as
  a real failure.
- **For new logic with clear inputs and outputs, pair each step with its test**, test step first. Layout, styling,
  and glue code don't need it. Say which steps skip it and why.
- **Rollback.** How to undo it, with anything irreversible called out — migrations, data changes, anything published.
- **Cleanup.** What gets deleted because this replaces it. A change that only adds is usually unfinished.
- **For anything being deleted or rewritten, why it exists.** Use the `why-this-exists` skill, and record what it
  found: `removing X — added in <sha>, <why>`, plus any reason `why-this-exists` asks to write down. If the
  reason can't be found, make it a question, not a step.

**Verification and tests are different things.** Verification is a one-time check, by hand, that it behaves right.
Tests are the automated coverage that keeps it right. Don't merge them.

## Step 6 — Write plan.md

Save it in the task file's folder. If that can't be worked out, use the task folder from the common rules, with a short
slug for the ticket, and say which slug was picked.

If a `plan.md` is already there, **update it** rather than replacing it. Keep finished items and recorded results.
Only ask about a new filename if the user wants the old one kept as-is.

**If the plan exists and something already done is now wrong**, use the `rework` skill before touching the
plan.

```markdown
# Plan: <ticket / short title>
Commit: <sha> (<branch>) · Rules: <names> · Facts from: findings.md

## Questions / Blockers
Each with a proposed answer and what would change. `None` if there are none.

## What the code does
| Function | Where | What it actually does |

## Files to touch
- path — create / change / delete — why

## Steps
- [ ] Step 1: ... (files: ...)
  - Done when: ...

## Verification
- [ ] Check: ... (run: ...)
  - Expect: ...

## Tests
- [ ] Add or update: ... (file: ...)
  - Done when: ...

## Cleanup / rollback / anything irreversible

## Summary
- What changes:
- What gets tested:
- Risks and assumptions:
```

## Step 7 — Match the size of the task

**Small and clear** — say so plainly, and write `plan.md` straight away.

**Long or unclear** — an HTML version with a table of contents, collapsible sections, and clickable checkboxes may
be offered. It is optional. Build it only after a yes. `plan.md` stays the real one.

If asked for the HTML: slate greys, `#38bdf8` blue for headings and links, `#f59e0b` amber for subheadings and
inline code. Segoe UI for text, Georgia for headings, Consolas for code.
