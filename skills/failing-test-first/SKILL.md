---
name: failing-test-first
description: This skill should be used when the user asks to "fix this bug", for every regression test, and for new logic with clear inputs and outputs. Writes the failing test before the fix. To find the cause after two failed fixes, use debug.
---

# Write the failing test first

For a bug, the failing test **is** the reproduction. Without a test that fails, the cause isn't found yet. It's still a
guess. And a fix with no red first has no proof it did anything. The symptom may have moved rather than gone.

The test written here stays forever as the guard against this bug coming back. It's also what makes the code
defensible later. The first check in `why-this-exists` is "does a test cover it?" This is the test that check finds.

## When this applies

Write the test first for: bug fixes, always. Validation, calculations, reducers, data transformation, API handlers —
anything where the expected output can be stated before writing code.

Skip it for: layout and styling, glue code with no logic, and exploratory work where the shape of the answer isn't
known yet. There, the test would get written three times. Name each piece of work that skips the test-first order,
and why.

Skipping is about the test coming *first*, not about the test existing. Code that ships without any test still needs
one unless the plan says otherwise.

---

## The cycle

1. **Write the test from the symptom**, not from a theory about the cause. Use the reported inputs. Assert the
   result the user expected, not the one the code currently produces.
2. **Run it. It must fail.** Paste the actual failure message.
3. **Check it failed for the right reason** — see below. This is the step that gets skipped.
4. **Write the fix.** Nothing else. Not the tidy-up spotted along the way, not the second bug.
5. **Run it again. It must pass.** Paste that too.
6. **Run the whole suite.** A fix that breaks three other tests isn't a fix.

Both outputs go in the task's working file: `debug.md` when `debug` called this skill, otherwise `progress.md`. "It
failed, then it passed" without the messages is unverifiable. It's also exactly what someone writes when they did it
the other way round.

## Telling a real red from a false one

A test can fail for reasons that have nothing to do with the bug. Read the message; don't just look at the colour.

**False reds** — the test failed, but proved nothing:

- Import error, typo, or syntax error in the test itself
- Fixture or mock missing, so it never reached the code under test
- The wrong file was run, or the test name filter matched nothing
- A snapshot test with no stored snapshot — the first run always "fails" then writes one
- A timeout that's really an environment problem

**The check:** does the failure message describe the *symptom*? For "duplicate charge on retry", a real red says
something like `expected 1 charge, got 2`. If it says `Cannot find module`, it's a broken test, not a
reproduction.

**False greens** — worse, because they look like success:

- The test never ran. `npm test -- wrong/path` prints `0 tests` and exits 0.
- An async assertion that isn't awaited — the test finishes before it runs.
- The assertion is on a mock, not on behavior: it checks the function was called, not that it did the right thing.
- The test asserts what the code currently does, because it was written by reading the code rather than the symptom.

Before trusting any green, confirm the test count went up by the number of tests added.

## When the test passes before the fix is written

Stop. Don't touch the test.

One of these is true, and which one matters:

- **The test doesn't reproduce the bug.** Wrong inputs, wrong layer, the wrong one of several code paths.
- **The bug isn't what it was reported as.** It needs different conditions — a specific state, a race, real data, a
  second call.
- **The bug is already fixed** — by someone else, or by a dependency update.

Name the likeliest one and the next check. Never adjust the assertion until it goes red. A test edited
until it fails proves nothing about the bug. It also locks in whatever it was edited into.

## What to do with the passing test

Name it after the behavior, not the ticket. `retries once on 401` outlasts `fixes ORD-123`. A ticket number means
nothing to whoever reads it in a year.

If the fix is subtle, a one-line comment saying what the test is defending is worth more than the ticket number.
That comment is what stops someone deleting it as redundant later.
