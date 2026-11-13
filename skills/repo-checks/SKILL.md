---
name: repo-checks
description: "Node scripts a repo runs before a pull request, copied into the repo as they are: free disk and load before a long run, generated files a generator would change, and a GitHub tracker's duplicate and pickup lookups. Use when setting up a new repo's checks, when a committed generated file turns out stale, when a local test suite fails under load, or when agent sessions open duplicate tickets."
---

# Repo checks

Checks every repo ends up repeating by hand, as scripts that travel
unchanged. A repo takes them by copying `scripts/` into its own tool folder.
Each script is configured by its flags, so the copy is never edited. A change
is made here and copied again. The tests travel with the scripts.

The repo needs Node 20 or later and git. The tracker scripts need `gh`,
signed in.

## Install

1. Copy the scripts and their tests into the repo's tool folder, for example
   `tool/checks/`:
   ```bash
   cp ~/.agents/skills/repo-checks/scripts/*.mjs <repo>/tool/checks/
   ```
   Done when `node --test <repo>/tool/checks/` passes there.
2. Wire the machine check and the generated-file check into the repo's check
   command. The machine check goes first. The generated-file check goes after
   dependencies are installed and before format and lint, so those read what
   the generators wrote. In a `package.json`:
   ```json
   "check:machine": "node tool/checks/check-machine.mjs",
   "check:generated": "node tool/checks/check-generated.mjs --generator \"npm run codegen\" --pattern \"src/generated/*\""
   ```
   Done when the check command prints the machine line first and a
   `✓ every generated file` line.
3. Set the per-test limit for the repo's test runner, from the table below.
   Done when a test that waits forever fails by name inside the suite, with
   the rest of the suite still running. Prove it with a throwaway test, then
   delete the test.
4. Where the repo has an agent doc for its tracker, point its duplicate check
   at `tracker-find.mjs` and its pickup check at `tracker-pickup.mjs`.

## The scripts

**`check-machine.mjs [--floor-gb 4] [--volume <path>]`** prints one line and
exits 1 only under the disk floor:

- `✓ machine: 41.2 GB free, load 3.5 on 10 cores`
- `! machine: 7.6 GB free, load 13.1 on 10 cores: a failed test may have run out of time because other work held the processor. Rerun it alone before reading it as a defect`
- `✗ machine: 1.9 GB free, under the 4 GB floor: free some disk first (the disk-audit skill finds what can go)`

The load average is how many processes wanted to run in the last minute.
When more of them wanted to run than there are cores, a test can run out of
time on its own. So a failure in that run is a timing problem first. The
floor is a guess per repo: the space one build writes, with room. Four
gigabytes covers a mobile app build.

**`check-generated.mjs --generator "<command>" --pattern "<git pathspec>"`**,
both flags repeatable, snapshots every file matching the patterns, committed
or not, runs each generator through the shell, and compares. It exits 1 and
names each file a generator added, deleted or rewrote, because the committed
one was stale. A pattern is a git pathspec: `*.g.dart` matches at any depth.
A generator's output shows only when it fails.

**`tracker-find.mjs <word>`** lists every issue, open or closed, whose title
or body mentions the word, newest first, as `#846 open   <title>`. It calls
`gh` once.

**`tracker-pickup.mjs <number>`** prints the ticket's state and title, then
its assignee or `nobody`, then its labels. Last come the open pull requests
whose title, branch or body names the number. It calls `gh` for the ticket
and again for the pull requests.

Both tracker scripts stop with a message when a listing reaches a thousand
rows, since `gh` cuts a longer tracker without a word.

## The per-test limit

A runner's default limit per test is often longer than a stuck test should
hold the suite. Set it to a few times the slowest test that finishes, and
measure that from a full run.

| Runner | Where | Note |
| --- | --- | --- |
| Flutter | `test/flutter_test_config.dart`: `AutomatedTestWidgetsFlutterBinding.defaultTestTimeout = Timeout(Duration(minutes: 2))` | `flutter test --timeout` cannot shorten a widget test: the test's own limit replaces the flag's default |
| Jest | `jest.config`: `testTimeout: 30000` | milliseconds |
| Vitest | `vitest.config`: `test.testTimeout: 30000` | milliseconds |
| Node `node:test` | `node --test --test-timeout=30000` | milliseconds |
| pytest | `pytest-timeout` plugin, `timeout = 30` in `pytest.ini` | seconds |
| Go | `go test -timeout 2m` | per package, not per test |

## Worked example

The BrewPath repo runs the Dart originals of these scripts from
`tool/checks/check_machine.dart`, `tool/checks/check_generated.dart` and
`tool/tracker/`, wired into `tool/checks/check_all.dart`. Its ticket #846
records the measurements behind the floor and the limit.
