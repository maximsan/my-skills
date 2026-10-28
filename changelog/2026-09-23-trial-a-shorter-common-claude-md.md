## 2026-09-23 — Trial: a shorter common/CLAUDE.md

This is an experiment. It gets compared against the version before it after a few real tasks.

**Baseline:** the version just before the trial, 199 lines and 1,754 words. **Trial:** 165 lines and 1,458 words,
about 17% fewer words.

What went, and where it still lives:

- **The six debug steps.** They repeat `debug` §1–7. The rule keeps its standalone action: stop patching, load
  `debug`, and write the symptom and causes into `debug.md` before the next change.
- **The false-red detail for bug tests.** It's in `failing-test-first`. The rule keeps "no fix before a red test"
  and "show red and green".
- **Maintainer guidance** (the 200-line cap, no project names). It moved to SETUP's new "Maintaining the common
  rules" section. The agent doesn't need it on every turn.
- **Small sections merged into neighbours.** "Stay in scope" joined "Write only what the task needs", now titled
  "Do what I asked, and only that". "Keep memory in files" joined the pivot checkpoint, as "Keep state in files,
  not in the chat".
- **Repeated sentences.** Two restatements in "One file per purpose" and one in "Ask instead of assuming".

What was deliberately not touched: the `Skills:/Rules:/Context:` header, the file:line example, the pivot
checkpoint, and the unsourced-guard bullet. These fire mid-task, where no skill would reach.

**How to compare:** after about five tasks, count the `docs/ai/FEEDBACK.md` tags against the tasks before. Watch
`missing-rule` and `said-done-but-wasnt` most. Those are the tags a cut trigger would raise. If either goes up, run
this to see which cut is the likely cause, and restore only that one:

```
git diff "$(git log -1 --format=%h --grep='Trim common rules to 165 lines as a trial')^:v2/common/CLAUDE.md" HEAD:rules/common.md
```
