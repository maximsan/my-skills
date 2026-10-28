# Changelog

Decisions and why. Git shows *what* changed; this records *why*, for the reasoning that isn't obvious from a diff.

Add an entry when you change something for a reason you'd want back later. Skip it for typos and rewording.

Each entry is its own file in this folder, so two branches never edit the same file:

- The file is named `YYYY-MM-DD-short-title.md`, e.g. `2026-10-25-skills-are-linked-in-each-app.md`.
- Its first line is `## YYYY-MM-DD — Title`, with the same date as the file name.
- It has no other `## ` heading. Use `###` for sections inside it.
- Its links start from this folder, e.g. `../docs/SETUP.md`. The built file adjusts them.

`node scripts/changelog.mjs` checks every entry. `npm run changelog` also builds `CHANGELOG.md` at the repo's top
folder: this intro, then every entry, newest first. Git ignores the built file. Entries from the same day are in
reverse file-name order.

The commit convention lives in [CONTRIBUTING.md](../CONTRIBUTING.md#commit-convention).
