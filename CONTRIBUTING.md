# Contributing

## Commit convention

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
type(scope): imperative summary, lower case, no full stop

Body: why the change was needed. Wrap at 72 characters.
```

Keep the subject line under ~60 characters. Example: `feat(skills): add write-tests`.

| Type | For |
| --- | --- |
| `feat` | Something new: a rule, a skill, a stack file, a CLI command |
| `fix` | Something was wrong: a rule that misleads, a skill that misfires, a CLI bug |
| `refactor` | Same behaviour, new shape: splitting a rule, moving text, renaming |
| `docs` | README, SETUP, the CLI guides, this file and the changelog. Rules and skills are the product, so they are not `docs` |
| `test`, `chore` | Tests; tooling and housekeeping |

The scope is the folder the change lives in: `rules`, `skills`, `templates`, `cli`, `legacy`, `docs`,
`changelog`. Use `claude` for this repo's own `CLAUDE.md` and `.claude/`, and `release` for a version
bump. A change across several folders takes the main one, or no scope.

Body: **why**, not what. The diff already says what. Worth answering:

- what problem this solves, or what failure it prevents
- what was considered and rejected, if the choice wasn't obvious
- what it costs, if it costs something

One idea per commit. If the body needs "and also", it's two commits.

## Changing the rules

Rules load on every turn, so each line costs attention on every task. Before adding one, read this.

### The common rules

`rules/common.md` loads on every turn of every task, so every line in it competes with the actual work.

- **Keep it under 200 lines.** Count words too, with `wc -w`. Lines are easy to game by re-wrapping. Words are what
  the model actually reads.
- **Nothing in it names a specific repo, folder, or framework.** That goes one level down, in a stack file or an
  app's `CLAUDE.local.md`.
- **Keep one standalone action in every section that points at a skill.** A section that only says "load X" does
  nothing on the days X doesn't load. The procedure lives in the skill. The trigger and the first action stay here.
- **If a topic needs more room, make it a skill** that loads when that work comes up.

### The stack files

`rules/react.md` and `rules/microfrontend.md` load on every turn of every task in a matching app, so what's in
them is competing for attention with the actual work. That makes them the easiest files to ruin by adding to them.

**Could eslint check it instead?** Named exports, no fetching inside `useEffect`, stable list keys, no `any`,
complete dependency arrays, no nested ternaries, no `console.log`, no namespace imports, banned libraries — all of
those are lint rules. A lint rule can't be skimmed past and costs nothing to keep loaded. The stack files are only
for what tooling can't express.

**Readability is more lintable than it looks**, which is worth knowing because it reads like taste and taste is what
gets skimmed. Code written inline that should have been a named value is mostly reachable by `no-magic-numbers` for
inline literals, `sonarjs/cognitive-complexity` and `complexity` for expressions doing too much at once, `max-depth`
and `max-nested-callbacks` for nesting, and `max-len` to force long chains apart. What survives all of those —
whether a particular expression has a concept behind it worth naming — is the only part that needs a written rule,
and it's in `rules/common.md` under "Do what I asked, and only that".

Then three rules:

- **Nothing names a specific project, folder, or business term.** The moment it does, it's wrong everywhere else and
  belongs in that app's `docs/ai/NOTES.md`.
- **Keep each one under 50 lines.** If a topic needs more room, make it a skill that loads when that work comes up.
- **Only add things you've had to correct twice.** A rule you don't enforce teaches Claude that rules are optional.

**Worth checking first:** if you can't write ten entries true in **two** of your actual apps, skip the shared file
and keep per-project notes instead. A shared file that's mostly exceptions is worse than no shared file.

These files only work while they stay uncommitted. An `@` pointing at your folders finds nothing on anyone else's
machine — if one ever gets committed, paste the full text in first.

## The Claude Code version to build for

Everything here must work on Claude Code 2.1.39: the version on a managed Windows environment, with its updates turned off. Before
using a Claude Code feature, such as a settings field, a hook option or a skill variable, find the version that added
it in the [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md). Newer than 2.1.39
means it doesn't exist there. Two that bit: a hook's `args` field, which 2.1.39 drops from `settings.json`, and
`${CLAUDE_SKILL_DIR}`, added in 2.1.69.
