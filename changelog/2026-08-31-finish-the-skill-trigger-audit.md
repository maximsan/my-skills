## 2026-08-31 — Finish the skill-trigger audit

The Aug 11 session started auditing whether each skill's trigger conditions were actually distinct, after getting
two overlaps wrong that day, and got cut off before finishing. Two gaps turned up on completing it.

`rework` never got a standalone trigger in `common/CLAUDE.md`, unlike the other three loose skills —
`why-this-exists`, `failing-test-first`, and `rule-author` all got one once description-matching alone turned out
not to be enough. `rework`'s own description says it can match a request directly, so it needed the same fix.

`task-review` and `rule-author` both claim "review this" — for different targets. `task-review` assumes an
application-code diff with a `task.md`/`plan.md` behind it; asked to review a `SKILL.md` or `CLAUDE.md` entry
instead, it has nothing to read. `task-review`'s description now says which is which.
