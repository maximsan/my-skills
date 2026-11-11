## 2026-11-11 — The owner's skills live in this repo

Old: nothing recorded which skills were the owner's. Each agent had to work it out, and could create a skill anywhere.

New:

- Every skill in `skills/` is the owner's. `~/.agents/skills` links to it.
- `rules/workflows/github-flow.md` says to create a new shared skill here and link it, and to leave packaged skills
  unchanged.
- `cli/hooks/skill-home-gate.mjs` refuses a Claude Code file write into a skill folder under `~/.agents/skills` or
  `~/.claude/skills` that lands outside this repo. The Mac's `~/.claude/settings.json` turns it on.

**Cost:** an agent can edit an owner's skill only after it moves here. Writes through a shell command, and other
agents' file writes, aren't checked.
