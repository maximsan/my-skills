## 2026-10-26 — The tests run on Windows too

The apps run on a managed Windows environment, but the CLI was only ever tested on macOS and Ubuntu. GitHub now runs `npm test` on
Windows as well, with Git for Windows' default line endings, as a real clone has. Lint, types and the changelog check
run once, on Ubuntu, because they don't depend on the machine.

The first Windows run failed in most tests, all because of the tests themselves, not the CLI:

- The temp folder came back in its short form, `C:/Users/RUNNER~1`, while git reports the long one. So `add-app` saw
  every test app as inside another repo. The test sandbox now uses the long form, as a real projects folder has.
- Tests expected the macOS `rm` command, a backslash path where the CLI prints forward slashes, and `\n` line endings.

What it costs: three Ctrl+C tests are skipped on Windows, so Ctrl+C there is still untested.

- Two fake Ctrl+C with a signal. Windows has no signal to send, so it ends the process outright.
- One was already skipped: it uses a shell script as a stand-in for git.
