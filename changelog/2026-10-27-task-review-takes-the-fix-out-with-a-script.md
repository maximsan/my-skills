## 2026-10-27 — task-review takes the fix out with a script

Checking that a bug's test fails without the fix took about ten git commands, run by hand in the right order. A
step skipped or mistyped could leave the fix out, or put it back changed. Now `task-review` runs one script,
`skills/task-review/scripts/take-out-the-fix.mjs`. It takes the fix out, runs the test, puts the fix back, and checks
the files match. Claude only judges whether the failure is a real red. This is the first skill to run a script, as a
pilot for the others.

- **The fix comes back from a copy of each file's bytes, not from a patch.** With git's line-ending conversion on
  Windows, a patch made from the working files may not apply back, or may apply with other line endings.
- **It sits in the skill's folder, and Claude builds its path from the projects folder.** Claude Code 2.1.39, still
  used on a managed Windows environment, doesn't fill in `${CLAUDE_SKILL_DIR}`: that came in 2.1.69.
- **A run that leaves other changes stops.** If `git status` differs afterwards, for example because the test wrote a
  file, the script names the change and Claude stops and tells you.

Rejected: a `claude-rules` command. It runs from any folder, so there's no path to build, but it would mix a review
step into the setup tool.

What it costs: the test command runs in `cmd` on Windows, not Git Bash, so it must not use Bash-only syntax.
