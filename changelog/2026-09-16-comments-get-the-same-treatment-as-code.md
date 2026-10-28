## 2026-09-16 — Comments get the same treatment as code

Comments were being edited to match changed code without being read first. Extended
`why-this-exists` rather than writing anything new: it already exists to establish why something is
there before you touch it, and a comment is the same problem.

### Except it's the harder case, because rung 1 doesn't exist

The ladder opens with "comment it out and run the tests", which is both the cheapest check and the
most reliable. **No test covers a comment.** Nothing fails when you destroy one, nothing goes red in
review, and the loss surfaces months later as somebody reintroducing the bug it warned about. So the
safety net has its hole exactly where it's otherwise strongest, and comments go straight to the git
history rung.

### The failure is quieter than deletion

Nobody deletes a comment on purpose. You change the code, the comment now reads as stale, and you
update it to describe what the code does now. That looks like tidiness, and it's how the warning
disappears.

The reframe that makes it actionable: **a comment contradicting your change is evidence about the
change**, not a stale line to bring into line with it. Sometimes it's telling you the change is
wrong. Read it and account for it before overwriting it.

### Which comments are load-bearing

The test is whether it says *why* rather than *what*. A comment restating what the line does is
regenerable from the code. One naming a bug, a ticket, a browser quirk, a version, an ordering
constraint, or a rejected approach is not, and gets the same treatment as load-bearing code.

Stated as a rule so it survives the diff looking innocent: **rewriting a `why` comment into a `what`
comment is a deletion**, and `task-review` now treats a reworded comment as a rewritten block —
where nothing in the diff, the tests, or the build will flag it.

### Paid for within the line budget

`common/CLAUDE.md` was at 199 of its 200-line cap, so the comment clause was funded by merging the
two paragraphs on either side of it rather than by raising the cap. The always-on rule keeps a
standalone action and doesn't decay into a pointer, which is the constraint SETUP's rules for
maintaining the common rules set.
