## 2026-10-26 — A hook reminds Claude to test a bug first

A bug fixed without a failing test first was the costliest miss in the skills review. It happens when
`failing-test-first` doesn't load. Now a hook reminds Claude. When a message mentions a bug, Claude Code adds one
line to Claude's context. The line says to load the skill and show the failing test, then the passing one.

- **It reminds, and never blocks.** A wrong match costs one line of context. Blocking would need a detection rule
  proven precise first.
- **It matches a fixed list of words**, such as "bug", "broken" and "not working". "fix" and "error" are left out:
  they also come in "fix the typo" and "add error handling".
- **It lives in `~/.claude/settings.json`, added once by `setup`.** The script checks the folder Claude works in.
  It answers in the projects folder and in every app below it, never in `prompts`. So one entry covers every app,
  including apps set up before it existed. The projects folder counts because Claude is often started there.

- **Its command is one line, `node "<path to the script>"`.** Claude Code can also take the program and its
  arguments as separate fields, `command` and `args`. Claude Code 2.1.39, still used on a managed Windows environment with updates
  turned off, doesn't know `args` and drops it when it rewrites the file. What's left is a bare `node`, which fails
  on every message. `setup` replaces such a bare `node` entry, and an entry in the `args` form, with the one-line
  form.

Rejected:
- `projects\.claude\settings.json`. Claude Code reads settings only from the folder it starts in, so a hook there
  never runs from an app folder. A test on a managed Windows environment confirmed it.
- Each app's `.claude\settings.local.json`, written by `add-app`. It needs `add-app` run again in every app, and one
  more file per app to keep in step. The folder check gives the same scope from one place.
