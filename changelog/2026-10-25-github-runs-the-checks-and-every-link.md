## 2026-10-25 — GitHub runs the checks, and every link in the skills is tested

Two mistakes reached a merge because nothing ran the checks for them:

- Four skills read shared files through `../shared/`, and the per-skill links broke that path in every app. A test
  now follows every relative link in every skill file from an app's `.claude/skills`, the way Claude resolves it.
- The changelog check was run by hand. `npm run check` now ends with it.

`.github/workflows/check.yml` runs `npm run check` on every pull request and every push to `main`. A pre-commit hook
was rejected: a global `core.hooksPath` makes git skip a repo's own hooks.

What it costs: a link written as plain text, rather than a Markdown link, isn't checked.
