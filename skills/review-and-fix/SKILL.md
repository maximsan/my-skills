---
name: review-and-fix
description: Review a branch's changes with two adversarial reviewers, a spec check and a prose check, decide which findings are true, fix them in the branch, and record the review. Opening a PR requires it. Use before `gh pr create`, when a hook says a review is needed, or when the user asks to review and fix a branch. For a report without changes, use code-review instead.
---

# Review and fix

Unlike a review that only reports, this one **changes the branch**: it ends
with the confirmed findings fixed, committed and recorded. You are the
orchestrator. Four reviewers report; you decide what is true, fix it, and
record that the commit was reviewed.

## 1. Pin what is reviewed

- **Fixed point.** The branch's base, unless the user names another: the
  default branch, `origin/<default>` (find it with
  `git symbolic-ref --short refs/remotes/origin/HEAD`). After an earlier run,
  review only what came since: the commit in `<git dir>/claude-reviewed`.
- **Diff:** `git diff <fixed point>...HEAD`. **Commits:**
  `git log <fixed point>..HEAD --oneline`.
- Confirm the fixed point resolves and the diff is not empty before going on.

## 2. Gather what the reviewers need

- **The spec:** the issue named in the commit messages or the branch, fetched
  the way the repo's docs say (for example `docs/agents/issue-tracker.md`), or
  a path the user gives. If none exists, the spec reviewer is skipped.
- **The standards:** every file in the repo that says how code is written, such
  as `CLAUDE.md`, `AGENTS.md`, `CODING_STANDARDS.md`, `CONTRIBUTING.md`, and
  the lint config. A documented standard beats the general lenses below.
- **The writing rules:** the *Writing* section of the global `CLAUDE.md`
  (`~/.claude/CLAUDE.md`), and the repo's `GLOSSARY.md` where there is one.
- **The prose:** every comment, test name and Markdown line the diff adds,
  plus the PR body and the ticket bodies the branch will close.
- **The checks:** the commands the repo uses to verify a change (its README,
  its CI workflow, its package scripts or check script). Run them now, before
  starting the reviewers, and give each reviewer the output: a rule a tool
  checks is never left to a reader. Run them again in step 5.
- **No checks:** changed code in a language the repo doesn't lint is a
  finding. Run the fallback for that language and give reviewers its output
  too:
  - JavaScript: the `my-skills` config, from the folder that holds the files,
    since ESLint skips files outside the folder it runs in:
    `npx --prefix ~/projects/my/skills eslint --config ~/projects/my/skills/eslint.config.mjs <files>`.
    Run `npm ci` in `~/projects/my/skills` first if it has no `node_modules`.
  - TypeScript: `npx tsc --noEmit` where there's a `tsconfig.json`.
  - Dart: `flutter analyze` in a Flutter project, `dart analyze` otherwise.
  - Any other language: no fallback. Say in the report that no tool checked
    it, so its rules rest on the reviewers' reading alone.
- **The capture rule:** whether the repo requires a change a user can see to
  be captured on a device or simulator before it is done (a rule in its
  `CLAUDE.md`, or a screenshot skill). You apply it in step 5.

## 3. Start the reviewers

Each is a sub-agent with its own context, so none sees another's findings.
Start the two code reviewers and the spec reviewer together. Start the prose
reviewer as soon as one of them reports, so no more than three run at once.

A run whose diff only renames or edits docs needs one code reviewer and the
prose reviewer. Its code findings are each decided as found by one reviewer.

A follow-up run after an earlier review of the same branch, whose diff is
small (a fix of under about 50 changed lines), needs one code reviewer and the
prose reviewer. Its code findings are each decided as found by one reviewer.
The first review of a branch, and any larger change, get both code reviewers.

A run whose diff only changes wording in string or content files, plus the
files generated from them, needs one code reviewer. Its brief: each generated
file matches its source, and no file still holds the old wording.

Every reviewer's prompt ends with this line, because a reviewer that ran the
tests with `GIT_DIR` set once wrote commits into the branch under review:

> Read only: change no file, and run only git commands that read. Run the
> repo's tests as they are, with no `GIT_*` variable set.

**Two code reviewers**, given the same prompt: the diff command, the commit
list, the standards files, and this brief:

> You are an adversarial reviewer. Assume this change has problems and find
> them; another reviewer is reviewing the same diff without you. Read every
> hunk through five lenses:
> 1. Code smells: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps,
>    Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change,
>    Speculative Generality, Message Chains, Middle Man, Refused Bequest.
> 2. Clean code: names that say what a value means, not what it looks like;
>    readable control flow; comments only where the code cannot speak; test
>    values that stand for real things copied from the repo or a real run.
>    A reader must understand each line without guessing or opening another
>    file: each name carries its meaning to the caller (what the code
>    returns, does or answers, whichever says it best), one word per idea,
>    data reached by name rather than position. Where code moved, each doc
>    comment still describes the declaration directly under it.
> 3. Redundancy: duplicated logic, dead code, a second way to do what the
>    repo already does.
> 4. Efficiency: needless work, repeated I/O, slow paths in hot code.
> 5. Architecture: code in the wrong layer or file, a pattern the repo uses
>    elsewhere that this change ignores.
>
> Run each claim the change makes about how a tool behaves, such as a lint
> rule, a library call or a CSS class, and show the output. A claim can sit in
> code, a comment or a commit message. Report each claim the run contradicts.
>
> For each finding give: file:line, the quoted code, the lens, why it is a
> problem, the fix, and whether it breaks a documented standard (cite the file
> and rule) or is a judgement call. Skip anything the repo's tooling already
> enforces. Under 500 words.

**One spec reviewer**: the diff command, the commit list, the spec, the PR
body, and this brief: "Report requirements that are missing or partial,
behaviour nobody asked for, and requirements that look implemented but wrong.
Quote the spec line for each. Check every claim the PR body makes about the
code or the design against its source, and report each one the source does
not bear out, with the file and line. List every change a user can see, such
as layout, copy, colour or motion, with its file and line. Under 500 words."

**One prose reviewer**: the prose from step 2, the writing rules, the glossary,
and this brief:

> You are reading this text cold, as someone who has never seen the code or
> the conversation behind it. Report every place you would have to stop and
> ask: a word the text never explains (a project name, a code name, framework
> jargon, a coined shorthand such as "the foot" or "pinned"); a word the
> glossary retires or defines differently; a sentence holding more than one
> fact; an aside between dashes or in parentheses; a "that", "it" or "this"
> before the thing is named; a chain of negatives; an old-versus-new
> comparison not written as a list; a claim of a change that never says what
> was true before. For each, quote the text, give the file and line (or "PR
> body", "ticket #N"), say what a reader would not understand, and give the
> rewrite. Under 500 words.

## 4. Decide what is true

A finding is not true because a reviewer wrote it; the code decides.

1. Pair up findings from the two code reviewers that name the same place and
   the same problem.
2. **Both found it:** confirmed, unless reading the code shows otherwise.
3. **Only one found it, or they disagree:** open the code and decide. Keep or
   reject it, with a one-line reason.
4. Reject anything the tooling enforces or a documented standard allows.
5. Check each spec finding against the spec line it quotes.
6. Keep each prose finding a reader would trip on. Before using its rewrite,
   check every fact in it against the code: a clear sentence can still be
   wrong.

## 5. Fix, check, commit

- Fix every confirmed finding in the branch. A fix that needs a decision only
  the user can make is asked about, not guessed.
- Run the repo's checks from step 2; every one must pass.
- Where the repo has a capture rule, every change on the spec reviewer's list
  of visible changes has a capture the user has been shown. Capture each
  missing one before recording the review.
- Commit the fixes, staging each file by name.

## 6. Record the review

When nothing confirmed is left unfixed, get the full HEAD commit and the git
dir with two plain commands: `git rev-parse HEAD` and
`git rev-parse --absolute-git-dir`. Then write the commit into the file with
both values typed out:

```bash
echo <commit> > <git dir>/claude-reviewed
```

A worktree session refuses a `$(…)` path here. It also refuses the Write
tool, because a worktree's git dir sits inside the main checkout.

A hook refuses `gh pr create` until this file names the current HEAD. The
hook's refusal also gives the commit and the file path. The hook reads the
file before the shell command runs, so record the review in one call, then
run `gh pr create` in the next. A commit made after the review needs this
skill again, for what it added.

## 7. Report

Under these headings, short:
- **Fixed:** each confirmed finding, marked "both reviewers" or "one, checked".
- **Rejected:** each finding dropped, which reviewer raised it, and why.
- **Waiting on you:** fixes that need the user's decision.
- **Spec:** what the spec reviewer found, and what was done about it.
- **Captures:** each visible change and the capture that shows it, where the
  repo has a capture rule.
- **Prose:** what the prose reviewer found, and what was rewritten.
