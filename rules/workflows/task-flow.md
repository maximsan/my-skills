# How a task runs: task folders and skills

The workflow for a machine that works from task folders. It adds to the common rules, and wins where they differ.

## Start of every task

Before any work, print these three lines. A skill may add more.

```
Skills:  <picked, and why> | <rejected, and why>
Rules:   <which ones apply here, and what they change>
Context: <files you read>
```

Pick skills from the list yourself. Name the ones you rejected, to show you looked.

**The projects folder** holds `prompts` and the apps. The agent starts there or inside one app. It has two shared
folders:

- `investigations/<app>/<TICKET>/`, **the task folder**: every task file goes here, never inside the app.
- `docs/`: notes shared across the apps.

Before acting, read in the app you work in:

- `CLAUDE.md` and `CLAUDE.local.md`
- `docs/ai/NOTES.md`
- `docs/ai/CONTEXT.md` and `docs/ai/GLOSSARY.md`
- the task folder
- the projects folder's `docs/`, if the task spans several apps

**Started in the projects folder,** name the app first: from the task folder, or ask me. Then read its
`CLAUDE.local.md` yourself: Claude Code loads it only after a file in the app is opened.

**A new app: if its `CLAUDE.local.md` still has `<placeholder>` gaps, fill them from the repo before your first
edit:**

- Commands: from `package.json` and the test setup. Run each once. Write "none" if there's none.
- Where things are: from the folder layout.
- Things people get wrong here: "none yet", unless you found one.

If `docs/ai/NOTES.md` has no Exemplars table, propose one: for each kind of file, the one file you'd copy. Show me
the result and wait for my approval before that first edit.

Coding work runs `task-investigate → task-plan → [I approve] → task-implement → task-review → [I sort the findings] →
task-learn`. Skip `task-investigate` for small changes and `task-review` for trivial diffs. Always run `task-learn`:
"nothing to save" is a fine result.

## Keep state in files, not in the chat

- Write what's worth keeping into a file: `progress.md` while working, `debug.md` while debugging, `docs/ai/` for
  lasting facts.
- Before answering a follow-up, re-read that file. Add what you just found before you reply.

**When you change direction, write this checkpoint first:** after a hypothesis is ruled out, an approach dropped, or I
send you elsewhere. Fill every line; `none` is fine.

```
↪ Pivot: <from> → <to>, because <evidence: file:line or output>
  Still true: <what's established and survives>   Now wrong: <what the old direction produced>
  Start from: <the first step in the new direction>
```

- If what's now wrong is work already built, load `rework` before touching anything.
- Otherwise, delete what `Now wrong:` lists right away, then continue from `Start from:`.

## Skills to load

- Before deleting or rewriting code or a comment that predates the task, load `why-this-exists`.
- Fix a bug only after a failing test reproduces it: load `failing-test-first`. Show me the failing, then passing,
  output.
- After two failed fixes, when I ask you to debug, or when you can't explain a case, load `debug` and fix the cause.
- When no existing file fits, load `create`.

## Out-of-scope things you notice

Put them in a `Backlog` list.

## Suggest new rules and skills

When I correct the same thing twice, you look up the same fact twice, or a task repeats an earlier one, add a
suggestion with the evidence under `## Proposed rules` in `docs/ai/FEEDBACK.md`. Don't create it yourself. Before
writing any rule or skill, load `rule-author`.
