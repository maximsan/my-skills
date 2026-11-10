## 2026-11-08 — Rules cut to what changes behaviour

The owner went through `rules/common.md`, both workflow files and `design-preferences` line by line. Most of the text
came from agent drafts and repeated itself or explained its own reasons.

- Each rule is now one short line where it can be. Sentences that only gave a reason or repeated another rule are
  gone, and so are a few rules the owner judged unneeded.
- Three groups of rules moved from the Mac's workflow, `github-flow.md`, into `rules/common.md`: keeping one home for
  each fact, the code style rules, and the limit of three subagents.
  - Old: only the Mac's workflow had them.
  - New: the Windows workflow, `task-flow.md`, follows them too.
- `design-preferences` no longer forbids an uppercase label above a heading.

**Cost:** the rules keep their main ideas but lose most examples. An agent that misreads a rule has less text to
correct it.
