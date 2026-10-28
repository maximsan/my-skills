## 2026-09-23 — A debug skill, with a ledger it has to re-read

Debugging failed in a specific way. The agent would find something, and the user would ask a follow-up. Two or
three questions later, the finding was gone. The agent either worked it out again or contradicted it without a
check. The six-step loop in `common/CLAUDE.md` said *what* to do. It never said *where* to write the results down,
so they stayed in the chat.

### One file fixes the forgetting

The skill keeps a ledger, `debug.md`, in the ticket folder. It holds the symptom, each hypothesis with its status,
each check with the log lines that decided it, and a `Next:` line.

Keeping a ledger isn't enough on its own. The rule that makes it work is **re-read it before every reply**. The
agent proves it did by opening each reply with a one-line `Ledger:` summary. This is the same trick as the
`Skills:/Rules:/Context:` lines: a step you have to print is a step you do. The re-read rule also went into "Keep
memory in files". Forgetting between follow-ups happens outside debugging too.

I considered using `progress.md` instead, since "one file per purpose" argues against a new file. I rejected it for
three reasons. Debugging often happens without a plan or `task-implement`. The shape is different: a hypothesis
table, not a step log. And `progress.md` still gets the result and a pointer to the ledger.

### Logs are tagged, written to files, filtered, and checked

Every temporary log line starts with a tag like `[DBG C3]`. One grep filters the output by tag. Another grep proves
the logging is all gone at the end.

Each run writes to its own file in `scratch/logs/`. The raw output survives, so the agent can filter it again
instead of re-running. Only the lines that decide a check go into the ledger, with the command that filtered them.
This is the "trim irrelevant information" part. The ledger is re-read every turn, so it has to stay short.

The validation step exists because stale logs are the most common false confirmation. **Zero tag hits is a
finding.** It means the code path wasn't reached or the build is stale. It is not an empty result to skip past.

### What was added beyond logging

- The agent writes down what each result would mean before running a check. A result read afterwards can be made
  to fit anything.
- One change per run.
- Three checks in a row that narrow nothing is a stop signal. The agent then questions its weakest "established"
  fact, or bisects.
- A cause counts as confirmed only when it explains every observation. The skill then hands off to
  `failing-test-first`, which still owns the regression test.

The skill is named `debug` rather than `diagnose` because that's the word users type. Some public skill packs ship
a `diagnose` skill with the same triggers. If both are installed, they will compete.
