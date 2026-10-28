---
name: task-investigate
description: This skill should be used when the user asks to "investigate" a task, asks "how does X work", or at the start of a non-trivial coding task. Reads the code behind the task before planning and writes findings.md. To check a change already made, use task-review.
---

# Investigate

Find out how the code actually works today, and stop there. **The output is a description:** the plan, the code
and any solution come later, in `task-plan`.

Task file: the path the user gave, or `task.md` in the task folder, as the common rules define it.

---

## Step 1 — Orient

Do the reading under *Start of every task* in the common rules, then read the task file. Treat earlier work in the task
folder as input, not something to redo. If the task file is missing or unreadable, stop and ask. Don't guess what it
says.

Print the three lines at the start, plus three:

```
Commit:   <git rev-parse --short HEAD>, branch, clean or dirty
Recent:   <git log --oneline -20 -- the area this task touches>
Existing: <what's already in the task folder and docs/ai/>
```

Then open `progress.md` next to the task file. Look at the last section whose heading starts with `## Investigate`.
If it has unticked boxes, finish this step, then resume at the first unticked box. Otherwise add
`## Investigate — <date>` with one `- [ ]` per step of this skill, named without its number. After each step, tick
its box and write one line under it: what was read or run, and what it showed. During Read the code, add a line per
function while tracing it.

## Step 2 — Check if this was solved before

Search every past `findings.md` in the projects folder, across every app: `investigations/*/*/findings.md`. Look for the
files, function names, and error messages involved.

Someone already traced this code, probably an earlier session months ago. If there's a match, reuse it, but re-check
its references still point at real code. If nothing matches, say so.

**Do this before opening any source file.** It's the cheapest step here and the easiest one to skip.

## Step 3 — Read the code

For each function or component central to the task, find out:

- **Where it's defined**, and what the body actually does
- **What it really returns** — including on errors, on empty input, and on the second call
- **What it changes** — state it mutates, requests it sends, things it writes
- **Every place it's called.** Grep for it. List them all. If there are more than ten, group them and give a count.
- **Which tests cover it**, and what those tests actually check

Then trace the whole path, one step at a time:

```
button click → useLogin() → apiClient.post() → response handling → state update
src/ui/LoginForm.tsx:22 → src/auth/useLogin.ts:34 → ...
```

**On subagents:** give each one a narrow reading job ("read this file, report what it returns and who calls it,
with line numbers"). Never give one a judgment call.

## Step 4 — Write down every question

Work through [`../shared/open-questions.md`](../shared/open-questions.md): write down every question on its list,
then sort each one as a BLOCKER, an ASSUMPTION or a PROBE. Run the read-only probes, and record what each one
showed.

## Step 5 — Write findings.md

Save it next to the task file. **If it already exists, update it** — revise what changed, mark what's now wrong.

```
## Orientation      rules, skills, commit, what was read
## Past work        what earlier investigations already covered
## Map              the call path, with file paths and line numbers
## What the code does    function | where | what it actually does | quoted line
## What could break  everywhere it's called; which tests would fail
## How tests work    framework, how to run one test, where fixtures live — with real examples
## Open questions    blockers, assumptions, probes and their results
## Files read        every file opened; files skipped, and why
```

## Step 6 — Report back

In chat, give only:

1. One paragraph on how it works today.
2. The blockers, numbered, asked the way the common rules say to ask.
3. Any probe that needs approval first.

Then stop and wait.
