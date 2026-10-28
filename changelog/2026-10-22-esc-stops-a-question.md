## 2026-10-22 — Esc stops a question

Esc at a typed question, such as "Go ahead?", now does what it does in a pick list:

- Old: Esc stopped a list, and did nothing at a typed question.
- New: Esc stops both, as in the `common-scripts` CLI.

The run ends as with Ctrl+C: "Stopped by you", exit code 130.

At "Go ahead?", Esc means the same as no: nothing is changed. It ends the run instead of moving on.
