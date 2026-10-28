# How it works

## The loop

```
task.md ──▶ task-investigate ──▶ findings.md
                                     │
                                     ▼
                            task-plan ──▶ plan.md ──▶ [you approve]
                                                          │
                                                          ▼
                                        task-implement ──▶ code + progress.md
                                                          │
                                                          ▼
                                          task-review ──▶ review.md   (fresh chat)
                                                          │
                                            you triage ───┤ fix now ──▶ back to task-implement
                                                          │ backlog ──▶ plan.md
                                                          │ won't fix ▶ recorded, with the reason
                                                          ▼
                                            task-learn ──▶ docs/ai/  (you approve)
```

| Skill | What it does | What you do |
|---|---|---|
| `task-investigate` | Reads the real code, writes `findings.md` | Answer its questions |
| `task-plan` | Writes `plan.md` | Read it, fix it, approve it |
| `task-implement` | Builds it, keeping notes as it goes | Answer if it asks |
| `task-review` | Checks the finished work | Decide what to fix |
| `task-learn` | Saves what the task taught, often nothing | Approve what gets saved |
| `debug` | Finds a bug's cause with tagged logs and a ledger of what each check proved | Answer; read `debug.md` |
| `failing-test-first` | Reproduces a bug as a failing test before anything gets fixed | Nothing — read the red |
| `rework` | Works out what to keep and throw away when finished work turns out wrong | Approve the triage |
| `why-this-exists` | Works out why code is there before it's deleted | Answer if it can't tell |
| `rule-author` | Writes and reviews rules and skills | Approve them |
| `create` | Copies the nearest existing file of its kind, showing where each convention came from | Read the table |
| `write-tests` | Writes tests for code that already works | Check what it chose *not* to cover |

Ask for a task skill in your own words ("investigate this", "review my change") or type it: `/task-plan`.
`task-implement` starts only after you approve the plan, or ask it to fix a review, in the chat. `task-review` stops
if it wrote the code in the same chat.

The rest aren't task skills. They load when they're needed, inside the others or on their own.

`debug`, `failing-test-first` and `rework` can match your request directly — "debug this", "fix this bug", "the spec
changed", "this needs rewriting". `why-this-exists` can't: it fires part-way through other work, the moment
something is about to be removed, and nothing in your original request predicts that. So each of them carries an
explicit trigger in the rules and the task skills rather than relying on the description matching — the ones that
fire mid-task because nothing else would reach them, and the ones that match directly because a description you have
to phrase right is not a mechanism.

**Stay in one chat while the context is good.** Running `task-investigate` → `task-plan` → `task-implement` in one
session is better than splitting them: it still knows *why* a decision was made, and that reasoning never makes it
into `findings.md` or `plan.md`.

**One exception: `task-review` must be a fresh chat.** Not for context reasons — for independence. A model reviewing
code it just wrote treats its own reasoning as evidence and defends its own choices. More context makes that worse,
not better, and everything it needs is already in the files.

Break the session early in three cases: after a compaction (quality drops and the summary is lossy), when you've
corrected the same wrong assumption twice (it's anchored — a reset is cheaper than fighting it), and when switching
tickets.

The files aren't there to hand off between chats. They're insurance, so a compaction or a crash costs you nothing.

Skip `task-investigate` for small changes. Skip `task-review` for tiny diffs. Never skip `task-learn` — it's five
minutes and it's what makes the next task faster.

### If the whole loop feels like too much

It probably will, and you'll drop the whole thing if it does. First week, do only:

1. The rules installed
2. `/task-plan`, then `/task-implement`, on real work
3. `/task-learn` at the end

That already gets you code that's read instead of guessed at, real diagnosis instead of random fixes, cleanup after
itself, and notes that build up. Add `/task-investigate` the next time you catch it inventing what a function
does.

### After about five tasks

Open `docs\ai\FEEDBACK.md`. Nothing else will remind you. It has two sections:

- **Corrections**: every correction you made, one row with a cause tag. Whichever tag repeats most is what to fix,
  usually one sentence in one file.
- **Proposed rules**: suggested rules, each with the two-or-more times it came up. Promote what you agree with,
  delete the rest. Left alone, the list just grows and stops being read.

| Tag that keeps coming up | Fix |
|---|---|
| `shallow-read` | Demand the file and line earlier in the rules |
| `missing-rule` | The rule exists but isn't loading — check the three lines are printed |
| `unclear-request` | Your `task.md` files need more detail. That one's on you |
| `wrong-assumption` | It's not asking enough — widen the question list |
| `forgot-existing-file` | The diff check isn't happening — demand the file list every step |
| `scope-creep` | The plan's "files to touch" isn't being treated as a limit |
| `said-done-but-wasnt` | "Done when" isn't specific enough to check |
| `wrong-convention` | The Exemplars table in `NOTES.md` is missing, or points at a file that's no longer typical |

Change **one** thing, then run five more tasks. Change five at once and you'll never know which helped.

## One folder per ticket

In the projects folder, under the app the ticket is about:

```
investigations/my-app/ORD-123/
  task.md        you write this — what's being asked, links, how you'll know it's done
  findings.md    task-investigate writes it, updates it on later runs
  plan.md        task-plan writes it, task-implement ticks it off
  progress.md    task-investigate ticks off its steps here, task-implement adds a note after each step, and a
                 checkpoint at every pivot
  debug.md       debug writes it — hypotheses, checks, the log lines that decided each
  review.md      task-review writes it
  scratch/       outside every repo — all throwaway work goes here, never in src/; raw debug logs in scratch/logs/
```

Keep these folders. They're a searchable record of how things were worked out. `task-investigate` searches every
app's before reading any code, because the fastest way to solve a bug is to find that you already solved it. They sit outside
every repo, so they survive deleting an app's clone, and nothing has to keep them out of git.

## Where the files live

Each kind of rule has its own home:

| Kind | Example | Lives in |
|---|---|---|
| **How to work** — applies to every project | "read the code, don't guess it" | `rules/common.md` |
| **How we write React** — applies to all your React projects | "no data fetching inside useEffect" | `rules/react.md` |
| **How microfrontends behave** — applies to all your federated apps | "nothing on `window`" | `rules/microfrontend.md` |
| **How we type things** — applies to all your TypeScript | "parse at the boundary, don't assert past it" | `rules/typescript.md` |
| **This project only** | build command, folder layout, known traps | that repo's `CLAUDE.local.md` + `docs/ai/` |

The test: **if you can't say it without naming a specific project, it goes one level down.**
"Named exports only" is a React rule. "The old `widgets/` folder still uses default exports" is a project fact.

### Nothing gets committed

This is all yours — local files, never pushed. [The layout](SETUP.md#1-put-this-repo-next-to-your-apps) in SETUP.md
shows where each file goes.

The shared rules go in a `CLAUDE.md` one level **above** your apps. There it applies to every app, and to nothing
else on the machine. It sits outside every repo, so it can't be committed by accident and needs no ignore rule.
Your notes about each app go in `CLAUDE.local.md`, next to the team's own `CLAUDE.md`. Claude Code loads both, and
the team's file stays exactly as it is.

The real text stays in `prompts/` where git tracks it. `projects/CLAUDE.md` is one `@` pointer line. The skills are
linked twice, once for each place Claude can start:

- `projects/.claude/skills` is one link to `prompts/skills`.
- Each app's `.claude/skills` holds one link per skill, plus one to `skills/shared`, the files several skills read.

So there's one copy of everything. A new skill reaches an app's links the next time `add-app` runs there.

`claude-rules`, the setup tool in this repo, does all of this: `setup` once per computer, then `add-app` once per
app. [SETUP.md](SETUP.md) has the commands to install it.

One trade-off worth knowing: `docs/ai/` lives inside each app, so it's gone if you delete the clone. The ticket
folders aren't: they're in the projects folder.

### Why your notes don't show in `git status`

Your notes live inside the work repo. Git would normally list them as new files, and one `git add .` would commit
them to the team's repo:

```
Untracked files:
  CLAUDE.local.md
  docs/ai/
  .claude/skills/debug
```

So `add-app` tells git to skip them. It doesn't use the team's `.gitignore`, because changing that means a commit
everyone gets. Git has a second, private ignore file in every repo, `.git\info\exclude`. It works like
`.gitignore`, but it's never committed, and only your copy of the repo has it. `add-app` adds a line for each of its files and
links there, under a comment that says where they came from:

```
CLAUDE.local.md
docs/ai/
.claude/skills/debug
…
```

After that, `git status` is clean. The files are still there, and you open and edit them as normal. Git just no longer
offers to commit them. To check any time, run this inside the app. It prints the rule that matched, and no output
means the file isn't ignored:

```powershell
git check-ignore -v CLAUDE.local.md
```

## The knowledge base

Per project. This is the part your shared rules can't carry.

```
docs/ai/
  NOTES.md        the Exemplars table, then what would mislead the next session
  FEEDBACK.md     one row per correction you made, quoted, with a cause tag; then suggested new rules, waiting for you
  CONTEXT.md      optional — you write it: how the system fits together
  GLOSSARY.md     optional — you write it: business word → what it's called in the code
```

One notes file, not one per topic. With five topic files, one finding got written three ways, because the topics
overlap. A note's heading says when you'd need it, so a single file is enough.

Rules for keeping it useful:

- **Every note names where it came from in the task.** A `Learned:` line, an assumption that proved wrong, a
  correction you made, a review won't-fix, or a confirmed debug cause. No source, no note. Most tasks add nothing.
- **Only write what's still true in three months.** Line numbers and pasted code go stale in days. How something
  behaves, and why it was built that way, doesn't.
- **Point at function names, not line numbers.** `useLogin.ts → useLogin()`, not `useLogin.ts:34`.
- **File notes under when you'd need them**, not what they're about. "If a login succeeds but data looks stale…"
  beats "Login — retry logic."
- **Turn rules into code when you can.** A lint rule beats a written rule. Delete the written one once it lands.
- **It should stay about the same size.** New notes arriving, old ones graduating into code or being deleted. A file
  that only grows has stopped being read.

`task-learn` handles all of this, including checking old notes against what actually changed in the code.

## The eight things that make it work

Everything else is scaffolding. Each one turns an instruction you can't check into an output you can:

1. **Show the file and line.** No claim about code without pointing at where you read it. Guessing is normally
   invisible; this makes it obvious at a glance. The same trick works when *writing* code, not just describing it —
   `create` makes every convention in a new file cite the existing file it came from.
2. **Write every question down first, then sort them.** Going straight to "I'll assume the sensible thing" is exactly
   how questions never get asked.
3. **Two failed attempts, then stop and diagnose — in a file.** A hard stop on trying things at random, and a
   ledger so what a check proved survives the next three questions.
4. **Check the diff both ways.** Every change matches something you asked for, and everything you asked for shows up.
   This is what catches leftover files and dead code.
5. **List every file you created or changed.** So nothing gets forgotten and re-created under a different name.
6. **Print what you loaded and what you ran.** Skills picked, rules applied, commands run with their output. What has
   to be reported gets done.
7. **Find out why code is there before removing it.** Code that looks pointless is usually a fix someone added after
   being burned. Default on "can't tell" is keep, not delete.
8. **For bugs, the failing test comes first.** Show it red, then fix it, then show it green. A test written after the
   fix usually passes against broken code — which is why the review re-runs it with the fix taken out.

## Where the skills go

```
projects/.claude/skills/<name>/SKILL.md   Claude started in the projects folder   ← setup links this
<app>/.claude/skills/<name>/SKILL.md      Claude started in that app              ← add-app links each skill here
~/.claude/skills/<name>/SKILL.md          every project on the machine
```

Claude Code reads skills from a folder above the one it starts in only when that folder isn't a git repo. An app is
its own repo, so started there, it sees only the app's links. Started in the projects folder, it sees the projects
link, and adds an app's copies, named like `my-app:debug`, once it opens a file in that app. Both copies are the same
files. Linking here rather than in `~/.claude/skills` keeps the skills out of your other repos. The app's links are
kept out of git, like your notes.

Type `/debug` to use one, or let it load itself from its description. **Don't count on it loading itself** — the
routing lines at the top of `rules/common.md` force it to list which skills it picked and rejected at the start of
every task, which works either way.

Slash commands (`.claude/commands/`) still exist and still work. They're just a worse fit here: a command only runs
when you type it, while a skill can also be chosen automatically.
