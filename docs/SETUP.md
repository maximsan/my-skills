# Getting started

Five steps, about fifteen minutes, then your first task. Commands work in Git Bash and in PowerShell. Any word you
don't know is in the [glossary](GLOSSARY.md). If something goes wrong, see
[When something doesn't work](TROUBLESHOOTING.md).

---

## 1. Put this repo next to your apps

You need Node 18 or newer, and git: `node --version` and `git --version` print them.

This repo, `prompts`, goes in the **projects folder**: the folder that holds your apps. In that folder, clone it, or
copy the `prompts` folder there if you can't clone:

```bash
git clone <this-repo-url> prompts
```

No git access there, as on a managed Windows environment? On a computer that has the repo, run `npm run zip`. It writes
`prompts-<commit>.zip` to Downloads, with `prompts/BUILT-FROM.txt` inside naming the commit. Unpack it into the
projects folder, replacing the old `prompts`.

Afterwards the projects folder looks like this. Only your apps, and `docs/` if you keep one, are yours:

```
projects/
  CLAUDE.md          one line that loads the shared rules for every app below
  .claude/skills/    a link to prompts/skills, for Claude started here
  investigations/    one folder per ticket, under its app: investigations/web-shop/ORD-123/
  docs/              your book of knowledge shared across the apps, if you keep one
  prompts/           this repo
  web-shop/          an app
    CLAUDE.local.md  your notes about this app             ┐
    docs/ai/         lasting notes Claude builds up        ├ git ignores them, in your copy only
    .claude/skills/  one link per skill                    ┘
```

Nothing is added to any app's commits. Why, and how: [Nothing gets committed](HOW-IT-WORKS.md#nothing-gets-committed).

## 2. Install the tool

In the `prompts` folder:

```bash
npm install -g .
```

This installs the `claude-rules` command from your copy. Nothing is downloaded. If `claude-rules` isn't found
afterwards, open a new terminal. Or run it from the `prompts` folder as `node cli/main.mjs`.

## 3. Set up this computer, and add your apps

```bash
claude-rules
```

A menu opens on **Set up this computer**. Press Enter, then Enter again at "Go ahead?". When it offers to add an
app, say yes, and pick one. Then keep saying yes to "Add another app?" for the rest. Adding an app changes nothing in
its repo, so adding all of them is safe.

What each command asks, and what its output means, is in the [user guide](cli/user-guide.md).

## 4. Check it works

```bash
claude-rules doctor
```

It changes nothing. A ✔ line is fine. Any other line has a `Fix:` line under it, saying what to run.

Then start Claude in the projects folder, or in an app, and ask it anything. **The first time in an app, Claude asks
whether to allow imports from `prompts/rules/…`. Choose Yes**: those imports are the rules.

**It works** if the reply starts with three lines like these:

```
Skills:  ...
Rules:   ...
Context: ...
```

## 5. Your first task

Try one real task in one app before you rely on this everywhere. Start the ticket's folder:

```bash
claude-rules new-task web-shop ORD-123
```

It creates `investigations/web-shop/ORD-123/task.md`. Write the task in it: what's wrong, how to see it, and how
you'll know it's done. It's the only file you write, and five minutes there saves an hour later. Then, in Claude:

1. `/task-investigate investigations/web-shop/ORD-123/task.md`. Read `findings.md`, then answer its questions, like
   `1b, 2a`.
2. `/task-plan investigations/web-shop/ORD-123/task.md`. Read `plan.md`, and approve it.
3. `/task-implement investigations/web-shop/ORD-123/plan.md`.
4. `/task-review investigations/web-shop/ORD-123/`, **in a new chat**. Decide what to do with each finding.
5. `/task-learn investigations/web-shop/ORD-123/`.

Run steps 1 to 3 in one chat. Started inside the app instead of the projects folder, put `../` in front of each path.

On the first task in an app, Claude also fills in that app's notes, `CLAUDE.local.md`. It works out the commands,
where things are, and which files to copy for new ones. It shows you what it wrote, and waits for your approval.

What each step does, when to skip one, and how the files fit together: [How it works](HOW-IT-WORKS.md). A whole task,
start to finish: [the worked example](EXAMPLE.md).

---

## Updating

With a clone, run `git pull` in `prompts`.

With a copied folder, replace it whole. Copying over the old folder never deletes a file the repo removed.

1. Rename `prompts` to `prompts-old`.
2. Copy the new `prompts` folder in.
3. Run `claude-rules doctor`.
4. Delete `prompts-old` once doctor passes.

The path stays the same, so the `claude-rules` command keeps working without reinstalling. Keep your own skills in
`~/.claude/skills`, not in `prompts/skills`, so an update never touches them.

## Optional: stricter TypeScript

The TypeScript rules are deliberately thin: the real enforcement is `tsconfig` and eslint, which can't be skimmed
past. [templates/typescript-setup.md](../templates/typescript-setup.md) has one profile for a new app, and one for an
app that already exists.
