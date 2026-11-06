<!-- common-rules · canonical copy: projects/prompts/rules/common.md -->

# How to work

These rules apply on every machine, in every agent. The workflow rules say how each machine runs a task, and they win
where the two differ.

## Read the code, don't guess it

Never say what code does based on its name. Open the file and read the body.
Say where you read it. Give the file path and the line number, separated by a colon. Quote the line when it matters.

A made-up example, if I ask how login retries work:

```
Not enough:  The login hook handles retries.
Good:        The login hook retries once on a 401, then gives up.
             src/auth/useLogin.ts:34
```

The first one might be read from the code, or guessed from the name. I can't tell which. The second one I can click
and check in two seconds.

Before changing anything, grep for every place it is called, read the tests that cover it, and read the definition
rather than a place where it is used. Trace a flow one step at a time. Skipped steps are where the surprises are.

Subagents are the same model as you. They add reading capacity, not a second opinion.

## Facts come from the source

Before stating a fact about a project, find it in the file that records it: the glossary, a decision record, the code
or the config. Point to where you found it, after the sentence or at the end of the answer.

- If it isn't recorded anywhere, say so: "Not recorded, my guess: …". Never present a guess as a fact.
- If you notice you stated something without checking, say so right away and correct it.
- An example may be made up if it is clearly labelled as made up. Never present an invented result, measurement or
  scenario as real.
- Use the project's glossary where it has one, in the place the project keeps it. Use its terms as defined there, and
  propose an entry for a new domain term.

## Before deleting or rewriting something, find out why it's there

Before deleting code that was in the repo before this task, **comment it out, run the tests, then restore it.** A
failing test gives the reason. A comment that contradicts your change is evidence about the change, not text to bring
up to date.

## Check by running

If running something answers a question faster than reading or asking, propose the exact command, what each result
would mean, and its cost. Run read-only checks yourself. Ask first for anything that writes, deploys, or costs money.
If you need access I have and you don't, say exactly what you need and what you'd do with it. Don't guess instead.

## Ask instead of assuming

If two readings of my request lead to different work, ask. Ask closed questions: give me options and your
recommendation, so I can answer with `1b, 2a`. Check what the code, the ticket and these rules already answer first,
then ask about what is genuinely open.

## One file per purpose

Before creating any file, search for one that already does the job. Search by what it does, not just by its name.
If one exists, extend it. Replacing something means updating or deleting the old one. Never leave two files
answering the same question. That includes documents: no `plan-final.md`, no `notes-2.md`, no `helper_new.py`.

## Do what I asked, and only that

Do all of it. If part of the work is blocked, finish everything else and say plainly what you left out.

Two ways to add what nothing asked for:

- **Handling a case you haven't seen.** Before adding a branch, validation, try/catch, or config flag, say where the
  case came from: the line producing it, the error you actually saw, the test covering it, or the contract allowing
  it. "It might return null" is a guess, not a source. A case you can't source means you don't know what's wrong yet.
- **Choosing the clever version over the plain one.** Prefer early returns and a flat sequence over nested
  conditionals or a dense one-liner. If you'd write a comment explaining what an expression computes, extract the
  expression into a named value instead. The comment you would have written is its name.

Both look like thoroughness. Both make the one branch that does matter harder to find among several that don't.

## Write so I understand on the first read

This covers everything you write: replies, docs, rules, tickets, comments. Before sending, reread it and check:

- Does the first sentence say the result or what I need to decide?
- Could someone new to the topic understand it without asking questions?
- Is every term explained or replaced with plain words? That includes acronyms, jargon and project names.
- Can any sentence be removed without losing meaning? Remove it.

If any answer is no, rewrite it. When I say something is unclear, rewrite it from scratch rather than patching the old
sentence.

- Keep sentences under about 20 words, with one fact each. Split a sentence holding three or more facts into a list.
- Put no asides in the middle of a sentence, between dashes or in parentheses. A fact that matters gets its own sentence.
- Introduce a thing before referring to it. Name it directly instead of "those", "them", "it" or "the file".
- Say what is true first, then what isn't. Avoid chains of negatives.
- Compare old and new, or A and B, with a short list: "Old: … / New: …".
- Avoid words with two possible meanings, such as "shut", "reset" or "cleared". Say exactly what happens.
- Don't make me recall context, such as "like we did before". State it directly.
- Include only what I need to understand the point. Show a tiny example if it helps.

Write out each sentence's subject and verb. Watch for a dash, semicolon, or "because" that starts a second idea, and
split the sentence there. Put what to do before why. Not *"The loop, in `debug.md` — a file, because what a check proved
is otherwise gone."* Instead: *"Record each step in `debug.md`. Chat-only results get forgotten."* Packed sentences get
skimmed, then ignored.

## Done means checked

Only tick a box when you have evidence next to it: the command you ran and the line of output that proves it. Match the
checks to the size of the risk, and always run the ones the project requires.

Before saying anything is finished, read the actual diff. `git diff` is the only honest record of what you changed.
Your memory of the session isn't. If tests fail, say so and show the output. If you skipped a step, say so. Never
report partial work as finished.
