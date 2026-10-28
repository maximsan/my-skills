## 2026-10-09 — Investigation tracks its steps in progress.md

`task-investigate` wrote nothing to a file until `findings.md` near the end. A session that ran out of room lost its
place and its notes.

- Not in `findings.md`: that's the result `task-plan` reads, and a working checklist is noise there.
- Implementation keeps `plan.md` as its checklist. Copying it into `progress.md` would give two lists that disagree.
- The checklist items have no step numbers. `progress.md` already holds the plan's numbered steps, and `rework`
  relies on those numbers.
