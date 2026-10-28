# Using `claude-rules`

`claude-rules` sets up the shared Claude rules and skills from this repo, and starts your tasks:
- **once per computer** (`setup`): makes the shared rules and the skills available in the projects folder
- **once per app** (`add-app`): creates your notes file for that app, links the skills into it, and keeps both out of
  the team's git
- **once per ticket** (`new-task`): creates the ticket's folder and its `task.md`

A fourth command, `doctor`, checks all of it, and changes nothing.

It always tells you what it's going to change, and asks before changing anything. Any word here you don't know is in
the [glossary](../GLOSSARY.md).

Contents:
- [Installing](#installing)
- [The menu](#the-menu)
- [`setup`: once per computer](#setup-once-per-computer)
- [`add-app`: once per app](#add-app-once-per-app)
- [`new-task`: once per ticket](#new-task-once-per-ticket)
- [`doctor`: check everything](#doctor-check-everything)
- [How every command works](#how-every-command-works)
- [Flags](#flags)
- [Stopping, and running again](#stopping-and-running-again)
- [What the tool never does](#what-the-tool-never-does)

---

## Installing

- [Getting started](../SETUP.md) covers installing and updating the tool.
- [When something doesn't work](../TROUBLESHOOTING.md) covers what each error message means, and removing the
  tool.

This guide covers using the tool once it's installed.

---

## The menu

Type `claude-rules` with nothing after it:

```
Claude rules & skills — setup
Status: this computer is not set up yet.

What next?
  Up/Down move  Enter choose  Esc stop
> Set up this computer     Do this first, once. Links the rules and skills into your projects
                           folder, and adds the bug-fix reminder to your Claude settings. Doesn't
                           touch any repo or your git settings.
  Add an app
  Start a task
  Check everything works
  Help
  Quit
```

- Move with the Up and Down arrows, and press Enter.
- The list opens on the suggested next step, so Enter on its own takes it. Once an app is added, that's **Start a
  task**.
- The text beside the highlighted entry says what it does. In a narrow terminal, it goes under the list.
- **Help** shows the help and leaves, like `claude-rules --help`. **Quit** or Esc leaves too.

Some terminals can't send single key presses. There, the same list is printed with a number in front of each entry,
and `h` and `q` in front of Help and Quit. Type one and press Enter; Enter on its own takes the number in brackets.

Each menu entry runs a command you could type yourself:

- **Set up this computer** runs `claude-rules setup`.
- **Add an app** runs `claude-rules add-app`.
- **Start a task** runs `claude-rules new-task`.
- **Check everything works** runs `claude-rules doctor`.

---

## `setup`: once per computer

```powershell
claude-rules setup
```

**What it does:**
1. Adds one line to `projects\CLAUDE.md`, creating the file if needed. The line makes Claude read the shared rules
   in every app below it:

   ```
   @C:/Users/me/projects/prompts/rules/common.md
   ```

2. Creates the skills link, `projects\.claude\skills`. It's a shortcut to `projects\prompts\skills`, for Claude
   started in the projects folder. An app that is its own git repo never reads it, so `add-app` also links each skill
   into the app, for Claude started there.
3. Adds the **bug-fix reminder** to your personal Claude Code settings, `%USERPROFILE%\.claude\settings.json`.
   When a message you send mentions a bug, the reminder tells Claude to load `failing-test-first` and show the
   failing test before the fix. It only reminds, and never blocks. The words that trigger it are "bug", "bugs",
   "broken", "regression", "crash", "crashes", "doesn't work", "does not work" and "not working". It works when
   Claude starts in the projects folder or in an app, but not in `prompts`. You don't see the reminder in the chat;
   Claude does.

**What it may change:** only those three things. No repo, and none of your git settings.

**What it asks:**
- **"Your apps live in C:/Users/me/projects?"** This is a last check that the repo is in the right place. If you
  answer no, it stops and explains, and nothing is changed. Once setup has run, it isn't asked again.
- **"Replace it with a link to this repo's skills?"** This is only asked if a skills link already exists and points
  somewhere else. The default is no.
- **"Go ahead?"**, after showing the plan.
- **"Add an app now?"**, at the end, if everything worked and an app isn't added yet. After each app, `add-app`
  offers the next one.

**What it's careful about:**
- If `projects\CLAUDE.md` already has your own text, the line is added at the top and your text is kept. A copy of
  the old file is saved first, as `projects\CLAUDE.md.bak`.
- If `projects\.claude\skills` is a real folder with files in it, `setup` won't touch it, because it may hold your own
  skills. It tells you how to move them.

In `settings.json`, only the reminder's own entry is added, or updated if this repo moved. Your other settings and
hooks stay, and so do any fields you add to the reminder's own entry. A copy of the old file is saved first, as
`settings.json.bak`. If the file isn't valid JSON in the shape Claude Code uses, `setup` leaves it exactly as it is
and tells you.

**A normal run, shortened:**

```
Set up this computer
  May change: projects/CLAUDE.md, projects/.claude/skills, ~/.claude/settings.json. Nothing else.

Looking around
  ✔ Node 20.11.0 and git 2.44.0 found
  ✔ This repo is at ~/projects/prompts
  · Found 2 app folders next to it: admin, web-shop

Your apps live in ~/projects? [Y/n]

Plan
  1  Shared rules line in projects/CLAUDE.md — create it, with the line
  2  Link projects/.claude/skills → projects/prompts/skills — create the link
  3  Bug-fix reminder in ~/.claude/settings.json — add the reminder, which runs on each message, in the projects
     folder and your apps

Go ahead? [Y/n]

  ✔ Shared rules line in projects/CLAUDE.md — created
  ✔ Link projects/.claude/skills → projects/prompts/skills — linked (12 skills)
  ✔ Bug-fix reminder in ~/.claude/settings.json — created

All 3 done.

Next: add your first app: claude-rules add-app

Add an app now? [Y/n]
```

Paths in messages start from your home folder, `~`. On Windows that's `C:\Users\<you>`.

---

## `add-app`: once per app

```powershell
claude-rules add-app web-shop
```

**Which app:**
- The name after `add-app`, e.g. `web-shop`. Or a path, e.g. `add-app C:\Users\me\projects\web-shop`.
- With no name: the app whose folder you're in. If you're not in one, you pick it from a list. The list opens on the
  first app not added yet.

**What it does:**
1. Creates `docs\ai\` in the app. Task folders aren't per app: they go in the projects folder, in
   `investigations\<app>\<TICKET>\`.
2. Creates your notes file, `CLAUDE.local.md`, from the template. It fills in:
   - the app's name
   - the rule lines for the stacks it detects, e.g. React from `react` in `package.json`
   - the commands it finds in `package.json`, such as `npm run build` and `npm test`
3. Links each skill into the app, one link per skill: `.claude\skills\debug` points at `prompts\skills\debug`, and
   so on. `prompts\skills\shared` gets a link too, because skills read their shared files from there. There's still
   one copy of each skill, in `prompts\skills`.
4. Keeps all of these out of git: it adds them to the repo's private ignore file, `.git\info\exclude`.
5. Asks git to confirm they really are ignored.

**What it may change:** only the app's `CLAUDE.local.md`, `docs\ai\`, the skill links in
`.claude\skills\`, and `.git\info\exclude`. It may also save backups in `.git\claude-rules-backups\`.

It never changes:
- the team's `CLAUDE.md`
- the rest of `.claude\`, including the team's own skills
- `AGENTS.md`
- `.gitignore`
- any file git tracks

**What it asks:**
- **"Stack rules:"**, a list of every stack with the ones it detected already marked. The lines under the list say
  why a stack was detected. Space marks or unmarks the highlighted stack, `a` marks all or none, and Enter accepts.
  None is a valid answer. For an app that's already added, it isn't asked again: the app keeps the stacks in its
  `CLAUDE.local.md`. To change them, edit that file.
- **"Go ahead?"**, after showing the plan.
- **"Add another app? 9 left."**, at the end, while any app isn't added yet. Yes runs `add-app` again, and you pick
  the next app.

**Why your notes don't show in `git status`:** see
[How it works](../HOW-IT-WORKS.md#why-your-notes-dont-show-in-git-status).

**What's left in your notes:** at the end, `add-app` lists the parts of `CLAUDE.local.md` it couldn't fill in:

```
Still empty in CLAUDE.local.md. Claude fills these in on its first task in web-shop, then asks you to check:
  - Commands
  - Where things are (<folder>, <what's in it>)
  - Things people get wrong here
```

You don't write them yourself. On its first task in the app, Claude:
- works each one out from the repo, and runs each command once to check it;
- proposes the Exemplars: which existing file to copy for each kind of new file;
- shows you what it wrote, and waits for your approval before its first edit.

**The first time Claude starts in the app, choose Yes when it asks about imports.** Those imports are the rules.
`doctor` tells you if you chose No.

**Special cases it handles for you:**

| If the app… | `add-app`… |
|---|---|
| already has your `CLAUDE.local.md` | adds only the missing rule lines, and keeps everything you wrote. A backup goes to `.git\claude-rules-backups\` first. |
| has the team's `CLAUDE.md` with a Commands section | points your notes at it, instead of copying the commands |
| commits `docs\ai\` itself | treats that folder as the team's, and leaves it alone |
| has its own skill with the same name as one of ours | leaves the app's skill alone, and links the rest |
| has `.claude\skills` as one link to all the skills, from the manual setup | stops, and gives the command that removes only that link |
| has `.claude\skills` as a link of its own, to another folder | leaves it alone, and skips the skill links |
| has a skill link to an old `prompts` folder, or to a skill that's gone | stops, and gives the command that removes each such link |
| has `.claude` as a file or a link | stops, and asks you to make it a plain folder |
| has your skill links committed | stops, and gives the command that takes only those links out of the repo and leaves them on disk |
| has `AGENTS.md` | tells you Claude won't read it with this setup, and leaves it alone |
| isn't a git repo | does everything except the git steps, which it marks "skipped" |
| is a sub-folder of a repo | stops, and tells you the repo's top folder to use instead |

---

## `new-task`: once per ticket

```powershell
claude-rules new-task web-shop ORD-123
```

**Which app and ticket:** the two names after `new-task`. Without them, it asks: the app from a list, unless you're
inside an app's folder, then the ticket's ID. An ID is letters, digits, dots, dashes and underscores.

**What it does:** creates `investigations\web-shop\ORD-123\task.md` in the projects folder, from the template, with
the ticket's ID in its first line. A `task.md` already there is never replaced.

**What's left for you:** write the task in `task.md`, then give Claude the line it prints:

```
Write the task first, in ~/projects/investigations/web-shop/ORD-123/task.md: what's wrong, how to see it, and how you'll know it's done.
Five minutes there saves an hour later.

Started inside web-shop instead? Put ../ in front: /task-investigate ../investigations/web-shop/ORD-123/task.md

Next: in Claude, started in projects: /task-investigate investigations/web-shop/ORD-123/task.md
```

---

## `doctor`: check everything

```powershell
claude-rules doctor
```

It checks what `setup` and `add-app` did, in every app that has your notes, and **changes nothing**. A line with ✔ is
fine, and says what was found. Any other line says what's wrong, in one of three words:
- **worth a look**: it works, but could be better.
- **not set up**: this step hasn't been done yet.
- **problem**: something's wrong.

Each of those has a `Fix:` line underneath, saying exactly what to do. When an app has several findings, they're
listed one per line under it.

For the bug-fix reminder, `doctor` also runs the hook with a test message, as Claude Code would. A settings entry can
look right and still fail to run.

```
Results
  ✔ Node 18 or newer — v20.11.0
  ✔ git — 2.44.0
  ✔ Shared rules in projects/CLAUDE.md — the line is there, and every @ line points at a real file
  ✔ Skills link projects/.claude/skills — 12 skills
  ✔ Bug-fix reminder in ~/.claude/settings.json — the reminder runs on each message, in the projects folder and your
    apps; a test message got the reminder
  ✔ The claude-rules command — runs this copy
  ✔ App web-shop — kept out of git: CLAUDE.local.md, docs/ai/, the skill links in .claude/skills/ (rule in
    .git/info/exclude); Claude fills in the rest of CLAUDE.local.md on its first task here
  ✔ Rules allowed in Claude Code — allowed in 1 folder; not asked in 2 folders
```

**"Rules allowed in Claude Code"** reads your answer to Claude's import question, from Claude Code's own
`~/.claude.json`. If you chose No in a folder, the rules don't load there, and this line says how to get the question
back. A folder Claude was never started in is never asked, which is normal. If that file can't be read, the line says
"can't tell", and `doctor` ends with a reminder to check it yourself.

---

## How every command works

Every command goes through the same six stages, in the same order:

1. **What it does:** its name, and exactly what it may change. What it's for is in the menu and `--help`.
2. **Looking around:** what it found, and nothing is changed. Each line starts with a symbol: ✔ fine, · information,
   ! worth a look, ✖ a problem.
3. **Questions:** all asked up front. No question ever comes up while the work is running.
4. **The plan:** each step, and what it will do. A step with nothing to do says `already done` or `skipped`. One
   that can't be done safely says `can't do`, with a `Fix:` line.
5. **"Go ahead?"** Only now does anything change. Each step shows a progress line with a turning symbol and the
   time so far. When the step ends, that line is replaced by how it went, e.g.
   `✔ Shared rules line in projects/CLAUDE.md — created`. A step that took a second or more also shows its time.
   Set `NO_COLOR=1` to turn the colours off.
6. **The recap:** any step that still needs you, listed again with its `Fix:` line. Then a count like `All 2 done`
   or `1 done, 1 failed`, and one `Next:` line with the most useful next step.

`doctor` stops after stage 4, and shows its results instead of a plan.

**The words in a plan or a step's result.** Two cases need no word. In the plan, a step to do says what it will
do. In the results, ✔ says a step is done.

| Word | Means |
|---|---|
| already done | already in place, so nothing happens |
| skipped | doesn't apply here, e.g. the folder isn't a git repo |
| can't do | can't be done safely; the `Fix:` line underneath says what to do |
| failed | was tried, and went wrong; the `Fix:` line says what to do |
| stopped | you pressed Ctrl+C during this step |
| not run | wasn't tried, because an earlier step failed or you stopped |

**The words in doctor's results.** A ✔ line needs no word: it's fine.

| Word | Means |
|---|---|
| worth a look | works, but something could be better, e.g. the `claude-rules` command isn't installed |
| not set up | this hasn't been done yet; the fix says which command does it |
| problem | something's wrong; the fix says what to do |

**The symbols.** The old console is the plain Windows command window, which can't show symbols like ✔.

| Symbol | Old console | Means |
|---|---|---|
| ✔ | OK | fine, or done |
| · | - | information, or already done |
| ! | ! | worth a look |
| – | - | skipped, stopped, or not run |
| ✖ | X | needs your attention; read the `Fix:` line |

**Exit codes**, for scripts that run the tool: 0 all fine, 1 a step failed or can't be done, 2 the command was typed
wrong or needs a terminal, 130 stopped with Ctrl+C.

**Answering questions:** `[Y/n]` means Enter picks yes, and `[y/N]` means Enter picks no. Type `y` or `n` to choose.
Esc stops the run, at a question or in a list, as Ctrl+C does. Nothing is changed before the plan's "Go ahead?".

---

## Flags

Flags go after the command's name, e.g. `claude-rules setup --dry-run`.

| Flag | Works with | What it does |
|---|---|---|
| `--dry-run` | `setup`, `add-app`, `new-task` | Shows the plan, then stops. Nothing is written. Good for seeing what would happen. |
| `--yes` | `setup`, `add-app`, `new-task` | Answers every question with its default, and skips "Go ahead?". It never approves anything risky, so a step that would replace something of yours stays "can't do". `add-app --yes` needs the app's name, unless you run it inside the app's folder. `new-task --yes` needs the app and the ticket. |
| `--debug` | all | Shows extra technical detail when something unexpected goes wrong, and each git command it ran. |
| `--help`, `-h` | all | Lists the commands and flags. After a command's name, it describes just that command. |
| `--version` | all | Shows the tool's version. |

A misspelled flag, or a word the command doesn't take, is an error. The tool never guesses what you meant.

---

## Stopping, and running again

- **Press Ctrl+C at any time.** The tool finishes the file it's writing, so nothing is left half written. Then it
  prints what was done and what wasn't.
  - Before anything changed, it says "Stopped by you. Nothing was changed."
  - After some changes, it says "Stopped by you. Changes already made are kept; run the command again to continue."
- **A second Ctrl+C** leaves at once.
- **Running a command again is always safe.** Every step checks what's already done first. A second run of `setup` or
  `add-app` changes nothing, and says "Nothing to do — everything is already in place."

---

## When something goes wrong

Every ✖ line has a `Fix:` line under it that says what to do. What each message means is in
[When something doesn't work](../TROUBLESHOOTING.md#claude-rules-shows-a--line-or-an-error).

---

## What the tool never does

- It changes nothing before you say "Go ahead", or pass `--yes`.
- It never deletes a folder that has anything in it.
- It never changes a file the team shares: the team's `CLAUDE.md`, `.gitignore`, or anything git tracks.
- It never changes your git settings. Where one would help, it shows you the command, and you decide.
- It never leaves a file half written.
- It never replaces an earlier backup.
