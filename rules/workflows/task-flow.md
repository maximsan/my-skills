# How a task runs: task folders and skills

The workflow for a machine that works from task folders. It adds to the common rules, and wins where they differ.

## Start of every task

Print at least these three lines first, before any work. A skill may ask for more lines — never fewer:

```
Skills:  <picked, and why> | <rejected, and why>
Rules:   <which ones apply here, and what they change>
Context: <files you read>
```

Scan the skill list yourself. Don't wait to be told which one to use. Naming the ones you rejected proves you
actually looked.

**The projects folder** holds `prompts` and the apps. Claude starts either there or inside one app, where the
projects folder is `../`. It holds two shared folders:

- `investigations/<app>/<TICKET>/`: **the task folder**, one per ticket, under the app the ticket is about. Every
  task file goes there, never inside the app.
- `docs/`: the book of knowledge shared across the apps.

Read these before acting. Paths without a folder are relative to the app you're working in:

- this app's `CLAUDE.md` and `CLAUDE.local.md`, whichever exist
- `docs/ai/NOTES.md`: the Exemplars table, and the notes whose heading matches what you're about to do
- `docs/ai/CONTEXT.md` and `docs/ai/GLOSSARY.md`, if they exist
- the projects folder's `docs/`, when the task spans more than one app
- the task folder, if one exists

**Started in the projects folder, name the app before reading:** the task folder's `<app>`, or ask me. Then read
that app's `CLAUDE.local.md` yourself. Claude Code loads it only once a file in the app is opened. Without the app,
`docs/ai/` ends up outside every app.

**Before your first edit in an app, fill in any `<placeholder>` left in its `CLAUDE.local.md`.** Work each one out
from the repo:

- Commands: from `package.json` and the test setup. Run each once to check it works. Write "none" where there's none.
- Where things are: from the folder layout.
- Things people get wrong here: "none yet", unless you found one, such as a test marked as skipped.

If `docs/ai/NOTES.md` has no Exemplars table, propose one too: for each kind of file the app has, such as a
component, a hook, a store, a test and a story, the one file you'd copy, picked the way `create` picks.

Show me what you wrote, and wait for my approval before that first edit. Reading and investigating go on meanwhile.
Skip this in `prompts`, the repo these rules live in: it isn't an app.

Normal order for coding work: `task-investigate → task-plan → [I approve] → task-implement → task-review`, then I
triage each finding (fix now → back to `task-implement` / backlog / won't fix), then `task-learn`.
Skip `task-investigate` for small changes. Skip `task-review` for trivial diffs. Never skip `task-learn`, but
"nothing to save" is a valid result from it.

## Keep state in files, not in the chat

Anything worth knowing after this chat goes in a file: `progress.md` while working, `debug.md` while debugging,
`docs/ai/` for lasting facts. **Before answering a follow-up, re-read that file. Write what you just found into it
before you reply.**

**When you change direction, write a checkpoint before the first action in the new direction.** Changing direction
means a hypothesis ruled out, an approach dropped, or a follow-up of mine sending you elsewhere. Fill every line.
`none` is a valid answer.

```
↪ Pivot: <from> → <to>, because <evidence: file:line or output>
  Still true: <what's established and survives>   Now wrong: <what the old direction produced>
  Start from: <the first step in the new direction>
```

**If what's now wrong is work already built, load `rework`** before touching anything. That covers a moved
requirement, and an approach that failed after steps were ticked.

Otherwise, delete what `Now wrong:` lists straight away, while you still remember it. Leftovers from a failed first
attempt are the most common way this work goes wrong. Then resume from `Start from:`, not from memory.

## Skills to load

- For code that was in the repo before this task, or a comment, **load `why-this-exists`** before deleting or rewriting
  it.
- Never fix a bug before a test reproduces it and fails. **Load `failing-test-first`.** Show me the failing output,
  then the passing output, for every bug fix.
- After two failed fix attempts, or when I ask you to debug, stop patching and **load `debug`**. Fix the cause, not
  the symptom.
- A case you can't source means you don't know what's wrong yet. **Load `debug`** now. Don't wait for two failed
  attempts.
- **When no existing file fits, load `create`.**

## Defaults and assumptions

If a safe default exists, take it and mark it:

```
⚠️ Assumed: <what> because <why>
```

Assumptions are fine. Silent assumptions are the problem. Before you finish, re-read my request and list anything
you assumed without saying so.

## Out-of-scope things you notice

Out-of-scope things you notice go in a `Backlog` list, not fixed and not dropped.

## Suggest new rules and skills

When I correct the same kind of thing twice, you look up the same fact twice, or a task resembles an earlier one,
write a suggestion under `## Proposed rules` in `docs/ai/FEEDBACK.md`, with the evidence. One occurrence is noise. Suggest, don't create.
**Before writing any rule or skill, load `rule-author`.** If an existing one covers it, extend that one instead.
