## 2026-10-26 — Proposed rules move into FEEDBACK.md

`task-learn` now keeps proposed rules in `docs/ai/FEEDBACK.md`, under `## Proposed rules`, after the corrections
table. `docs/ai/PROPOSALS.md` is gone.

A rule is proposed because the same correction came up twice. The proposal and the corrections behind it were in two
files, so you had two files to check after every few tasks. Now there's one, with the evidence next to each proposal.

`NOTES.md` stays on its own. It's the only file in `docs/ai/` that Claude reads before every task. A log of
corrections there would make that reading longer without changing what Claude does.

For an app that already has `PROPOSALS.md`, `doctor` points at the new
`migrations/002-proposals-into-feedback.md`. Claude shows what it would
move, and changes nothing until you approve.
