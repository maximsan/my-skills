## 2026-08-31 — Write only what the task needs

Two things kept recurring a week apart in the same session: code guarding against inputs that couldn't occur, and
code nested or dense enough to need a comment explaining itself. Checked v1's `scaffold` and `write-tests` first —
neither covers it, correctly, since it isn't an app-specific pattern and those files are project conventions.

Went in `common/CLAUDE.md`, not a new skill: per `rule-author`'s own test, this is something you'd want on *every*
task that writes code, not one task type you could name for it to fire on.

`task-review`'s "Left behind" checklist got a matching line, on the same reasoning `duplicates` is already called
out there instead of left to the generic "check the rules" item: a concrete, checkable line survives being skimmed
in a way a general instruction doesn't.
