---
name: check-prose
description: "Check prose against the writing rules before it goes out. Use it on any Markdown a person will read: an issue body, a PR body, an ADR, a doc."
---

# Check prose before it goes out

Run it on each file a person will read, before it is published:

```bash
node ~/.agents/skills/check-prose/check-prose.mjs <file> [<file> ...]
```

A body going to `gh issue edit` or `gh pr edit` is already a file for `--body-file`: check that file. Fix every
finding, then run it again. Publish when it reports none.

It flags:

- an aside between two dashes
- "that X" where X was never named before it
- a ticket named only by its number
- a count of parts of the code or the work, such as "52 unit tests", which goes stale in a doc. The prose gate checks
  counts only in docs and READMEs: a PR or issue body describes one fixed change.

Every other writing rule needs a reader: apply the *Writing* section of `~/.claude/CLAUDE.md`.
