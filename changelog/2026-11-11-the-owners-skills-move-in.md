## 2026-11-11 — The owner's own skills move into this repo

Old: six of the owner's skills lived only in `~/.agents/skills`, with no history or backup.

New: `check-prose`, `disk-audit`, `pr-description`, `repo-checks`, `review-and-fix` and `using-zod` live in
`skills/`.

- Their scripts now pass this repo's lint, with the same behaviour.
- `npm test` runs their tests too, from each skill's folder and its `scripts/` folder.
- Lint treats a skill's scripts as entry points, and its tests as tests.

**Cost:** after merging, `~/.agents/skills` must link to these folders instead of holding its own copies.
