# Take the fix out and run the test

Take the fix out and run the new test. It must fail, with a message matching the reported symptom. A script does the
git work and puts the fix back byte for byte, so don't run the steps by hand.

**Where the script is:** `prompts/skills/task-review/scripts/take-out-the-fix.mjs`, in the projects folder. The
projects folder is the one holding `prompts`: the `@…/prompts/rules/common.md` line in the shared rules file gives its
full path. Write the path with forward slashes.

Run it from the app's folder:

```
node <projects folder>/prompts/skills/task-review/scripts/take-out-the-fix.mjs --base <base> --task-folder <task folder> --test "<the new test's command>" -- <the files containing the fix>
```

- `<base>` is the `Commit:` sha in `plan.md`.
- `<task folder>` is the ticket's folder, as the common rules define it.
- The files are the fix's files only, new ones included. Never list the new test's file: it must stay while it runs.
- The test command runs in the system's shell, which is `cmd` on Windows, not Git Bash. Use a plain command, such
  as `npx jest src/cart/total.test.ts`, with no Bash-only syntax.

It works whether the fix is committed or not. What it prints last, and its exit code:

| Exit | Means | Then |
|---|---|---|
| 0 | The test failed without the fix | Read the failure above it: real red or false red? |
| 1 | The test passed without the fix | The test doesn't catch the bug. Fix the test |
| 2 | Nothing was changed | Read the message. Correct the command and run it again, or stop if the message says so |
| 3 | The files or `git status` aren't as before, or the script failed | Stop and tell the user. The message says where the copies are |

**Real red or false red.** The script takes out every change in those files since `<base>`, not only the fix. A
compile error, a missing import or "0 tests ran" is a false red: see *Telling a real red from a false one* in
`failing-test-first`. Then cut the patch down: the script saved the whole change as `fix.patch` in
`<task folder>/scratch/take-out-the-fix/`. Copy it, delete the hunks that aren't the fix, and run the script again with
`--patch <the cut-down copy>` before the `--`.

A test that passes without the fix is not a regression test. It's decoration, and it will let the same bug back in
later. Verify it first-hand, whether or not `progress.md` or `debug.md` claims a red was seen. This is cheap, and it's
the one test claim worth re-running.
