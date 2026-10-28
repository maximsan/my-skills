---
name: task-learn
description: This skill should be used when the user says "wrap up" at the end of a task, or asks "what should we remember". Saves what the task taught in docs/ai/.
---

# Learn

Save what this task taught that the next session couldn't work out from the code. Most tasks teach little or
nothing worth saving. **"Nothing to save" is a normal result, not a failure.** Say it in one line and stop.

## What goes where

| File | Who writes it | What's in it |
|---|---|---|
| `NOTES.md` | this skill, after approval | The Exemplars table at the top, then notes that stop the next session going wrong |
| `FEEDBACK.md` | this skill, after approval | One row per correction the user made, then the rules proposed for things that happened twice |
| `CONTEXT.md`, `GLOSSARY.md` | the user only | Read them if they exist. Never write to them. |

Create no other file in `docs/ai/`. Create one of these two only when there is something approved to put in it.

A glossary row can be suggested, never written. Suggest one only for a business word the user actually used that
maps to a different name in the code. Quote where they said it. The user decides whether to add it.

---

## Step 1 — Collect what happened

Read the task folder: `task.md`, `findings.md`, `plan.md` (Deviations and Backlog), `progress.md`, `debug.md`,
`review.md` (Decisions), and the diff.

List every candidate, each with the line it came from. **These are the only sources:**

| Source | What to look for |
|---|---|
| `progress.md` | `Learned:` lines |
| `progress.md`, `plan.md` | `⚠️ Assumed:` lines that turned out wrong |
| `debug.md` | The confirmed cause, and anything ruled out that looked likely |
| `review.md` | Findings marked **won't fix**, with their reason — a thing that looks wrong and isn't |
| `plan.md` | Deviations — where the code turned out different from what the plan expected |
| this chat | Corrections the user made. Quote their words. |

**Nothing else is a source.** Something noticed while reading the code isn't one. Neither is a summary of what
the task did, or a guess at what a business term means. If the line a candidate came from can't be pointed
at, it isn't a note.

## Step 2 — Keep only what would mislead

For each candidate, ask one question: **would the next session get this wrong by reading the code?**

Keep:

- code that looks wrong but isn't, and why it's right
- behavior that can't be seen from the call site, like a silent retry or a null that means something different from `[]`
- an approach that was tried and rejected, and why — so nobody picks it again
- the file to copy for a kind of file. That's an Exemplars row, not a note.

Drop:

- anything a minute of reading the code shows
- what the task changed. Git already records it.
- anything that is only true today, like a broken build or a pending migration

Most candidates get dropped. That's expected.

## Step 3 — One fact, one note

Before writing a note, grep `docs/ai/` for every file and function name it points at:

```
grep -rn "useSavedCards" docs/ai/
```

- **A hit that says the same thing** — stop. Don't add it.
- **A hit that's now wrong** — rewrite that note.
- **A hit about the same code** — extend that note.
- **No hit** — add a new one.

Never write one fact twice, in different words or in different files.

A note looks like this:

```
### If a wallet looks empty but the page crashes
The cards API returns [] for an emptied wallet and null for a new account. Guard for both.
src/payments/useSavedCards.ts → useSavedCards() · source: ORD-412 debug.md C2 · 2026-08-10
```

- **The heading says when someone would need it**, not what it's about. Nobody looks up "Login — retry logic". Someone
  about to add a retry does look for "If you're about to add a retry in src/auth/".
- **Name functions, not line numbers.** `useSavedCards.ts → useSavedCards()` can be found by searching months later.
  A line number is wrong after the first edit above it.
- **Say how it behaves. Don't paste code.** Pasted code goes stale and still looks convincing.
- **The source line is required.** It shows the note was earned in a task, not filled in.

If a note could be a lint rule, a type, or a test instead, propose that. Delete the note once the code lands. Code
can't be skimmed past, and `NOTES.md` should stay about the same size over time.

## Step 4 — Check old notes against the code

`NOTES.md` starts with a line like this:

```
<!-- checked against: a3f9c21 on 2026-08-06 -->
```

Ask git which notes may have gone stale:

```
git diff --name-only a3f9c21..HEAD
```

Every note that points at a file in that list gets re-checked. Fix it or delete it. The rest are untouched and can
be trusted. Then update the commit and date in the header.

If the file has no header yet, add one with the current commit and today's date. There's nothing to check against
yet, so don't claim a check that wasn't done. If the commit is too old for a usable diff, say so, and check the oldest
notes instead.

`FEEDBACK.md` doesn't get this header. It's a log, and nothing in it describes the code.

## Step 5 — Corrections and repeats

`FEEDBACK.md` has two sections: `## Corrections`, then `## Proposed rules`. A repeated correction leads to a
proposed rule, so the rule sits in the same file as the rows that justify it.

### Corrections: one row per correction

A correction is the user saying that something the agent did was wrong. **Quote their words in the row.** No quote,
no row. A mistake the user didn't point out goes in `progress.md`, not here.

If the file doesn't exist yet, create it with both headings, and the header row and separator under the first:

```
## Corrections

| date | tag | what the user said → what the agent had done | status |
|---|---|---|---|
| 2026-08-06 | shallow-read | "that's not what the hook does, read it" → summarised useLogin from its name | open |

## Proposed rules
```

Tags: `shallow-read` · `missing-rule` · `unclear-request` · `wrong-assumption` · `forgot-existing-file` ·
`scope-creep` · `said-done-but-wasnt` · `wrong-convention`

`open` means nothing's been fixed yet. When a fix lands, change it to `fixed: <what changed, where>`.

**Read the existing rows first.** If the same tag and pattern are already there, this is the second time. Propose a
rule under `## Proposed rules` instead of logging it again.

**If there are 10 or more `open` rows below the last `reviewed to here` line, review them before finishing**,
following [`feedback-review.md`](feedback-review.md). With no such line yet, count the whole file.

### Proposed rules: only for repeats

Suggest a rule only for a repeat (see *Suggest new rules and skills* in the common rules), with the evidence. Say
whether it's specific to this project or true everywhere. Write it with the `rule-author` skill.

## Step 6 — Propose, wait, write

Show everything in one list:

```
NOTES.md
  + If a wallet looks empty but the page crashes — source: debug.md C2
  ~ If you're about to add a retry in src/auth/ — rewritten: now retries twice
  - The basket store is global — deleted: basketStore.ts removed in this diff
FEEDBACK.md   none — no corrections this task
FEEDBACK review  under 10 open rows
Proposed rules  none
Dropped:      4 candidates — 3 visible from the code, 1 only true today
```

The `Dropped:` line proves the filter ran. At 10 or more open rows, the `FEEDBACK review` line names the top tag
and the one change from `feedback-review.md`. `none` is a normal answer in any row.

**Write nothing until the user approves.** Then write only what they approved. If a proposed rule was
approved, say how many are now waiting in `FEEDBACK.md`. A proposal nobody is told about is a proposal nobody reads.

## Step 7 — Say what was wrong with the instructions

Look back at the skills that ran this task.

- Which instruction was vague, or easy to appear to follow without really doing it?
- What was done well that nothing asked for — and should be added?
- Which instruction forced work that was pointless here?

Two or three sentences. Be blunt. These files are meant to be edited.
