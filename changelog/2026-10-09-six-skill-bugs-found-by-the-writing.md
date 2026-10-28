## 2026-10-09 — Six skill bugs found by the writing-for-agents review

A review of every skill against the `writing-for-agents` guide found six places where a skill made the agent do the
wrong thing. Two fixes carry a reason worth keeping:

- `task-review` takes the fix out with `git diff` and `git apply -R`, not `git stash`. All worktrees share one stash
  list, so a bare `git stash pop` can restore another session's changes. A stash also holds nothing once the fix is
  committed. The patch is made with `--binary`, so a fix that touches a binary file still comes out, and
  `git status` before and after shows that every file is back.
- `rework` writes a triage report and an amended `plan.md`, and no product code. Its steps said "delete it" while its
  report called the same items suggestions. The README already said the user approves the triage, so the report
  wording was right and the steps were wrong.
