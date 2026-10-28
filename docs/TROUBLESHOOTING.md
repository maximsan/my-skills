# When something doesn't work

Start with `claude-rules doctor`. It checks everything the setup did, changes nothing, and says what to run for
anything that's wrong. This page covers what it can't fix for you, what its messages mean, and the rarer jobs:
removing the setup, or doing it without the tool.

## `claude-rules` shows a ✖ line or an error

A ✖ line always has a `Fix:` line under it. After a failure, the last line says "Fix the ✖ lines above, then run the
same command again." The messages you're most likely to see:

| You see | What it means | What to do |
|---|---|---|
| `.claude/skills is one link to …, but each skill needs its own` | The app's `.claude\skills` is one junction to all the skills, from the manual setup | Run the command its `Fix:` line shows. It removes only the link. Then run `add-app` again |
| `your skill links are committed to this repo` | A commit in the app took in the skill links | Run the `git rm` command its `Fix:` line shows, in the app. It takes only your links out of the repo and leaves them on disk. The team sees the removal in your next commit |
| `links not to this repo's skills` | A skill link points at an old `prompts` folder, or at a skill that's gone | Run the commands its `Fix:` line shows. They remove only the links. Then run `add-app` again |
| `is un-ignored by .gitignore:…` | The team's `.gitignore` deliberately un-ignores your notes file | Ask the team to drop that line. The tool never edits the team's files |
| `detected dubious ownership` | The app's folder belongs to another Windows user, and git refuses to work there | If the folder is yours, run the `git config --global --add safe.directory "…"` command the message shows, then run `add-app` again |
| `is committed to this repo, so it's the team's file` | Someone committed a `CLAUDE.local.md` to this app | Ask the team why. The tool won't change it |
| `is inside the repo at …, not its top folder` | You pointed `add-app` at a sub-folder | Run `add-app` on the top folder it names |
| `This repo's path has a space in it` | Claude may not load the rules from a path with a space | If the rules don't load, move the projects folder to a path without spaces |
| `This needs answers — run it in a terminal, or add --yes.` | It was run without a terminal to ask in, e.g. from a script | Run it in PowerShell, or add `--yes` |
| `Something unexpected went wrong` | A bug in the tool | Run the same command with `--debug`, and share the output |

## The rules don't load

**First: did you choose No when Claude asked about imports?** `claude-rules doctor` reads that answer, and shows
"Rules allowed in Claude Code" as ✖ in that case. Claude remembers the answer per folder, and never asks again. To
get the question back, close Claude and open `.claude.json` in your home folder, `%USERPROFILE%\.claude.json`, in an
editor. Under `"projects"`, find your app's folder, and set both of these to `false`:

```json
"hasClaudeMdExternalIncludesApproved": false,
"hasClaudeMdExternalIncludesWarningShown": false
```

The next chat in that app asks again. Choose Yes.

If that wasn't it, find out whether `@` pointers work at all, with a sentinel:

```powershell
Set-Content "C:\Users\<you>\projects\rules-test.md" 'Always start your first reply with BANANA-7.'
```

Back up `projects\CLAUDE.md`. Then put **only** a pointer to the test file in it, and say `hi` in a new chat:

```powershell
Set-Content "C:\Users\<you>\projects\CLAUDE.md" '@C:/Users/<you>/projects/rules-test.md'
```

- **BANANA-7 appears** → pointers work, so the problem is in the rules themselves.
- **Nothing** → pointers aren't supported. Paste the contents of `prompts\rules\common.md` into
  `projects\CLAUDE.md` instead. Paste it again each time the original changes.

Restore your file afterwards, and delete `rules-test.md`.

## The skills don't load

Claude Code reads skills from the folder it starts in, and from `%USERPROFILE%\.claude\skills`. It reads them from a
folder above only when the folder it started in isn't a git repo. So each starting point has its own links:

- **Started in `projects\`:** the skills come from `projects\.claude\skills`, which `setup` links.
- **Started inside an app:** the app is a git repo, so the skills come from its own links, which `add-app` makes.

Run `claude-rules doctor`. It checks the projects link, and each app's line says whether its skill links are in place.
Each gives the fix when something's missing. A skill added to `prompts\skills` later reaches an app's links only after
you run `add-app` for it again. The projects link shows it at once.

## A repo already has its own `CLAUDE.md`, or an `AGENTS.md`

Nothing to do. Your notes go in `CLAUDE.local.md` next to it, and the project's file is never touched.

An `AGENTS.md` is left alone too. Claude doesn't read one when there's a `CLAUDE.md` above it, and
`projects\CLAUDE.md` always is. `add-app` says so when it finds one.

## One of these files ends up committed

Replace its `@` lines with the full text first. An `@` pointing at your folders finds nothing on a teammate's
machine, and it fails silently.

## You want it gone

Nothing here touches your repos' tracked files, or your git settings, so removing it leaves no trace.

In each app, remove the skill links. This removes only the links. The skills in `prompts\skills` stay where they
are, and so do any skills of the app's own:

```powershell
Get-ChildItem .claude\skills | Where-Object LinkType | ForEach-Object { cmd /c rmdir $_.FullName }
```

Remove the projects link the same way: `cmd /c rmdir "C:\Users\<you>\projects\.claude\skills"`.

In `projects\CLAUDE.md`, delete only the `@…/prompts/rules/common.md` line. Anything else in that file is yours.
If `setup` found the file already there, it kept your original as `CLAUDE.md.bak` next to it, and you can restore
that instead.

In `%USERPROFILE%\.claude\settings.json`, delete the bug-fix reminder's entry: the one whose `command` names
`bug-fix-reminder.mjs`. Keep the rest of the file. To switch every hook off at once instead, set
`"disableAllHooks": true` in that file.

```powershell
npm uninstall -g claude-rules
```

Each app's `CLAUDE.local.md` and `docs\ai\`, and `projects\investigations\`, are yours: delete them or keep them. The lines
`add-app` put in each app's `.git\info\exclude` are harmless, and can stay. So can any backups in
`.git\claude-rules-backups\`.

---

## Without the CLI

If you can't install it, the same setup by hand. Replace `<you>` throughout.

**1. The shared rules and skills.** Put this line at the top of `C:\Users\<you>\projects\CLAUDE.md`. Create the file
if it doesn't exist:

```markdown
@C:/Users/<you>/projects/prompts/rules/common.md
```

Then link the skills for Claude started in `projects\`, and make the folder for tickets:

```powershell
New-Item -ItemType Directory -Force "C:\Users\<you>\projects\.claude", "C:\Users\<you>\projects\investigations" | Out-Null
cmd /c mklink /J "C:\Users\<you>\projects\.claude\skills" "C:\Users\<you>\projects\prompts\skills"
```

**2. Each app**, from inside its folder:

```powershell
New-Item -ItemType Directory -Force docs\ai
```

```powershell
Copy-Item "C:\Users\<you>\projects\prompts\templates\CLAUDE.local.md.template" ".\CLAUDE.local.md"
```

In `CLAUDE.local.md`, replace `<stack rules>` with a line for each stack the app uses, e.g.
`@C:/Users/<you>/projects/prompts/rules/react.md`. The choices are every file in `rules/` except `common.md`.
Link each skill into the app. Skip any skill the app already has a folder for: that one is the team's.

```powershell
$skills = Get-ChildItem "C:\Users\<you>\projects\prompts\skills" -Directory | Where-Object { -not (Test-Path ".claude\skills\$($_.Name)") }
New-Item -ItemType Directory -Force .claude\skills | Out-Null
$skills | ForEach-Object { cmd /c mklink /J ".claude\skills\$($_.Name)" $_.FullName }
```

Then keep all of it out of git, and check it took. A skill line has no slash at the end, because git sees a link as a
file:

```powershell
Add-Content (git rev-parse --git-path info/exclude) "CLAUDE.local.md","docs/ai/"
Add-Content (git rev-parse --git-path info/exclude) ($skills | ForEach-Object { ".claude/skills/$($_.Name)" })
```

```powershell
git check-ignore -v CLAUDE.local.md
```
