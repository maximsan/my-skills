# Glossary

The terms the rules, the skills, the `claude-rules` tool and these docs use in their own sense, in plain words. Terms
are grouped by where you'll meet them. General terms, such as git, npm or PowerShell, are left to their own docs.
What the tool's output means is in the [user guide](cli/user-guide.md#how-every-command-works).

Jump to:
- [Rules and skills](#rules-and-skills)
- [This setup's files and folders](#this-setups-files-and-folders)
- [Claude Code](#claude-code)
- [Git](#git)
- [Windows](#windows)
- [The tool's own words](#the-tools-own-words)

---

## Rules and skills

**file path and line number** — e.g. `src/auth/useLogin.ts:34`. Points at one exact line in one exact file. Claude
has to give one whenever it says something about your code, so you can click and check instead of taking its word.

**made-up example names** — `useLogin`, `ORD-123`, `my-app`, `src/auth/`. Placeholders, like `foo` in a tutorial.
Replace them with your real names. They're not real things you're supposed to recognize.

**"done when"** — how you'll know a step is finished, written so it can actually be checked. "Done when the endpoint
returns 201 with an order id" — not "done when the endpoint works".

**probe** — running something small to answer a question, instead of guessing or asking. One log line, one query,
one test. Always comes with what each possible result would mean.

**pivot checkpoint** — the three lines Claude writes whenever it changes direction: `↪ Pivot:` from what to what and
why, then what's still true, what's now wrong, and where it starts from. So a change of approach is a written decision
with a restart point, not a drift you notice an hour later.

**ledger** — `debug.md` in the task folder, kept by the `debug` skill. The symptom, each suspected cause and whether
it's ruled out, and each check with the few log lines that decided it. Claude re-reads it before every reply while
debugging, which is what stops it forgetting what it found two questions ago.

**debug tag** — a marker like `[DBG C3]` at the start of every temporary log line. It makes the output filterable
with one grep, and proves the logging is all gone afterwards with another.

**scratch folder** — `investigations\<app>\<TICKET>\scratch\`, in the projects folder. Where throwaway and
experimental work goes. It's outside every repo, so abandoned experiments can't end up in your commits by accident.

**model file** — the existing file a new one is copied from. Named before any code gets written, so "match the local
style" becomes something you can check rather than something Claude can claim.

**skill** — instructions for one kind of task, saved as a file in `prompts\skills\`. You can type `/debug` to use
it, or Claude can pick it itself based on its description.

**trigger phrase** — a quoted phrase in a skill's description that tells Claude when to load the skill, e.g.
"fix this bug" in `failing-test-first`. One phrase per case the skill covers.

**shared skill file** — a file in `prompts\skills\shared\` that two or more skills read, e.g. `leftovers.md`. No skill
owns it.

**task skill** — one of the skills a task goes through in order: `task-investigate`, `task-plan`, `task-implement`,
`task-review`, `task-learn`.
_Avoid_: stage, which means one of the six stages every setup-tool command goes through (see **the six stages**,
under [The tool's own words](#the-tools-own-words)).

**rule** — an instruction that applies to every task, kept in `CLAUDE.md`, `CLAUDE.local.md` or a file they import.
The difference from a skill: a rule is always loaded, a skill only loads when it's relevant.

**bug-fix reminder** — a line Claude Code adds to Claude's context when your message mentions a bug, telling it to
load `failing-test-first`. A hook in your personal Claude Code settings, added by `setup`; it works in the projects
folder and in your apps, but not in `prompts`.

**frontmatter** — the block at the very top of a skill file between two `---` lines. Holds the skill's name and the
description that decides when it loads.

**the three lines at the start** — `Skills:` / `Rules:` / `Context:`, which Claude prints before doing any work.
They're a floor, not a fixed set: some skills ask for more lines, never fewer. They're there because a step you have
to report is a step you actually do.

---

## This setup's files and folders

**projects folder** — The folder that holds all your apps, e.g. `C:\Users\me\projects`. This repo must sit inside it, as
`projects\prompts`. The tool always treats the folder this repo is in as the projects folder.

**this repo, `prompts`** — The repository holding the shared rules, the skills and this tool. There's one copy of each
rule and skill, here. Every app points at it.

**app** — One of your work projects inside the projects folder, e.g. `projects\web-shop`. Each app is its own git
repository.

**`projects\CLAUDE.md`, the shared rules file** — A file in the projects folder, above every app. Claude reads it
whenever you work in any app below it. The tool puts one line in it: an `@` import of this repo's common rules. It sits
outside every repository, so it can't be committed by accident. Two other places a `CLAUDE.md` can live: inside one
app, where it applies only there, or in your home folder at `%USERPROFILE%\.claude\`, where it applies to every repo
on the machine, including ones outside `projects\`.

**common rules** — `prompts\rules\common.md`. How Claude should work on every task, in every app: read the code
before describing it, ask before assuming, and so on.

**stack rules** — Files in `prompts\rules\` next to the common rules, one per technology: `react.md`,
`typescript.md`, `microfrontend.md`. They only matter for apps that use that technology, so each app loads only the
ones it needs.

**skill links** — `<app>\.claude\skills\<name>`, one for each skill in each app, e.g. `.claude\skills\debug`. Each
is a junction (see [Windows](#windows)) to that skill's folder in `prompts\skills`, so every app uses the same single
copy. `prompts\skills\shared` gets a link too, because skills read their shared files through `..\shared\`. Each
link is listed in the app's `.git\info\exclude`, so git never commits it. A skill the app has of its own, with the
same name, is left alone. They're for Claude started inside the app. For Claude started in the projects folder,
`setup` links the whole skills folder once, at `projects\.claude\skills`.

**personal lint config** — Your own eslint rules, kept in `prompts`. They're run against an app's code, but never
added to the app, and never shared with the team.

**the team's `CLAUDE.md`** — An app's own `CLAUDE.md`, if the project has one. It usually belongs to the team, and is
committed. The tool never changes it.

**`CLAUDE.local.md`, your notes** — Your personal notes about one app, in the app's top folder, next to the team's
`CLAUDE.md`. Claude reads both, this one second. It holds the app's facts: build and test commands, the folder layout,
the traps. It also holds the `@` lines for the stack rules this app needs. Git never commits it, because the tool lists
it in `.git\info\exclude`.

**template, `CLAUDE.local.md.template`** — The starting text for every `CLAUDE.local.md`, in `prompts\templates\`.
The tool copies it and fills in what it can find.

**placeholder** — A gap in the template, written in angle brackets, like `<build>` or `<folder>`. The tool fills some
from the app's `package.json`. Claude fills the rest from the repo on its first task in the app, and asks you to
check them.

**marker line** — The first line of every notes file the tool writes: `<!-- claude-rules: app-notes -->`. It lets the
tool recognise its own files. Claude ignores it, because it's an HTML comment.

**`docs\ai\`** — A folder in each app for lasting notes that Claude builds up over time, mostly in `NOTES.md`. It's kept
out of git, like your notes.

**`NOTES.md` and Exemplars** — `docs\ai\NOTES.md` holds notes that stop the next session going wrong. Its first table,
**Exemplars**, says which existing file to copy for each kind of new file: "for a new component, copy
`src/components/EmptyState.tsx`". The `create` skill reads it first.

**`investigations\`** — A folder in the projects folder, with one sub-folder per app and one per ticket inside it, e.g.
`investigations\web-shop\ORD-123\`. It holds the task, the plan and the findings. It's outside every repo.

**task folder** — `investigations\<app>\<TICKET>\` in the projects folder, one per ticket. It holds `task.md`,
`findings.md`, `plan.md`, `progress.md`, `debug.md`, `review.md` and `scratch\`. Every skill writes its task files
here, never inside the app.

**`.git\claude-rules-backups\`** — Where the tool puts a copy of a file before it changes it, when that file is inside
an app. It sits in the hidden `.git` folder, so the backup can never be committed. Each backup's name ends with the date
and time it was made, e.g. `CLAUDE.local.md.2026-09-25T21-32-19-382Z.bak` (the date, then the time down to the
thousandth of a second, in UTC), so a backup never replaces an earlier one.

**`.bak` file** — A backup copy, made before a file is changed. Outside a git repo (for `projects\CLAUDE.md`, for
example), it sits next to the file: `CLAUDE.md.bak`.

**temporary file, `.claude-rules-tmp`** — When the tool writes a file, it writes the new text to a temporary file first,
then swaps it in by renaming it. The real file is always either the old version or the new one, never half written. If
anything fails, the temporary file is deleted.

---

## Claude Code

**`@` import** — A line in a rules file that starts with `@`, followed by a file's path, e.g.
`@C:/Users/me/projects/prompts/rules/react.md`. It tells Claude to read that file too. This is how one copy of the
rules can be used by every app. The tool always writes these with forward slashes (`/`), which Claude understands on
Windows too.

**import approval question** — The first time you start Claude in an app, Claude asks whether to allow `@` imports that
point outside that app's folder. Ours all do, since they point into `prompts`. Choose **Yes**. If you choose No, Claude
doesn't read the rules in that app, and nothing tells you.

**hook** — A command Claude Code runs on its own at a set moment, such as after every file edit. It costs no context
unless a check fails.

**`.claude.json`** — Claude Code's own settings file, at `%USERPROFILE%\.claude.json`. Among other things, it remembers
your answer to the import approval question for each folder.

**`AGENTS.md`** — A rules file some other AI coding tools use. Claude Code only reads it when there's no `CLAUDE.md` in
the folder or any folder above it. With this setup there always is one above (`projects\CLAUDE.md`), so Claude won't
read an app's `AGENTS.md`. The tool says so when it finds one, and leaves it alone.

---

## Git

**`.git\info\exclude`, the private ignore file** — A second ignore list, inside the `.git` folder. It works exactly like
`.gitignore`, but it isn't committed, so it only applies to your copy of the repo. `add-app` adds its lines here,
under a comment saying what they're for: `CLAUDE.local.md`, `docs/ai/` and each skill link. That's why `git status`
doesn't show your notes.

**global git config, global ignore file** — Settings that apply to every repository on your computer. They live in your
home folder. The global ignore file is one of them, set with `core.excludesFile`. The tool never changes either. The old
manual setup used them, and `doctor` points out what it left behind.

**`core.excludesFile`** — The global git setting that names the global ignore file. The old manual setup set it and put
`CLAUDE.md` in that file. That hid every committed `CLAUDE.md` from you, in every repo.

**un-ignore rule, `!name`** — A line in an ignore file that starts with `!`, like `!CLAUDE.local.md`. It means "don't
ignore this after all", and it wins over an earlier ignore line. If a team's `.gitignore` has one for your notes,
`add-app` stops and says so.

**worktree** — A second working folder for the same repository, sharing one history. The tool handles them: its lines go
in the private ignore file that every worktree of that repo shares.

---

## Windows

**Managed Windows environment** — A Windows computer configured by an organization. Its policies and available
tools can differ from those on a personal computer.

**Windows PowerShell 5.1** — The PowerShell version that comes with Windows. It behaves differently from newer versions
in a few places. For example, `Remove-Item` on a junction can delete what's inside the real folder.

**`Remove-Item`** — PowerShell's delete command. Don't use it on a skill link: see `cmd /c rmdir`.

**`cmd /c rmdir "<folder>"`** — Runs one command of the older Windows command language (`cmd`). `rmdir` on a junction
removes only the link, never what it points to. That's the safe way to remove a skill link.

**junction** — A Windows shortcut that makes one folder appear inside another. Each skill link is one. Deleting the
junction the right way leaves the real folder untouched. Unlike other kinds of link, creating one needs no administrator
rights. It's created with `mklink /J`.

**path with a space** — A folder path containing a space, e.g. `C:\Users\First Last\projects`. It isn't yet known
whether Claude loads `@` imports from such a path, so the tool warns when it finds one.

---

## The tool's own words

**`claude-rules`** — This tool. It sets up the rules and skills on your computer and in each app, and checks both.

**command** — One job the tool does: `setup`, `add-app`, `new-task` or `doctor`. Type `claude-rules` followed by the command's name.

**`setup`** — The command you run once per computer. What it does: [user guide](cli/user-guide.md#setup-once-per-computer).

**`add-app`** — The command you run once per app. What it does: [user guide](cli/user-guide.md#add-app-once-per-app).

**`doctor`** — The command that checks what `setup` and `add-app` did, and changes nothing. What it checks:
[user guide](cli/user-guide.md#doctor-check-everything).

**menu** — What you get when you type `claude-rules` with no command: a list of the commands, picked with the arrow
keys and Enter. The status line at the top says where you are, and the list opens on the suggested next command.

**pick list** — A question answered by moving through a list with the arrow keys, such as the menu or "Stack rules:".
Where the terminal can't send single key presses, it prints numbers to type instead.

**follow-up** — After `setup` finishes, the tool offers to go straight on to `add-app`.

**stack, detection** — A stack is a technology an app uses, such as React. Detection is the tool working out the stacks
from the app's files: "React — react in package.json".

**step** (setup tool) — One piece of work in a command, like "Keep your notes out of git". Each step first checks whether
it's needed, then does the work if you agree. Not a step of a task's `plan.md`.

**check** — The part of a step that only looks. It never changes anything, and the tool enforces that.

**the six stages** — The order every command follows:

1. what it does and may change
2. looking around
3. questions
4. the plan
5. "Go ahead?", then the work
6. the recap

**Looking around** — The second stage: what the tool found, before asking anything.

**finding** — One line under "Looking around", e.g. `✔ It's a git repository`.

**plan** (setup tool) — The fourth stage. It shows each step, and what it will do, or `already done`, `skipped` or
`can't do`. Not the task's `plan.md`, which `task-plan` writes.

**recap** — The last stage. Each step's line already said how it went, so the recap lists only the steps that still
need you, then a count like "All 2 done" or "1 done, 1 failed", then one `Next:` line.

**Next:** — The single most useful thing to do after this command. After a failure it's replaced by "Fix the ✖ lines
above, then run the same command again."

**"Nothing is half-written"** — Every file is written to a temporary file first, then swapped in, so it's always the old
version or the new one. That's why it's safe to stop with Ctrl+C, and to run the same command again.
