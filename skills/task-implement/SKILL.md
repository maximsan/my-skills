---
name: task-implement
description: This skill should be used when the user says "approved, go ahead" to a plan.md, or asks to "fix the review findings" marked fix now. Builds the approved plan, or fixes those findings. To write the plan first, use task-plan.
---

# Implement

**Start only on the user's go-ahead.** Find the user's message in this chat that approves this `plan.md` or asks
for it to be built, or that asks for the review to be fixed. Quote it. If there is none, stop and ask. Once it is
quoted, nothing here needs further approval.

Two modes, decided by the file handed over:

- **A `plan.md`** — build it. Start at Step 1.
- **A `review.md`** — fix what it found. Follow [`review-fixes.md`](review-fixes.md) and skip the numbered steps.

**If something already built turns out to be wrong** — the requirement moved, or the approach doesn't work — stop and
use the `rework` skill first. It changes `plan.md`, so carry on only once the user approves the changed plan, and
quote that approval.

---

## Step 1 — Before touching anything

**If the plan was written earlier in this same session, most of this step is already done.** Say which parts are
being skipped and why, then move to Step 2. Don't re-read files written minutes ago. Don't re-run a drift check
against a commit that hasn't moved. That's theatre, not verification. Do all of it if the session was compacted in
between, or if the plan comes from an earlier day.

Do the reading under *Start of every task* in the common rules, and print the three lines at the start. For this
area, the notes in `NOTES.md` are what Step 2 means by "looks like the code around it".

Read `plan.md`, plus `findings.md` and `progress.md` if they exist. Earlier sessions already worked things out. Use
them. Don't redo that work unless something looks wrong.

If the plan is missing or unreadable, stop and ask. Don't guess what it says.

Then run three checks:

**1. Are the plan's facts still true?**
Open the files behind the plan's code references. Check each one still says what the plan claims. If any is wrong,
**stop and say so.** The plan is built on something false, and carrying on wastes the session.

**2. Has the code moved since the plan was written?**

```
git diff --name-only <commit-from-plan-header>..HEAD
```

Compare that list against the plan's "Files to touch". Anything in both lists must be re-read, not assumed. If a
change breaks a step, stop and say so. Better to revise the plan than to quietly work around it.

**3. What already exists?**
Run `git status`. List which of the plan's files are already there. Know what is being extended before creating
anything.

## Step 2 — Working through the plan

Follow the steps in order. Build only what the plan says. No extra refactoring or cleanup.

Don't change existing behavior unless the plan says to.

**Deleting or rewriting a block the plan didn't already account for?** Use the `why-this-exists` skill first, and
record what it found in `progress.md`.

Write code that looks like the code around it — same naming, same error handling, same amount of commenting. When
copying a pattern from somewhere, say where. **On a step that creates a file, use the `create` skill.**

**On a step that starts with a failing test**, use the `failing-test-first` skill.

The Backlog list goes at the bottom of `plan.md`, under `## Backlog`.

## Step 3 — Artifacts and throwaway work

Two rules for files during a build:

- Throwaway work goes in the task folder's `scratch/`, outside every repo. Never loose in `src/`.
- Keep an `Artifacts:` list in `progress.md`: every file created or changed, what it's for, and whether it's still
  in use. That list is what keeps a file made an hour ago from being forgotten.

## Step 4 — When something doesn't work

**When the common rules send this task to `debug`**, write only the result in `progress.md`: the real cause with its
file and line, a pointer to `debug.md`, and the grep showing the temporary logging is gone.

**When the direction changes, write the pivot checkpoint from the common rules into `progress.md`.** Its `Now wrong:`
line lists everything the failed attempt added: files, functions, imports, config keys, flags, dependencies, tests,
logs. List what was deleted under `Removed:`. Code added in this task needs no `why-this-exists` check before deleting
it. The diff decides what this task added: a line that shows as an addition since the plan's base commit.

That covers a change of direction within a step, while the plan still stands. **If the plan's own approach is what's
wrong** — the steps themselves no longer make sense, or finished steps are now pointing the wrong way — stop and use
`rework`.

**Changing approach also invalidates the plan.** If the new direction means different code gets replaced, update
the plan's Cleanup list to match before finishing. Otherwise the review checks a list describing work the build no
longer did. Note the change under Deviations too.

Watch for a pivot nobody decided on. It's usually gradual. The tell: the current work no longer matches the plan
step it started under. That's also what Step 7 is for. Treat it as the real safety net and
this section as the cheap early catch.

## Step 5 — When unsure, pick the right response

**Just do it and note it** — the plan is clear, or there's one obvious right answer given the codebase.

**Do it, but flag it** — several answers are defensible and being wrong is cheap to fix. Pick one and write
`⚠️ Assumed: <what> because <why>` in `progress.md`.

**Stop and ask** — something is genuinely blocked, conflicts with the codebase, can't be undone, or a wrong choice
would waste real work. Ask as a closed question with options and a recommendation.

## Step 6 — Keep notes along the way

After each finished step, add this to `progress.md`. Short lines, no prose:

```
### Step 3 — Add retry to the login hook — done
Files:     src/auth/useLogin.ts, src/auth/useLogin.test.ts
Artifacts: useLogin.ts (changed, in use) · retry-helper.ts (created, in use)
Proof:     npm test src/auth → 12 passed
Learned:   the 401 handler already retried once — the plan assumed it didn't
Removed:   nothing
Next:      Step 4, needs the API mock from step 3
Open:      should the retry count be configurable?
```

Keep `plan.md` current too — tick steps as they land, write verification results in place, tick tests as they get
written.

## Step 7 — Check the diff before calling it done

Run `git status` and `git diff --stat <commit-from-plan-header>..HEAD`, then check **both directions**:

- **Every changed file matches a step in the plan** — or explain it, or undo it.
- **Every file in "Files to touch" shows up in the diff** — or explain why not. A planned change that silently
  never happened is a missed requirement.
- **Everything on the plan's cleanup list is actually deleted.**

Then read the whole diff for every leftover listed in [`../shared/leftovers.md`](../shared/leftovers.md), and
remove each one found.

## Step 8 — Finish

- Do **every** check in the plan's verification list. Write what actually happened, not what was expected.
- Write the tests the plan asks for, using the `write-tests` skill. Run them. Paste the real result line, including
  failures.
- Run whatever this repo needs before a change counts as finished — build, lint, type-check, format. Report each.
  **A failing type-check or lint is not a finding to report, it's unfinished work.** Fix it, or say the change isn't
  done. Never hand over a failing one with the failure noted underneath.

## Step 9 — Final report

```markdown
## Rules applied
Which rules and skills shaped this, and how.

## Steps completed
- [x] ... — proof: <command → output>

## Verification
- [x] Check: ... — what actually happened: ...

## Tests
- [x] ... — <test output line>

## Files changed
Every file, created / changed / deleted, one line each on why. `None` if none.

## Diff check
- Changed files with no matching step: <explained or undone>
- Planned files not touched: <why>
- Removed from abandoned attempts: <what>
- Cleanup list finished: yes / no

## Deviations from the plan
`None` if there were none.

## Debugging
Any time the two-attempts rule was hit, and what the real cause turned out to be. `None` if none.

## Backlog
Out-of-scope things noticed along the way. `None` if none.

## Worth remembering
Two to five useful facts about this codebase learned here. Each one pointing at a file and a function name.
Suggest them only — don't write them into `docs/ai/` yet.
```
