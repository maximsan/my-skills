## 2026-11-11 — The owner's own skills move into this repo

Old: the owner's skills lived only in `~/.agents/skills`, with no history or backup.

New: `disk-audit`, `pr-description`, `repo-checks`, `review-and-fix` and `using-zod` live in `skills/`.

`check-prose`, a skill that checked prose against the writing rules, is not brought into this repo. Only one of its
checks caught real problems: an extra fact set off between two dashes in the middle of a sentence. That check moved
into the prose gate, a script in `~/.claude/hooks` that checks a PR or issue body before an agent posts it. Codex,
OpenCode and Cursor run it. Claude Code runs no prose checks, by the owner's choice.

- Their scripts now pass this repo's lint. Apart from the symlink fix below, their behaviour is unchanged.
- `npm run typecheck` now covers the scripts at a skill's top level too, not only those in its `scripts/` folder.
- The scripts now run correctly through a symlink. Before, a script started through a link printed nothing.
- `npm test` runs their tests too, from each skill's folder and its `scripts/` folder.
- Lint holds a skill's scripts to the same rules as `cli/run.mjs`. Their tests may keep values inline.

**Cost:** after merging:

- Delete `~/.agents/skills/check-prose` and the link to it, `~/.claude/skills/check-prose`.
- Replace the folders of the skills listed above in `~/.agents/skills` with symlinks to their folders in `skills/`.
