# Developer guide

For people changing `claude-rules`. To *use* it, see the [user guide](user-guide.md). Words you don't know are in the
[glossary](../GLOSSARY.md).

The tool is plain JavaScript for Node 18 or newer. Using it needs no packages. Changing it needs the linter and the
type checker, installed once with `npm install`. The whole tool is in `cli/`. Run these from the repo's top folder:

```
npm install                    once: the development tools, which need a newer Node than the tool; npm warns if not
npm run check                  lint, then type check, then every test
npm run format                 fix what the linter can fix by itself
npm test                       every test, in a throwaway folder; needs no install
node cli/main.mjs              run the tool from this copy without installing it
```

Contents:
- [How the code is organised](#how-the-code-is-organised)
- [The six stages](#the-six-stages)
- [Commands and steps](#commands-and-steps)
- [Recipes: adding things](#recipes-adding-things)
- [Why the safety guards exist](#why-the-safety-guards-exist)
- [Tests and checks](#tests-and-checks)

---

## How the code is organised

### Three layers

```
main.mjs        starts the tool: checks the Node version, then loads run.mjs
run.mjs         reads the command line, opens the menu or runs one command, and sets the exit code
   │
commands/       WHAT to do: each command is a plain object listing its steps. No printing, no terminal code
   │
lib/            HOW to do it: the only code that prints, asks, writes files, runs git, or touches the process
```

`hooks/` holds a second kind of entry point: scripts Claude Code runs itself, not the tool. Each one is a few lines
that read the hook's input, call `lib/`, and write the answer. They sit beside `main.mjs` and `run.mjs` in the top
layer.

The arrows only go down. `lib/` never uses anything in `commands/`, and `commands/` never uses `main.mjs` or
`run.mjs`. So you can read a command without reading how printing or git work, and you can test `lib/` without any
command.

### One home for each side effect

A side effect is anything that touches the outside world: printing, reading the keyboard, writing a file, starting
another program, or ending the process. Each kind lives in exactly one file. So there's one place to look for anything
that touches someone's computer, and one place a test swaps for a fake. `test/layers.test.mjs` fails if a rule is
broken.

| Only this file… | …may do this |
|---|---|
| `lib/ui.mjs` | print to the terminal (the one exception: `main.mjs` prints its "Node is too old" line itself, before anything else can load) |
| `lib/ask.mjs` | read answers from the keyboard, as typed lines or as key presses in a pick list |
| `lib/exec.mjs` | start another program, such as git |
| `lib/files.mjs` | write, rename or delete a file or folder |
| `main.mjs`, `run.mjs` | end the process, and react to Ctrl+C |
| `hooks/*.mjs` | read the hook's input from stdin, and write its answer to stdout, for Claude Code rather than a person |

### The files

| File | What it holds |
|---|---|
| `main.mjs` | Checks the Node version before anything else loads, then loads `run.mjs` |
| `run.mjs` | The menu loop, the follow-up offer (setup → add-app), and the safety net for errors and Ctrl+C |
| `commands/index.mjs` | The one ordered list of commands. The menu, the command-line reader and `--help` all read it |
| `commands/setup.mjs` | Once per computer: the shared rules line, the skills link in the projects folder, and the bug-fix reminder in your Claude settings |
| `hooks/bug-fix-reminder.mjs` | The hook Claude Code runs on each message. Its logic is in `lib/bug-fix-reminder.mjs`; the settings entry `setup` writes is in `lib/claude-settings.mjs` |
| `commands/add-app.mjs` | Once per app. Its questions are in `add-app-questions.mjs`, its steps in `add-app-steps.mjs` |
| `commands/doctor.mjs` | Checks everything, changes nothing. It reuses setup's descriptions and add-app's step checks. Its check for one app is in `doctor-app-check.mjs` |
| `lib/contract.mjs` | **Read this first.** The shapes of `Command`, `Step`, `CheckResult` and `Context`. Types only, no code |
| `lib/runner.mjs` | The runner that takes every command through the six stages |
| `lib/recap.mjs` | How the runner words its results: the plan labels, the recap and report rows, and the closing lines |
| `lib/layout.mjs` | Where every file lives, worked out from this repo's own location; how paths are shown |
| `lib/machine-setup.mjs` | The once-per-computer state, read and described the same way for `setup` and `doctor` |
| `lib/app-paths.mjs` | The one list of what `add-app` creates in an app. Its ignore lines, its summary and doctor's checks come from it |
| `lib/git.mjs` | The questions the tool asks git: is this a repo, where's its private ignore file, is this path ignored. Never changes anything |
| `lib/constants.mjs` | The command name and the minimum Node version. It uses nothing else, so `main.mjs` can load it on any Node |
| `lib/apps.mjs` | Finds the app folders, and reads one app's facts |
| `lib/stacks.mjs` | Which stack rule files exist, and which ones an app uses |
| `lib/app-notes.mjs` | Builds and updates `CLAUDE.local.md`. Pure functions |
| `lib/exclude-lines.mjs` | The lines for a repo's private ignore file. Pure functions |
| `lib/skill-links.mjs` | This repo's skills, and what an app's `.claude/skills` holds: our links, ones still to make, and the app's own |
| `lib/arguments.mjs`, `lib/menu.mjs` | The command line, `--help`, and the menu's items. Pure functions |
| `lib/picker.mjs` | The pick list: what each key does, and the lines it shows. Pure functions |
| `lib/text.mjs` | Wrapping text, plurals, comparing lines. Pure functions |
| `lib/errors.mjs` | The exit codes; `StepFailure` for a problem we understand; and the three errors that end a run |

A **pure function** takes plain data and returns an answer: it reads nothing and changes nothing. Everything that
*decides* is one, such as which stacks an app has, what the notes say, or whether a line is missing. Only thin wrappers
in `lib/` act on those decisions. That's why most tests need no folders at all.

---

## The six stages

Every command goes through the same stages. They're run by `lib/runner.mjs`, and nothing is written before stage 5.

1. **What it does:** the command's `title` and its `mayChange` list, or "Changes nothing." when that's empty. The
   `summary` is shown in the menu and `--help` instead.
2. **Looking around:** `lookAround()` returns findings, and changes nothing. It may ask one question: which app to
   work on.
3. **Questions:** `askQuestions()`. They're all asked up front, and no question ever comes up while the work runs.
4. **The plan:** every step's `check()`, run while **writes are locked**. Locked means any attempt to write a file
   throws an error, so a `check()` can't change anything, even by mistake.
5. **Go ahead?**, then every step whose check said `todo` runs its `apply()`, with a progress line each. When the step
   ends, its result row replaces the progress line, so each step is reported once.
6. **Recap:** the steps that still need attention (`can't do`, `not run`), one count line, the command's
   `afterwards()` lines, then one `Next:` line. After a failure, only "Fix the ✖ lines above", since the extra lines
   and `Next:` describe a finished run. A command's `followUp` is offered after that, e.g. add-app → the next app.

A command never prints a plan, asks "Go ahead?", or handles Ctrl+C itself. The runner does it, the same way for every
command. `--dry-run` stops after stage 4. `doctor` sets `isReadOnly`, so its stage 4 is the report, and nothing is
applied.

---

## Commands and steps

A **command** is a plain object: its name, what it says about itself, and a function that returns its steps. The full
shape is `Command` in `lib/contract.mjs`.

A **step** is one piece of work with two parts:

```js
{
  title: "Keep your notes out of git",                  // shown in the plan, the progress line and the recap
  check: async () => ({ status: "todo", reason: "…" }),  // only looks; writes are locked while it runs
  apply: async () => { /* makes the change */ return "optional detail for the recap"; },
}
```

What `check()` can answer:

| Status | Means | Shown in the plan | Shown by doctor |
|---|---|---|---|
| `todo` | needs doing, and `apply()` will do it. Give the `reason`, and the `action` the plan shows | the action | ✖ not set up |
| `done` | already in place | already done | ✔ |
| `blocked` | can't be done safely. Give a `reason` and a `fix` | can't do (the recap too) | ✖ problem |
| `skipped` | doesn't apply here | skipped | – skipped |
| `warn` | works, but worth a look (doctor only) | — | ! worth a look |

A check with several findings returns them as `points`, which are listed one per line under its row, instead of
joining them into one `reason`.

**Expected problems are results, not crashes:**
- In `check()`, return `blocked` with a `fix`.
- In `apply()`, throw `StepFailure(reason, fix)`.
- A `StepFailure` from `lookAround()` or `askQuestions()`, such as git refusing to read a repo, ends the run before
  anything changes.
- Anything else that's thrown is treated as a bug. It's shown as "Something unexpected went wrong", with the details
  under `--debug`.

**Running again must be safe.** `check()` sees what's already done and answers `done`. That's what makes a second run
change nothing, and a stopped run carry on where it left off.

---

## Recipes: adding things

### Add a stack

1. Add the rule file, e.g. `rules/java.md`, starting with a `# Java conventions` heading.
2. That's enough for `add-app` to offer it, unticked. "Without the CLI" in TROUBLESHOOTING.md says "every file in
   `rules/` except `common.md`", so it needs no change.
3. To detect it, add one entry to `STACK_DETECTORS` in [lib/stacks.mjs](../../cli/lib/stacks.mjs). The entry
   returns why the stack applies (`"pom.xml found"`), or `null`. Copy the `typescript` entry.
4. If detection needs a file's contents, not just its name, read it once in `readAppFacts` in
   [lib/apps.mjs](../../cli/lib/apps.mjs), the way `webpackConfigs` is. The detectors stay pure.
5. Add the stack to the `STACKS` list in `test/pure.test.mjs`, and a case to its "stack detection" tests.

### Add a step to a command

1. Write a function that returns a `Step`. Copy `createFolders` in
   [commands/add-app-steps.mjs](../../cli/commands/add-app-steps.mjs).
2. Put it in the command's `steps()` list, where it should run.
3. Update the command's `mayChange` and `summary` if the step changes something new. For add-app, add the path to
   [lib/app-paths.mjs](../../cli/lib/app-paths.mjs): both are built from it, and so are the ignore lines.
4. Give doctor the matching check:
   - For an app step, add it to `appSafetySteps`, which doctor runs for every app. Then read its result in
     `collectAppResults`, in [commands/doctor-app-check.mjs](../../cli/commands/doctor-app-check.mjs).
   - For a computer step, describe its state in [lib/machine-setup.mjs](../../cli/lib/machine-setup.mjs), the way
     `describeSharedRules` does, and call that from both commands.
5. Add a test in the command's test file, with an expected plan and recap. Copy the first test in
   `test/add-app.test.mjs`.

### Add a command

1. Create `commands/<name>.mjs`, exporting a `Command`.
   - Copy [commands/doctor.mjs](../../cli/commands/doctor.mjs) for one that only checks.
   - Copy [commands/setup.mjs](../../cli/commands/setup.mjs) for one that changes things.
   - Keep it in one file. Once it passes about 250 lines, split it into `<name>-questions.mjs` and `<name>-steps.mjs`,
     as add-app does.
2. Add it to `COMMANDS` in [commands/index.mjs](../../cli/commands/index.mjs). It then appears in the menu,
   `--help` and the command-line reader, described by its own `title` and `summary`. Its place in the menu comes from its
   place in `COMMANDS`.
3. If it takes `--yes` or `--dry-run`, list them in its `flags`. That's the only place it's said: `--help` and the
   argument checks read it from there. If it takes an extra word, like add-app's app name, describe it in `usage`.
4. Add `test/<name>.test.mjs`. Copy `test/setup.test.mjs`.
5. Add a section for it to the [user guide](user-guide.md), and add it to the menu sample there.

---

## Why the safety guards exist

A short-lived tool like this one "leaks" by **not ending**. Something forgotten keeps it alive, such as a timer, an
open question, a running program or a listener, and it looks frozen for no reason. Each guard below closes one way
that can happen, or one way a file could be damaged. Please don't remove one as pointless.

| Guard | Where | What it prevents |
|---|---|---|
| Every question listens to the run's "stop now" signal | `lib/ask.mjs` | Ctrl+C leaving a question waiting forever |
| Esc stops a typed question, as it stops a list | `lib/ask.mjs` | Esc doing nothing at "Go ahead?" right after it stopped the list above it |
| The keyboard reader's own Ctrl+C is passed on | `lib/ask.mjs` | In a real terminal, Node's keyboard reader (readline) catches Ctrl+C itself, so the tool would never hear it |
| Closing the input counts as stopping | `lib/ask.mjs` | Ctrl+D, or the end of piped input, leaving a question with no way to be answered |
| The keyboard reader is only created for the first question | `lib/ask.mjs` | `doctor` and `--yes` runs holding the keyboard open, which keeps the process alive |
| No terminal, but a question to ask → exit 2 at once | `lib/ask.mjs` | Waiting forever in an automated run, where no person can answer |
| A pick list passes Ctrl+C on as a stop | `lib/ask.mjs` | In raw mode, explained under this table, Ctrl+C arrives as a key. The tool's own Ctrl+C handler would never hear it |
| Raw mode is switched off however a list ends, `close()` included | `lib/ask.mjs` | A terminal left sending single keys after the tool exits: typing shows nothing, and Enter does nothing |
| A list's lines are cut to the terminal's width | `lib/picker.mjs` | A wrapped line taking two rows, so each redraw leaves part of the old list behind |
| Programs it starts get no keyboard, a time limit, and the stop signal | `lib/exec.mjs` | git waiting for a password nobody will type, or running forever |
| `GIT_TERMINAL_PROMPT=0` | `lib/git.mjs` | The same, from inside git: it fails at once instead of asking for a password |
| git runs in English (`LC_ALL=C`) | `lib/git.mjs` | git's "not a git repository" message being in another language, and so not recognised |
| Output from a program is capped at 1 MB | `lib/exec.mjs` | A runaway program filling the memory |
| Writes go through a temporary file and a rename | `lib/files.mjs` | A half-written file after Ctrl+C or a crash |
| The temporary file is deleted if a write fails | `lib/files.mjs` | A stray `.claude-rules-tmp` file showing up in `git status` |
| Writes are locked during `check()` | `lib/files.mjs` | A check changing something before you said "Go ahead" |
| Backups inside an app go in `.git/claude-rules-backups/` | `commands/add-app-steps.mjs` | A copy of your notes showing up in `git status`, and being committed by `git add .` |
| The progress timer never keeps the process alive, and is always stopped | `lib/ui.mjs` | A progress line's timer keeping a finished process running |
| The progress line is cut to the terminal's width | `lib/ui.mjs` | A long step title wrapping, so each redraw adds a line instead of replacing one |
| A second Ctrl+C leaves at once | `run.mjs` | Being unable to leave if the first stop is slow to finish |
| A half-second timer after the recap ends the process | `run.mjs` | Anything we didn't foresee keeping the process alive. It never delays a normal exit |
| Last-resort handlers for unexpected errors | `run.mjs` | A bug printing a raw technical dump instead of a message |
| The Node version is checked before anything else loads | `main.mjs` | An old Node failing on newer code, with an error nobody can read |

The menu, the app list and the stack rules are pick lists, moved through with arrow keys. Arrow keys need the
terminal in "raw mode", which sends every key press straight to the program. That mode is where "Ctrl+C doesn't work"
and "my terminal is broken after it exited" bugs come from, so the three guards above handle both. Where the terminal
refuses raw mode, or the input is a pipe, the list prints numbers to type instead. The tests in `test/cli.test.mjs`
answer the lists that way.

---

## Tests and checks

`npm test`, run from the repo's top folder, runs every `test/*.test.mjs` with Node's built-in test runner.

- **The sandbox.** Every test that touches the disk gets its own throwaway projects folder, a copy of this repo's
  rules, a fake home folder, and an empty global git config (via `GIT_CONFIG_GLOBAL`). No test can read or change
  your real setup.
- **Fakes.** Commands take a `Context` (see `lib/contract.mjs`). Tests pass a scripted question-asker and a UI that
  records what would be printed (both in `test/helpers.mjs`), plus the real file and git code.
  - Each scripted answer names part of its question, e.g. `{ "Go ahead?": true }`.
  - The scripted asker fails the test if a question comes up that isn't expected, in that order.
  - It also fails the test if a scripted answer is never asked for, so a removed question can't leave a stale
    answer behind.
  - Tests of `--yes` use the real asker in `--yes` mode, so they see what `--yes` really picks.
- **Whole-program tests** (`test/cli.test.mjs`) start a sandbox copy of `main.mjs`. They check exit codes, Ctrl+C, and
  that the program always ends. They set `CLAUDE_RULES_ASSUME_TERMINAL=1` so questions can be answered through a
  pipe. That setting is for tests only. Without a terminal, use `--yes`.
- **Links in the docs** (`test/docs-links.test.mjs`): every relative link in a tracked `.md` file reaches its file,
  and its `#heading` part reaches a heading there.
- **Structure tests** (`test/layers.test.mjs`) check the layer rules, that every file starts with `// @ts-check` and a
  header comment, and that every shared name has a doc comment.
- **Types.** `npm run check` runs `tsc` over every file in `cli/`, and over the scripts skills run, in
  `skills/<skill>/scripts/`. Their tests are in `cli/test/` too. `tsconfig.json` sets strict checking. So a type in a
  doc comment that doesn't match the code fails the check, not only a squiggle in the editor.

- **Lint.** `npm run check` runs eslint first. The house rules are in `eslint.config.mjs`, each with its reason. They
  cover the layout too, so eslint is the only formatter: `npm run format` fixes what it can.

- **Changelog.** `npm run check` ends with `scripts/changelog.mjs`, which checks each entry file in `changelog/`.
  How to add one is in [`changelog/README.md`](../../changelog/README.md).

GitHub runs `npm run check` on every pull request and every push to `main`: see `.github/workflows/check.yml`.

Before calling a change ready, review it with [review.md](review.md): the calls no check can make.
