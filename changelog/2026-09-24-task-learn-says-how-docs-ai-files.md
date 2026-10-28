## 2026-09-24 — task-learn says how docs/ai/ files get created and approved

Four gaps, all in `task-learn`, found by asking what rules the skills follow for `docs/ai/`.

- **Nothing created the note files.** SETUP says to leave `docs/ai/` empty apart from the Exemplars table. Then
  `task-learn` said "Don't create a new file". In a fresh app, the first gotcha had nowhere to go. The rule meant
  "no files beyond the known seven", so it now says that, and creates a missing one with its header.
- **Approval was claimed, not required.** README says you approve what `task-learn` saves. The skill only said to
  show a proposal. It now says to write nothing until you approve, and the proposal includes `PROPOSALS.md` and
  `FEEDBACK.md` rows too.
- **The `checked against` header applied to every file.** That included the two logs, which describe no code. It
  now covers the five note files only.
- **The `FEEDBACK.md` example wasn't a valid table.** It had no separator row, and nothing said how to start the
  file. Both are fixed.
