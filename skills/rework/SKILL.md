---
name: rework
description: This skill should be used when the user says "the requirements changed" or "this approach was wrong", or when a built solution needs rewriting rather than patching. Decides what finished work to keep, change or drop, and amends the plan.
---

# Reworking what's already done

Something already planned or built is now wrong. The job is to find out exactly what, before writing anything new.

The output is the triage report, the `## Changes` entry in `task.md`, and an amended `plan.md`. The only code to write
is the tests in step 4, which pin today's behavior. Every other action below becomes a step in `plan.md`. After the user
approves the triage, `task-implement` carries those steps out.

The danger is uniform across every version of this: **the wrong work still looks finished.** Steps are ticked, code
exists, tests pass. Nothing in a green suite shows that the target moved.

---

## 1. Which situation is this?

Answer both before doing anything. They change what applies below.

**What changed?**
- *The requirement* — the ticket was updated, a decision reversed, new information arrived.
- *The approach* — the requirement stands; the way we built it doesn't work. Go through step 2 as well.
- *Both* — common. Do everything.

**How much is done?**
- *Planned, barely built* — the cheapest case. Mostly a plan revision.
- *Implemented, not shipped* — the usual case. Code exists and works, but nothing outside this change depends on it.
- *Shipped* — add step 7.

## 2. Only if the approach was wrong: is rewriting warranted?

Name in two sentences what's specifically wrong that patching can't fix. If that isn't possible, plan a patch instead of
a rewrite, and say so in the report.

Legitimate: the design can't express something it now needs; every change touches five places; it's producing the
same class of bug repeatedly; what it's built on is going away.

Not legitimate on its own: it's ugly, it isn't how it would be written now, it doesn't match a newer pattern elsewhere.

Say which it is. A rewrite that turns out to be preference costs days and reintroduces bugs that were already fixed.

## 3. Write down what changed

Add to `task.md` under `## Changes` — don't replace the old wording:

```
2026-08-12 — new: guests can check out without an account.
             was: sign-in required before the basket page.
             source: <link, or who said it>
```

Keeping the old text is what lets a reviewer tell the plan was right for the old requirement rather than wrong for
the new one. It also stops the same reversal being re-argued in a month.

Then read, before touching code:

- **`docs/ai/NOTES.md`** for this area. A note may say why the thing being replaced was chosen, or which
  accidental behavior turned out to matter. The replacement has to address it. Re-picking an option that was
  already rejected is the most expensive mistake here.
- **`git log --oneline <file>`** on anything pre-existing being replaced. A file with a dozen small fix commits
  holds a dozen edge cases, most undocumented. Those commit messages are requirements nobody wrote down.

## 4. If the code works today, pin its behavior before changing it

Skip this only if the code is barely built. Otherwise it's the step that makes a rework survivable, and the one
that gets skipped.

Write tests describing what the current code *actually does* — including behavior that looks accidental. These tests
record behavior; they don't judge it.

- Start from the callers: what does each one rely on?
- Cover the edges it handles: empty, null, repeat calls, error paths, ordering.
- Anywhere it's oddly specific, test that specific case. Those conditions are almost always a past incident.
- Run them against the **existing** code. They must pass. A failure means what the code does was misunderstood,
  not that the code is wrong.

Then decide, item by item, which of those behaviors to keep and which to drop. **Each drop is a decision to report, not
a side effect.** Without this list, nobody can tell "reworked" from "reworked and quietly different".

## 5. Triage what's done

Go through the finished steps in `plan.md`, the `Artifacts:` list in `progress.md`, and the diff so far. Each action
in the table becomes a plan step, not an edit:

| State | What to do |
|---|---|
| **Still correct** | Leave it — and say so. Silence reads as "not checked". |
| **Now wrong** | Change it, and change its test in the same step. |
| **Now pointless** | Delete it. |
| **Now insufficient** | Extend it. Note that its original "done when" no longer covers the case. |

**Whose code is it?** The diff decides. Anything added since the plan's base commit belongs to this task, and
needs no `why-this-exists` check. Anything older is pre-existing. Use `why-this-exists` before removing it, even if
it's the agent's own code from last month.

## 6. Find the tests that now assert the wrong thing

**The step nothing else will catch.**

A test written for the old requirement or the old approach still passes. It now defends behavior that is no longer
wanted. Every other rule here reads it as proof the code is correct. `failing-test-first` will defend it, and
`why-this-exists` treats it as evidence the code is load-bearing.

Sort every test touching the changed area. Each action in the table becomes a plan step:

| Kind | How to tell | What to do |
|---|---|---|
| **Encodes the requirement** | Asserts behavior a user or caller depends on | Must still pass. Don't touch it — it's the safety net. |
| **Encodes the old approach** | Asserts internal structure, mocks the old collaborators, checks a method was called | Replace it with the behavioral equivalent first. |
| **Now obsolete** | Asserts a requirement that's been dropped | Delete it, and say what it used to assert. A deleted test is the only record of a dropped requirement. |
| **Can't tell** | — | Report it. An ambiguous test either blocks a correct rework or waves through a broken one. |

Anything that *should* now fail becomes a red-green plan step: change the assertion to the new expected behavior,
watch it fail against the current code, then fix the code. `failing-test-first` applies when `task-implement` runs it.

**A fully green suite through a real rework is a warning, not a reassurance.** Say so if that happens.

## 7. Only if it shipped

Follow [`shipped.md`](shipped.md).

## 8. Re-check the assumptions

`progress.md` has `⚠️ Assumed:` lines from before. Mark each: still holds, now decided, or now invalid. An assumption
that was safe under the old requirement is a strong candidate for what breaks under the new one.

Do the same for the blocker answers in `findings.md`. An option picked last week may not be available now.

## 9. Amend the plan; don't start a new one

Keep `plan.md`, including finished steps and their recorded proof. They're the record of why the code looks the way
it does, and deleting them makes the current state unexplainable.

- Strike through steps that no longer apply — `~~Step 3~~ dropped: guests don't need a saved card`.
- Add new steps numbered onward. Don't renumber; `progress.md` refers to the old numbers.
- Update the Cleanup list to what's actually being replaced now.

If the approach is being rewritten, say once and explicitly what the new shape is and why it differs. The old
structure invites reproducing it function for function. That's how a rewrite ends up as the same design
with new names. If the shape isn't changing, it's a patch: plan it as one, as step 2 says.

## 10. Report, then stop

```markdown
## What changed, and which situation
<requirement / approach / both — and how much is built>

## Why rework rather than patch
<only if the approach was wrong>

## What the record says
<NOTES.md, what the fix commits reveal>

## What it does today
<pinned behaviors, and the tests now holding them>

## Behaviors I'm proposing to drop
<each with why — these are decisions>

## Already done: still fine / now wrong / now pointless
<per item>

## Tests that should now fail but currently pass
<the important list. "None" only if each one was checked.>

## If it shipped
<call sites, live data, in-flight work and rollback, from `shipped.md`. `Not shipped` if it didn't.>

## Assumptions no longer valid

## Plan changes made
<steps struck, steps added — all waiting for approval>

## Worth asking
<is the new requirement complete? does it contradict a note in NOTES.md?>
```

This is where scope doubles quietly. Every dropped behavior and every rewrite decision is the user's call, not
the agent's.
