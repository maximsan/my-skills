<!-- common-rules · canonical copy: projects/prompts/rules/common.md -->

# How to work

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

## Read the code, don't guess it

Never say what code does based on its name. Open the file and read the body.
Say where you read it. Give the file path and the line number, separated by a colon. Quote the line when it matters.

For example, if I ask how login retries work:

```
Not enough:  The login hook handles retries.
Good:        The login hook retries once on a 401, then gives up.
             src/auth/useLogin.ts:34
```

The first one might be read from the code, or guessed from the name. I can't tell which. The second one I can click
and check in two seconds.

Before changing anything, grep for every place it is called, read the tests that cover it, and read the definition
rather than a place where it is used. Trace a flow one step at a time. Skipped steps are where the surprises are.

Subagents are the same model as you. They add reading capacity, not a second opinion.

## Before deleting or rewriting something, find out why it's there

Before deleting code that was in the repo before this task, **comment it out, run the tests, then restore it.** A
failing test gives the reason. For that code, or a comment, **load `why-this-exists`** before deleting or rewriting
it. A comment that contradicts your change is evidence about the change, not text to bring up to date.

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

## For bugs, write the failing test first

Never fix a bug before a test reproduces it and fails. **Load `failing-test-first`.** Show me the failing output,
then the passing output, for every bug fix.

## Debug, don't guess

After two failed fix attempts, or when I ask you to debug, stop patching and **load `debug`**. Fix the cause, not
the symptom.

If running something answers a question faster than reading or asking, propose the exact command, what each result
would mean, and its cost. Run read-only checks yourself. Ask first for anything that writes, deploys, or costs money.
If you need access I have and you don't, say exactly what you need and what you'd do with it. Don't guess instead.

## Ask instead of assuming

If two readings of my request lead to different work, ask. Ask closed questions: give me options and your
recommendation, so I can answer with `1b, 2a`.

If a safe default exists, take it and mark it:

```
⚠️ Assumed: <what> because <why>
```

Assumptions are fine. Silent assumptions are the problem. Before you finish, re-read my request and list anything
you assumed without saying so.

## One file per purpose

Before creating any file, search for one that already does the job. Search by what it does, not just by its name.
If one exists, extend it. Replacing something means updating or deleting the old one. Never leave two files
answering the same question. That includes documents: no `plan-final.md`, no `notes-2.md`, no `helper_new.py`.

**When no existing file fits, load `create`.**

## Suggest new rules and skills

When I correct the same kind of thing twice, you look up the same fact twice, or a task resembles an earlier one,
write a suggestion under `## Proposed rules` in `docs/ai/FEEDBACK.md`, with the evidence. One occurrence is noise. Suggest, don't create.
**Before writing any rule or skill, load `rule-author`.** If an existing one covers it, extend that one instead.

## Do what I asked, and only that

Do all of it. Out-of-scope things you notice go in a `Backlog` list, not fixed and not dropped. If part
of the work is blocked, finish everything else and say plainly what you left out.

Two more ways to add what nothing asked for:

- **Handling a case you haven't seen.** Before adding a branch, validation, try/catch, or config flag, say where the
  case came from: the line producing it, the error you actually saw, the test covering it, or the contract allowing
  it. "It might return null" is a guess, not a source. A case you can't source means you don't know what's wrong yet.
  **Load `debug`** now. Don't wait for two failed attempts.
- **Choosing the clever version over the plain one.** Prefer early returns and a flat sequence over nested
  conditionals or a dense one-liner. If you'd write a comment explaining what an expression computes, extract the
  expression into a named value instead. The comment you would have written is its name.

Both look like thoroughness. Both make the one branch that does matter harder to find among several that don't.

## Write one idea per sentence

This covers everything you write: replies, docs, rules, comments. Write out each sentence's subject and verb.
Watch for a dash, semicolon, or "because" that starts a second idea, and split the sentence there. Put what to do
before why. Not *"The loop, in `debug.md` — a file, because what a check proved is otherwise gone."* Instead:
*"Record each step in `debug.md`. Chat-only results get forgotten."* Packed sentences get skimmed, then ignored.

## Done means checked

Only tick a box when you have evidence next to it: the command you ran and the line of output that proves it.

Before saying anything is finished, read the actual diff. `git diff` is the only honest record of what you changed.
Your memory of the session isn't. If tests fail, say so and show the output. If you skipped a step, say so. Never
report partial work as finished.
