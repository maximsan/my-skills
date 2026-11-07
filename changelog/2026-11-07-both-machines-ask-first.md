## 2026-11-07 — Both machines ask before choosing

Old:
- The Mac asked before any step that could go more than one way.
- Windows took a safe default and marked it `⚠️ Assumed:`, so a wrong guess showed up only in the result.

New: both ask first. The rule moved into `rules/common.md`.

- The task skills sort open questions into three kinds: answered by the code or ticket, a question for the user, and a
  probe. A probe is a small check that answers a question by running something.
- The user's answers go into `findings.md`, or into `progress.md` as `Answer:` lines. `rework` and `task-learn` read
  those instead of the old marker.

**Ruled with it:** Windows keeps working directly in each app's folder. A separate git worktree per change stays a
rule for the Mac only.

**Cost:** Windows stops more often to ask. Old task folders keep their `⚠️ Assumed:` lines, and the skills no longer
read them.
