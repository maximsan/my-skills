## 2026-11-06 — Common rules split from each machine's workflow

The Mac and Windows follow different workflows, and Codex, OpenCode and Cursor are joining them. `rules/common.md` mixed
what every agent should do with what one workflow needs, so it couldn't be shared.

- `rules/common.md` keeps what holds everywhere, and adds writing and evidence rules from the owner's Mac rules.
- `rules/workflows/task-flow.md` takes the task folders, which skill to load when and the `Backlog` list. Their
  sentences are kept, because skills search for that text. Two headings are new.
- `rules/workflows/github-flow.md` holds the Mac's rules for code style, branches, worktrees and pull requests. The setup tool doesn't load it yet.
- `design-preferences` holds the visual preferences. The Mac's global file still loads its own copy until that file
  moves over.

**Cost:** a machine already set up must run `claude-rules setup` again after pulling. Until then it loads the common
rules without its workflow. `doctor` reports the missing line. A machine that loads `task-flow.md` also reads more words each turn, mostly the writing and evidence rules.
