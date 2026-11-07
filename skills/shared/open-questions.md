# Open questions

Read by `task-investigate` and `task-plan`. Go through the list and write down every question that comes up,
**including ones that can be answered without the user**. Write them all first. Sort them second.

- What's in scope and what isn't
- What shape the input is, and where it comes from
- What should happen on errors and edge cases
- Whether old data or old clients need to keep working
- Limits: speed, size, things happening at once
- What should be logged
- Who's allowed to do this
- Wording and behavior the user sees
- What "tested" means here
- Who owns this code
- Config and feature flags

## The three kinds

**ANSWERED**: the code, the ticket or the rules already answer it. Cite the file and line, or the ticket line.

**QUESTION**: only the user can answer it. Ask before planning or building on it, as a closed question with options
and a recommendation. A sensible default is the recommendation, not the answer.

**PROBE**: faster to answer by running something than by reading or asking. Write it like this:

```
Run:    npm test -- src/auth/useLogin.test.ts
If it passes → the retry already works, and the bug is elsewhere
If it fails  → the retry is the bug
Cost:   ~20 seconds, changes nothing
```

Every question written down gives three things: the question, the proposed answer, and what would change in the
plan if the answer were different. Every probe that ran gives what it actually showed. Every answer the user gave is
recorded next to its question, with the date.
