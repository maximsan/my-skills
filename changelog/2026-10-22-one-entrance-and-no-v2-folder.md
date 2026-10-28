## 2026-10-22 — One entrance, and no v2/ folder

The repo had two entrances: the root `README.md` and `v2/README.md`. Everything the tool installs sat one folder
down, in `v2/`, so a new reader had to work out which README to read first.

`README.md` is now the one entrance. It took the list of what these rules fix from `v2/README.md`. The rest of that
file is now `docs/HOW-IT-WORKS.md`. The rules, the skills, the templates, the migrations and the setup tool sit at the
top of the repo:

- `rules/` holds the common rules, as `common.md`, next to the stack rules.
- `per-project/` is now `templates/`.
- `v1/` is now `legacy/`.

This reverses the 2026-10-21 decision to keep these folders in `v2/`. That decision protected installed setups. The
only installed setup was the maintainer's, fixed by hand, and the team installs after this change.

The version labels went too: `common-rules v2`, `stack-rules: react v2` and the notes marker's `app-notes v2`. They
started at v2 and were never raised. `--version` now shows only the tool's version.
