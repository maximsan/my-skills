## 2026-09-24 — One notes file, and every note needs a source

In real use, `task-learn` filled every `docs/ai/` file with the same information in different words. GLOSSARY
filled up with terms nobody had discussed. The user saw no value in any of it.

### The skill was shaped like a form

Step 2 gave five files, each with a category. A model given five labelled slots fills five slots. The categories
also overlap: "code that looks wrong but isn't" and "why it's built this way" are often the same fact. So one
finding got written three ways.

The topic files also contradicted the skill's own best rule, "file notes under when you'd need them, not what
they're about". Five files split by topic are exactly "what they're about". So `PATTERNS.md`, `GOTCHAS.md` and
`DECISIONS.md` are now one `NOTES.md`. Its headings carry the "when", and the Exemplars table sits at the top.

### Nothing could say no

`common/CLAUDE.md` said "never skip `task-learn`", and the skill opened with "real work, not paperwork". A step that
must run, with no approved empty result, produces something every time. "Nothing to save" is now stated as normal,
in both places.

The old quality filter couldn't be checked either. "Cost real time to find" is self-assessed, and the answer is
always yes. Now every note cites the event in the task that produced it: a `Learned:` line, an assumption that
proved wrong, a quoted correction, a review won't-fix, or a confirmed debug cause. It's the same test as the rule
against unsourced guards, applied to notes. The proposal also has to show a `Dropped:` line, which proves the filter
ran.

A grep of `docs/ai/` for the code a note points at comes before writing it. That's what stops the same fact landing
twice.

### CONTEXT and GLOSSARY belong to the user

Nothing in a task is a real source for "how the system fits together", or for what a business word means. The
agent was inventing both. They're now written by the user and only read by the agent. A glossary row can be
suggested, but only for a word the user actually used, with the quote.

### Existing apps get a one-time prune

Changing the skill doesn't clean what it already wrote. Prune mode merges duplicates across the old files, deletes
unsourced and stale notes, moves survivors into `NOTES.md`, and flags glossary terms that no `task.md` mentions.
Nothing is deleted before the user approves the table.

### This muddies the common-rules trial

`FEEDBACK.md` rows now need the user's words quoted, where before the agent could log its own mistakes. Expect fewer
rows from here on, whatever the rules do. When comparing against the version before the trial, compare the tag
*mix*, not the raw counts.
