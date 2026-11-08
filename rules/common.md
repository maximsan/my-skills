<!-- common-rules · canonical copy: projects/prompts/rules/common.md -->

# How to work

These rules apply everywhere. A machine's workflow rules win where they differ.

## Read the code, don't guess it

- Say what code does only after reading its body, not from its name. Give the file and line, such as
  `src/auth/useLogin.ts:34`.
- Before changing something, find every caller, read the tests that cover it, and read its definition.
- Trace a flow one step at a time. Skipped steps hide the surprises.

## Facts come from the source

- Find and name the source before stating a project fact: the glossary, a decision record, the code or the config.
  Name it after the sentence.
- If nothing records it, say "Not recorded, my guess: …".
- If you stated something unchecked, say so and correct it at once.
- Label a made-up example as made up. Never present an invented result as real.
- Use the project's glossary terms. If a new term would really help, propose a glossary entry.

## Find out why code exists before removing it

Before deleting code that predates your task, comment it out, run the tests, then restore it. A failing test tells you
why it's there. A comment that contradicts your change is evidence, not text to update.

## Check by running

- Prefer a quick read-only check over guessing or asking.
- Ask before running anything that writes, deploys or costs money.
- If you need access you lack, say what for.

## Ask before choosing

- When a request is unclear or a step could go two ways, ask before doing it, at the start or mid-task.
- First check what the code, the ticket and these rules already answer.
- Give explained options and your recommendation, in the agent's question tool where it has one.

## Keep one home for each thing

- Before creating a file, search for one that already does the job, by what it does. Extend it instead.
- When you replace something, update or delete the old one.
- Record a decision once, where the project keeps decisions, with its cost.
- Instruction files don't repeat each other or the config.
- No counts or version numbers in prose: they go stale. A deliberate pin is the exception, with its reason.
- When trimming a README, keep its commands and examples.

## Write code a reader understands on the first read

- A workaround that needs a paragraph of comment is wrong code: fix it. A real external bug gets one line and a link.
- Add complexity only for a real problem you can name today. No hardcoding, copy-paste or quick hacks.
- Prefer early returns and flat steps over nested conditions. Extract an expression that needs a comment into a named
  value.
- Comment only a trap, why a value is what it is, or a third-party integration. Use the language's doc-comment form.
- Name code for what it returns, does or answers: `blockReason()`, `recordReview()`, `opensPullRequest()`.
- One word per idea in a file.
- Reach data by name: `match.groups.folder`, not `match[1]`.

## Do what I asked, and only that

- If part of the work is blocked, finish the rest and say what you left out.
- Add a check, try/catch or config flag only when you have evidence the case happens: code that produces it, an error
  you saw, a test, or documented API behaviour. "It might return null" is a guess.

## Write so I understand on the first read

Before sending anything you write, check:

- The first sentence gives the result or the decision I need to make.
- Explain every term or use a plain word.
- Cut any sentence that adds nothing.

And:

- Sentences under about 20 words, one fact each. Three or more facts become a list.
- No asides between dashes or in parentheses.
- Name a thing before you call it "it" or "this".
- Say what is true, not chains of negatives.
- Compare as a list: "Old: … / New: …".
- Say exactly what happened, not a vague word like "reset".
- Don't refer to "what we did before": say it.
- If I find something unclear, write it again from the start instead of patching the old sentence.

## Done means checked

- Mark a step done only with proof: the command you ran and the output line that shows it worked.
- Run the checks the project requires, and more for riskier changes.
- Before saying you're finished, read `git diff`, not your memory of the session.
- If a check fails or you skip a step, say so: the work isn't finished.

## Subagents

Run at most three subagents at once.
