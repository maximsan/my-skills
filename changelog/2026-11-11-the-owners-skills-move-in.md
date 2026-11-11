## 2026-11-11 — The owner's own skills move into this repo

Old: six of the owner's skills lived only in `~/.agents/skills`, with no history or backup.

New: `check-prose`, `disk-audit`, `pr-description`, `repo-checks`, `review-and-fix` and `using-zod` live in
`skills/`.

- Their scripts now pass this repo's lint. Their behaviour is unchanged.
- `npm run typecheck` now covers the scripts at a skill's top level too, not only those in its `scripts/` folder.
- The scripts now run correctly through a symlink. Before, a script started through a link printed nothing.
- `npm test` runs their tests too, from each skill's folder and its `scripts/` folder.
- Lint holds a skill's scripts to the same rules as `cli/run.mjs`. Its tests may keep values inline.

**Cost:** After merging, replace each folder in `~/.agents/skills` with a symlink to its folder in `skills/`.
