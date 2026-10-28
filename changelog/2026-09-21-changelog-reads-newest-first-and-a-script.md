## 2026-09-21 — Changelog reads newest first, and a script keeps it that way

Entries were in chronological order, oldest at the top — backwards from how every changelog is read,
and from what anyone scanning for "what changed recently" expects.

The cause is worth recording, because it's structural rather than careless. The file ends with a
`## Commit convention` section, so the obvious anchor for inserting a new entry is "just above the
footer" — which is the bottom. Every one of the eight entries went in that way, in a single session,
without the mistake ever being visible from the inside.

`scripts/changelog.mjs` (Node, no dependencies, since these are React projects and Node is already
there) checks ordering, heading format, and separators, and `--fix` rewrites. It found two things
beyond the ordering: separators were inconsistent, five between eight entries, and my own first
version of the sort flipped same-date entries on every run — caught by testing that a second `--fix`
changes nothing, not by reading it. Within a date the file's order is now preserved, which is what
makes re-running safe.

Deliberately a checker, not a generator. Generating entries from `git log` would defeat the point of
this file twice over: it would include everything, when the rule above is to skip typos and
rewording, and it would restate commit bodies that already say the same thing.
