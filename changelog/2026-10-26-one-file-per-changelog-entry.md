## 2026-10-26 — One file per changelog entry

Every branch added its entry at the top of `CHANGELOG.md`, so any two branches open at once conflicted there. It
happened with PR #12 and PR #14, then with PR #15 and PR #17. GitHub skips a pull request's checks while it has a
conflict.

Each entry is now its own file in `changelog/`, named by date. `scripts/changelog.mjs` checks every file, and
`npm run changelog` builds `CHANGELOG.md` from them. Git ignores the built file, so no branch edits it.

Rejected: keeping one file and resolving the conflicts by hand.

What it costs:

- On GitHub, the history is a folder of files, not one page. `npm run changelog` builds the page locally.
- Entries from the same day are ordered by file name, not by when they were written.
