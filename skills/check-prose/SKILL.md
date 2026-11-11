---
name: check-prose
description: "Check prose against the writing rules before it goes out. Use it on any Markdown a person will read: an issue body, a PR body, an ADR, a doc."
---

# Check prose before it goes out

Run this on anything a person will read, before it is written or published.
That means a `docs/` file, an ADR, an issue body, a PR body, or a change
summary. Not a scratchpad note, and not source code.

```bash
node ~/.agents/skills/check-prose/check-prose.mjs <file> [<file> ...]
```

A body that is going to `gh issue edit` or `gh pr edit` is already in a file
for `--body-file`. Check that file. For one already published, fetch it first:

```bash
gh issue view <n> --json body --jq .body > /tmp/body.md
```

Fix every finding, then run it again. Publish when nothing is left but
word-count warnings you have read and chosen to keep.

## What it checks

These, all from the global `CLAUDE.md` writing rules:

- an aside between two dashes, which welds two facts into one sentence
- a sentence over 25 words, which is a warning and not a rule
- a `that X` where X was never named before it
- a phrase asking the reader to recall something
- an acronym never expanded
- a ticket named by its number alone
- a count of parts of the code or the work, such as "seven places" or "52 unit
  tests", which goes stale as the code changes. Name the things, or say "every"
  or "the places that…". A count that cannot go stale passes when sent again.
  The hook on AskUserQuestion skips this check, because a question is not kept.

`check-prose.test.mjs` holds an example of each rule:
`node --test`, run from this folder.

## The word count is a warning

A sentence over the limit is a prompt to look, not a fault to fix. Read it and
ask whether it carries more than one fact. Split it if it does. Leave it if it
does not, because a split that makes prose worse is not an improvement.

The other five checks are faults. Fix those.

## What it cannot check, so you still have to

**The claims.** The script reads shape, never truth. A short, plain, well-formed
sentence that is wrong about the code passes every check. Before you explain
why code does something, open the thing that governs it. That is the test,
the ADR, the glossary or the ruling. Write what is there. Do not write the
reason that sounds right.

Two real examples of what it misses:

- "The longer lesson is the better score." Plain and clean. It was not the
  reason the code preferred a larger total. The reason was in a test.
- "Two devices each holding a score." Plain and clean. The app had no sync at
  all, so it described something that could not happen.

**The four questions.** Ask them of every text, and rewrite from scratch when
one fails:

- Does the first sentence say the result, or what the reader must decide?
- Could someone new to the topic understand it without asking?
- Is every term explained or replaced with plain words?
- Can any sentence be removed without losing meaning?

**Five checks the script skips.** Each needs a reader. The examples are the
ones the writing rules give.

- An aside in parentheses. The script cannot flag these, because source
  pointers such as "(source: GLOSSARY.md)" are parentheses too.
  Bad: "The old saved value (the `bestScore` the glossary tells you to avoid)
  can't be converted."
  Good: "The old saved value, `bestScore`, can't be converted."
- A chain of negatives. Say what is true first.
  Bad: "It could not be turned into this pair, and neither number was kept."
  Good: "Lesson scores are now saved as two numbers: correct answers and
  graded cards (e.g. 7 of 10). The old value measured something different."
- An old-versus-new comparison written as one sentence. Use a list.
  Bad: "It counted first attempts across every step of the lesson and allowed
  retries, whereas a score now comes from one attempt at each graded card."
  Good:
  - Old: percentage of first-try answers across all lesson steps, with
    retries allowed.
  - New: one try per graded card.
- A project term used without its definition on first use.
  Bad: "Only graded cards count."
  Good: "Only graded cards count. A graded card is a lesson card with a right
  or wrong answer, such as a quiz."
- A word with two meanings, such as "reset" or "cleared". The script skips
  these because they are domain terms in some repos and would fire on every
  use. Say exactly what happens instead.

**Replies.** Nothing checks the text you write to a person. The same rules
apply to it.

## Tuning it

`WORD_LIMIT` is 25. The writing rules aim at about 20 words; the script
reports only sentences clearly past that, so a 22-word sentence with one fact
is never a finding. `ACRONYM_ALLOWED` holds the acronyms a reader is expected
to know, including size units. An acronym beside a capitalized word, such as
`VS Code`, passes as a product name. `POINTS_BACK` holds the nouns treated as pointing backwards. It is
deliberately short. A wider list flagged `a lesson that short` and `the first
one that differs`, where `that` points at nothing.
