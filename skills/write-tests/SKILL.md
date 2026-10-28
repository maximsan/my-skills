---
name: write-tests
description: This skill should be used when the user asks to "write tests" or to raise coverage for code that already works. Writes tests modelled on the repo's existing ones. For the order of a bug fix, use failing-test-first.
---

# Writing tests

For code that already works and isn't covered.

**On a bug, `failing-test-first` runs first and owns the order** — red, then the fix, then green. Everything below is
about what goes inside the test either way.

---

## Step 1 — Name the model test file

```
Model: <path to the nearest existing test file>
```

Take four things from it rather than inventing them: where the file lives and what it's named, how setup and
fixtures are shared, what gets mocked and where the mocks live, and how `describe` / `it` are worded.

Get the single-file test command from this repo's `CLAUDE.local.md`, or its `CLAUDE.md`. The model file decides the
runner and the libraries. With no test file to copy yet, use the tools the stack rules name.

**Then read the one example for what the test covers**, in `examples/`:

- a hook: [hook-test.md](examples/hook-test.md)
- a component: [component-test.md](examples/component-test.md)
- a store: [store-test.md](examples/store-test.md)

It shows the shape a test should have:

- one `describe` per unit, and a `setup()` that renders and returns what the test needs
- names that say what the user sees or the caller gets
- arrange, act and assert apart, and assertions on outcomes
- what to fake: the Apollo hook in a hook's test, the app's own hook in a component's test
- `userEvent` for what a user does, `jest.mocked()` instead of `as jest.Mock`, and elements found by their English
  text

It never replaces the model file, which decides the runner, the mocks the app already shares, the setup file and the
paths. **Where the two disagree, the model file wins.** With no test file in the app yet, start from the example,
with the app's own paths. In a Vitest app, `vi.fn()`, `vi.mock()` and `vi.mocked()` replace their `jest` versions.

## Step 2 — The behavior table

Write this before any test code. Read the source first, then fill it in:

| Behavior | Input | Observable outcome | Covered? |
|---|---|---|---|

**The last column is the point.** "Not covered — layout only" and "not covered — needs a real server" are decisions.
A behavior missing from the table entirely is a gap nobody sees. List every branch that changes what the caller or
the user gets, then mark which ones the tests cover.

## What's worth testing

- What the user sees, or what the caller gets back.
- Every branch that changes either of those.
- The edges the code actually handles: empty, `null`, an error response, called twice, loading.

## What isn't

- **Styling and classes.** They change for reasons that aren't bugs, and the test fails without anything being
  broken.
- **That a library works.** Its maintainers already test it.
- **`displayName`, refs, and props passed straight through.** No logic, nothing to break.
- **Internal state.** Test what it causes, not that it happened.
- **A snapshot as the only assertion.** It shows something changed, not that anything is wrong. And it gets
  updated on reflex.

## Finding things

Role, then label, then text, then test id. A test id needs a one-line reason why nothing user-visible would do.

The order isn't aesthetic. A test that finds a button by role fails when the button stops being reachable. That's a
real bug. One that finds it by class fails when someone renames the class.

## Mocking

Mock at the boundary — the network, the module edge — and no deeper.

- **Never mock the thing under test.** Then the test passes with the code deleted.
- **Never mock translations.** A mocked translation hides a missing key, which is exactly the bug users see.
- Search for existing handlers and factories before writing one, and **name the file the search found**.

## Naming and shape

The name is the behavior in plain English:

```
Bad:   it("should render correctly")
Good:  it("shows the add-payment prompt when the wallet is empty")
```

Arrange, act, assert — separated by blank lines, never by comments saying `// arrange`.

Assert on the outcome, not on the call:

```
Bad:   expect(mockSave).toHaveBeenCalledWith({ id: 1 })
Good:  expect(screen.getByText("Saved")).toBeInTheDocument()
```

The first passes when saving is broken downstream. Assert on the mock only when the call *is* the observable
outcome — a request fired, an event sent.

## Before saying it's done

1. Run it. Paste the real output line.
2. **Confirm the test count went up by the number added.** A filter that matches nothing prints `0 tests` and
   exits 0.
3. Take the single most important assertion, **break the line of source it defends, run it, paste the failure,
   restore the line.**

Step 3 is the only proof the test tests anything. Skipping it is how a suite of decorations gets written.

## Report

```markdown
## Model
<path> — and the four decisions taken from it

## Behaviors covered
<from the table>

## Deliberately not covered
<each with why. `None` if every behavior was covered.>

## Proof
- Test run: <command → output line>
- Count rose by: <n>
- Broke <file:line> → <the failure it produced> → restored
```
