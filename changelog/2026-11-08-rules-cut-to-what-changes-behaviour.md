## 2026-11-08 — Rules cut to what changes behaviour

The owner went through `rules/common.md`, both workflow files and `design-preferences` line by line. Most of the text
came from agent drafts and repeated itself or explained its own reasons.

- Each rule is now one short line where it can be. Sentences that only gave a reason, or repeated another rule, are gone.
- Writing each fact once, the code style rules and the limit of three subagents moved from `github-flow.md` into
  `rules/common.md`. Windows follows them too now.
- `design-preferences` no longer forbids an uppercase label above a heading.

**Cost:** the rules keep their main ideas but lose most examples. An agent that misreads a rule has less text to
correct it.
