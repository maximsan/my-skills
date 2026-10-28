## 2026-10-23 — Text two skills share lives in skills/shared/

`task-implement` and `task-review` each kept a leftovers checklist. `task-investigate` and `task-plan` each defined
the open-question kinds, and their BLOCKER definitions disagreed. Each shared text now has one file in
`skills/shared/`, and both skills point at it.

- A link from one skill into another's `SKILL.md` was rejected. It ties one skill's text to another skill's
  headings.
- `skills/shared/` has no `SKILL.md`, so Claude doesn't load it as a skill and the CLI doesn't count it as one. It
  reaches every app through the skills link, like the skills themselves.

The test tools moved the same way: Jest is named in the TypeScript rules, and React Testing Library in the React
rules. `write-tests` named both for every app, React or not.
