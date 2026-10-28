## 2026-09-24 — A setup CLI, and personal notes that stay personal

SETUP.md asked a newcomer to read about 350 lines and type `<you>` into about ten commands. It also had them choose
branches that often didn't apply. Several steps failed silently, and two could destroy things. `claude-rules` now
does the install: `setup` once per computer, `add-app` once per app, and `doctor` to check both.

### What the manual steps got wrong

- "If `.claude\skills` exists, delete it first" could delete someone's own skills. The CLI refuses a real folder
  with files in it, and says what to do instead.
- Setting `core.excludesFile` overwrote any ignore setup you already had. It also changed git for every repo on the
  machine.
- Ignoring `CLAUDE.md` everywhere hid any `CLAUDE.md` a team committed later.
- Nothing mentioned the import dialog. Every `@` line points outside the app, so Claude asks once per app to allow
  them. Choosing No turns the rules off until you reset it (see SETUP.md), and nothing says so. That may be what
  the BANANA-7 test has been reporting as "pointers aren't supported".

### Personal notes moved to CLAUDE.local.md

The project's own `CLAUDE.md` belongs to the team, and is never touched now, committed or not. Your notes and the
stack `@` lines go in `CLAUDE.local.md` next to it. Claude Code loads both, this one second. That also removes the
"is every app React?" branch: stack lines are always per app, picked from what the app contains.

The evidence it works on 2.1.39, before testing: an Anthropic contributor confirmed it on 2025-12-02
(anthropics/claude-code#2394), and 2.1.39 shipped after that without touching it. The Windows check still needs doing.

### Kept out of git per repo, not globally

`add-app` writes three lines to the repo's `.git/info/exclude`. That's git's private ignore file: never committed,
and only in your copy. Git's own docs name it for exactly this, "auxiliary files … specific to one user's workflow".
The global config is never touched. The manual setup needed a global rule because every per-app step was typed by
hand. Once a tool does the per-app work, that reason goes away, and the costs stay.

Two rules keep that promise. A backup of a file inside an app goes to `.git/claude-rules-backups/`, outside the work
tree, so it never shows in `git status`. And a `docs/ai/` or `investigations/` the team already commits is theirs:
`add-app` adds no ignore line for it and writes nothing into it.

### How the CLI is built, and what was left out

Plain Node 18+, no dependencies, so `npm install -g <clone>` works behind any proxy. Every command goes through the
same six stages. Nothing is written before "Go ahead?", and checks run with writes locked, so they can't change
anything by mistake. Every way the process could hang has a guard: questions, children, timers and the exit itself.
The developer guide says why each one exists (`docs/cli/developer-guide.md`).

Deliberately left for later: `remove`, arrow-key menus, a headless `claude -p` check, and migrating old setups
automatically. Each one waits until people actually use the rest. Arrow keys also need the terminal in raw mode.
Raw mode is where "Ctrl+C doesn't work" and "my terminal is broken" bugs come from, for a menu people open three
times.

The common-rules trial gains three words: "this app's `CLAUDE.md` and `CLAUDE.local.md`". That's a pointer to where
the facts now live, not a new rule. It shouldn't move the comparison against the version before the trial.
