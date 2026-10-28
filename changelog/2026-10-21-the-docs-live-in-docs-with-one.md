## 2026-10-21 — The docs live in docs/, with one glossary

`SETUP.md`, `EXAMPLE.md`, the glossary and the setup tool's guides moved into `docs/` at the repo root. Before, they
sat in `v2/` and `v2/cli/docs/`, mixed in with the files the tool installs.

`common/`, `stacks/`, `skills/`, `per-project/` and `migrations/` stay in `v2/`, because the tool and Claude load
them by path. Moving any of them would break setups already installed. The tool itself, `v2/cli/`, and
`v2/README.md` stay too.

There were two glossaries, one for the rules and one for the tool. They defined `skill`, `rule`, `@` import,
junction, `CLAUDE.local.md`, `projects\CLAUDE.md` and `.git\info\exclude` separately, in different words. There is now
one glossary, `docs/GLOSSARY.md`, with the rules' terms as its first section.

The setup tool recognises its comment in `.git/info/exclude` by how the comment starts, not by its full text. The
comment now names `docs/SETUP.md`, and an app set up earlier, whose comment still names `v2/SETUP.md`, isn't given a
second copy.

"Stage" named two things: the task skills, in `v2/README.md` and `task-review`, and the six stages every
setup-tool command goes through, in the glossary. The task skills now have that name, so the setup tool's stages are
the only stages in the glossary.
