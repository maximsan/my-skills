## 2026-10-27 — Tests catch broken links and stale answers

- **A new test checks every relative link in the repo's Markdown.** It fails when a link points at a missing file, or
  at a heading the file doesn't have. Moving a section used to break links that only a manual search could find.
- **A test now fails when it scripts an answer that's never asked for.** Before, a question removed from a command
  left its scripted answer behind, and the test still passed.
