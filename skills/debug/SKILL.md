---
name: debug
description: This skill should be used when the user asks to "debug this", asks "why does this happen", says "that didn't fix it" after two failed fixes, when a log or probe is needed, or before adding a guard for a case with no source. Finds the cause of a failure with evidence and a ledger. For the regression test once the cause is known, use failing-test-first.
---

# Debug

Find the cause with evidence. The fix comes after, and it's small.

Two things go wrong without this. Checks get run at random, so nothing narrows. And what a check proved lives only in
the chat. Two follow-up questions later it's gone. Then the same ground gets covered again or, worse, contradicted.

**The fix for both is one file: `debug.md`.** Every reply comes out of it.

---

## Where things go

In the task folder, as the common rules define it:

```
investigations/<app>/<TICKET>/
  debug.md             the ledger — short, re-read every turn
  scratch/logs/        raw output, one file per run — never pasted whole into the ledger
```

No ticket? Use `investigations/<app>/<short-slug>/`, and say which slug was picked. If `debug.md` already exists, **this is
a continuation**: read it and carry on from its `Next:` line. Never start a second ledger.

## 1. Pin the symptom

Write it into `debug.md` before anything else:

- **Symptom** — the exact error, or the exact wrong output next to the expected one. Paste it; don't paraphrase.
- **Repro** — the command or steps that show it. If there is none, getting one is the first check.
- **Environment** — branch and commit, and anything else that could make this run differ from the reported one:
  build mode, versions, flags, data.

A symptom that can't be reproduced isn't debuggable yet. Say so, and say what would be needed.

## 2. Hypotheses before checks

List two to four possible causes. For each, write what it **predicts** would show up — something observable, not
"it's the cache":

```
H2  retry fires before the token refresh resolves
    predicts: two POSTs in the log, the second one before "refresh done"
```

A hypothesis that predicts nothing observable can't be tested. Sharpen it or drop it.

## 3. One check at a time

Pick the cheapest check that splits the hypotheses. Before running it, write in the ledger what each result would
mean:

```
C3  log request order in apiClient.post() and refreshToken()
    if H2: POST, POST, refresh done   ·   if not: POST, refresh done, POST
```

**Writing the prediction first is the point.** A result read afterwards can be made to fit anything. A result that
matches none of the predictions means the picture of the code is wrong. Say that, and go back to step 2.

Make one change per run. With two changes at once, there's no telling which one moved the result.

## 4. Logs that answer the question

**Tag every temporary log line** so it can be found, filtered, and removed:

```
console.log("[DBG C3] post", { url, attempt, t: Date.now() });
```

- Log **values, not waypoints.** `here` proves one line ran. The ids, arguments, and results show what happened.
- Log at the **boundaries** of the suspect code: what came in, what went out, and the branch taken.
- Add an order key — a timestamp or a counter — whenever the question is about sequence.

**Write each run to its own file**, so the raw output survives the chat and can be filtered again without re-running:

```
npm test -- src/auth > ../investigations/web-shop/ORD-123/scratch/logs/03-order.log 2>&1
```

## 5. Check the log before believing it

A log proves nothing until it is shown to come from the changed code, on this run. Check, in this order:

1. **Did it run at all?** Count the tags: `grep -c "\[DBG C3\]" 03-order.log`. Zero means the code path was never
   reached, the build is stale, or the wrong target ran. **Zero hits is itself a finding** — often the most
   important one.
2. **Is it this run?** Timestamps, a fresh build, no cached output, the right process. Stale logs from the last run
   are the most common way to "confirm" a hypothesis that's false.
3. **Is an absence meaningful?** A missing line only proves something if the line before it did appear.

## 6. Trim to what matters

Raw logs stay in `scratch/logs/`. **Never read a whole log into the conversation.** Filter it first, by tag, by
error, by the time window around the failure:

```
grep -n "\[DBG C3\]\|Error" 03-order.log | head -40
```

Quote into the ledger only the lines that decide the check, usually under ten. Quote **the filter command that
produced them** with them, so anyone can re-run it. Name the skipped noise (framework chatter, unrelated warnings)
once, so it isn't mistaken for a clue later: `ignored: 40× "act() warning", unrelated`.

## 7. Update the ledger, then reply

After every check, before saying anything:

- the result, with the quoted lines and the filter command
- each hypothesis marked `open`, `ruled out` or `confirmed`, with the check that decided it
- anything now **established** — a fact later steps rely on, with its evidence (`file:line`, or a check id)
- `Next:` — the next check, or the fix

Ruled-out hypotheses collapse to one line each. Keep the evidence, drop the detail. The ledger is read every turn,
so a long one gets skimmed. A skimmed ledger is how things get forgotten again.

## 8. Every reply starts from the ledger

**Before answering anything while debugging — including a follow-up question that seems unrelated — re-read
`debug.md`.** Then open the reply with one line from it:

```
Ledger: H1 ruled out (C1) · H2 confirmed (C3) · H3 open · next: C4
```

That line is how the user sees the ledger was actually re-read. Answer the question from what's established. If the
answer needs something new, run a check and add it. **Don't re-derive a fact the ledger already has, and don't
contradict one without a check that overturns it.** If one is overturned, say so, and mark every conclusion that
rested on it.

If the question changes what is being chased, it's a pivot. Write the pivot checkpoint from the common rules into the
ledger before the first check in the new direction.

## 9. When nothing is narrowing

After three checks in a row that ruled nothing out, follow [`stalled.md`](stalled.md). Name the move it gives in
the ledger's `Next:` line.

## 10. Confirmed means it explains everything

A cause is confirmed when it explains **every** observation in the ledger — the symptom and all the check results —
and has a line to point at: `src/auth/useLogin.ts:48`. If one observation doesn't fit, it's not confirmed yet.

Then:

1. **Reproduce it as a failing test** — load `failing-test-first`. The ledger's repro and the confirming check are
   its inputs.
2. **Remove every temporary log** and show that they're gone:
   `grep -rn "\[DBG " src/` → no output.
3. Leave `debug.md` and `scratch/logs/` in place. They're the record `task-learn` reads.

## What the ledger looks like

```markdown
# Debug — <ticket>: <symptom in one line>

## Symptom
<pasted error or wrong output>  ·  expected: <what should happen>
Repro: <command>   Env: <branch @ commit, anything else that matters>

## Established
- 401 triggers exactly one refresh — src/auth/refresh.ts:22, C2

## Hypotheses
| id | cause | predicts | status |
|---|---|---|---|
| H1 | stale mock | error goes away with real client | ruled out — C1 |
| H2 | retry before refresh resolves | POST, POST, refresh done | confirmed — C3 |
| H3 | double-mounted hook | two "mount" lines | open |

## Checks
### C3 — request order
If H2: POST, POST, refresh done · if not: POST, refresh done, POST
Log: scratch/logs/03-order.log   Filter: grep -n "\[DBG C3\]" 03-order.log
    12: [DBG C3] post {attempt:1, t:...041}
    15: [DBG C3] post {attempt:2, t:...043}
    19: [DBG C3] refresh done {t:...090}
Result: H2 confirmed. Tags counted: 3, from this run (t after build).

## Pivots
<checkpoints, as the common rules describe them>

Next: failing test for the retry order, then remove [DBG] logs
```

## Report

When the cause is confirmed, or when the search has stopped:

```markdown
## Cause
<one sentence, file:line> — or "not found", with what's left open

## How we know
<the checks that decided it, by id, with the quoted lines>

## Ruled out
<one line each>

## Still open
<anything unexplained — "None" only if every observation fits>

## Cleanup
<grep for [DBG with its output>
```
