> **LEGACY — do not use.**
> Replaced by the `task-implement` skill: `skills/task-implement/SKILL.md`.
> Kept only as a record of the original prompt for executing an approved plan.
>
> Every requirement below carried over into the new skill. What deliberately changed:
>
> - "Stop and ask if blocked" was binary. The new skill has three tiers (proceed / proceed-and-flag / stop), because binary means barrelling through real problems or stopping for trivia.
> - The new skill adds a diff check before finishing, so leftover files and dead code from abandoned attempts don't survive.

---

This is an implementation task. Treat this message as the explicit go-ahead to implement the plan below — it's approved for execution, not just investigation.

<APPROVED_PLAN>
@investigations/plan.md
</APPROVED_PLAN>

Rules:
- If the plan file cannot be found or read, stop immediately and ask — do not guess at its contents.
- If an earlier investigation pass already recorded findings or deviations against this plan, read them first and incorporate them. Don't re-investigate what's already been resolved unless something looks off.
- Follow the approved Implementation Plan step by step.
- Implement only what the plan specifies. Do not add unrelated refactoring, cleanup, or improvements beyond what the plan calls for.
- Keep existing behavior unchanged unless the plan explicitly requires changing it.
- Only mark a step's Definition of Done as met once it is actually, verifiably satisfied — not just attempted.
- Carry out every step in the plan's Verification Plan and record the actual result.
- Fulfill the plan's Test Plan: add or update the unit tests and any other project-required tests it specifies.
- If you find a blocking issue, unclear requirement, or a conflict with the existing codebase, stop and ask before continuing.

While working:
- Mark completed Implementation Plan items as done directly in plan.md, so it stays a living record of progress.
- Record each verification result as you complete it.
- Mark Test Plan items as done as you add or update the corresponding tests.
- Document any files changed.
- Document any deviations from the plan.

Final response format:
## Completed Plan Items
- [x] ...

## Verification Results
- [x] Verification step: ... — Actual result: ...

## Test Plan Completion
- [x] Test item: ...

## Files Changed
List every file touched. Write `None` if none.

## Deviations From Plan
Write `None` if there were no deviations.

## Remaining Risks / Suggestions
Write `None` if there are no remaining risks or suggestions.