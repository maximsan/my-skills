> **LEGACY — do not use.**
> Replaced by the `write-tests` skill: `skills/write-tests/SKILL.md`.
> Kept only as a record of the original prompt for writing tests.
>
> Every requirement below carried over. What deliberately changed:
>
> - "Identify all branches, conditions, and user-visible outcomes" became a behavior table written before any test code, with a column for what you're deliberately **not** covering and why. The original can be claimed; the table shows the gaps.
> - The new skill adds a mutation check before you can call it done: break the line of source the main assertion defends, watch it fail, restore it. Without that, nothing distinguishes a test from a decoration.
> - The reference example was deleted. It was copied from work code, into a public repo, and three of its tests broke
>   the rules above. `skills/write-tests/examples/` replaces it, written from scratch to those rules.
> - The new skill draws the line with `failing-test-first`, which owns *when* a test is written and whether a red is real. This skill owns what goes inside it.

---

---
name: write-tests
description: Write unit tests for a component or module following project conventions
argument-hint: <component-name-or-path>
---

Write unit tests for: $ARGUMENTS

## Rules

- AAA pattern (arrange, act, assert) with clear separation; don't label steps explicitly
- Query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- Use `@testing-library/user-event` (not `fireEvent`)
- Don't import React in test files
- Don't mock translations unless truly necessary
- Don't test CSS, utility modules, refs, displayNames, or simple prop plumbing
- Don't update snapshots unless the task explicitly involves UI changes
- Reuse existing MSW handlers and mock factories; don't create new mock structures if central ones exist
- Don't write unreal tests
- Test user outcomes and behavior, not implementation details or internal state
- Don't add extra comments in tests
- Co-locate tests in `__tests__/` near components
- Extract a reusable `setup()` helper when multiple tests share similar render/mock logic
- Use `satisfies` for `defaultProps` typing when the component exports its props type
- Use descriptive test names that read as natural English and describe the user-visible outcome

## Reference Example

Use this as a proper structure of the test file (read-only reference, do not execute):

(The example file this pointed at has been deleted. See the note at the top.)

## Workflow

1. Read the component/module source code first
2. Identify all branches, conditions, and user-visible outcomes
3. Check for existing tests in the `__tests__/` folder next to the component
4. Check for existing mock factories or MSW handlers that can be reused
5. Write tests covering each distinct behavior
6. Run the tests with `npm test -- --testPathPattern="<ComponentName>"` and fix any failures
