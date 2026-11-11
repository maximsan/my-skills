## 2026-11-11 — The owner's skills live in this repo

Nothing recorded which skills were the owner's, so each agent had to work it out, and could create a skill anywhere.

- `skills/` is now the list: a skill is the owner's when `~/.agents/skills` links it into this repo.
- `rules/workflows/github-flow.md` says new shared skills are created here and linked, and packaged skills are changed
  upstream.
- `cli/hooks/skill-home-gate.mjs` refuses an agent's write straight into `~/.agents/skills` or `~/.claude/skills`.

**Cost:** the owner's skills that aren't moved here yet can't be edited by an agent until they move.
