# Leftovers in a diff

Read by `task-implement` before it says a change is done, and by `task-review` when it checks one. Read the whole
diff, and say for each item whether it was found.

- Functions added that nothing calls. Unused imports. Dependencies nothing needs.
- Commented-out code, new `TODO`s, debug prints, temporary logging, test scaffolding.
- A branch, validation or try/catch for a case nothing can produce (see *Handling a case you haven't seen* in the
  common rules). It means the cause wasn't found.
- Config keys or feature flags from an approach that got dropped. Cross-check `progress.md` for abandoned
  attempts: anything from them still in the diff is dead code.
- **Duplicates.** Anything added here that already exists elsewhere. Search by what it does, not by name. Two
  functions doing the same job, or a new file that should have been an edit to an old one.
- Files in `src/` that belong in `scratch/`.
- Documents copied instead of updated (`plan-final.md`, `notes-2.md`), and docs that now contradict the code.
