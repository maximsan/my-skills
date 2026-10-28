## 2026-09-01 — Sharpen the unsourced-guard rule

"Write only what the task needs" landed earlier today treating defensive code as over-engineering —
someone being thorough about cases that can't arise. That diagnosis was incomplete. The likelier
mechanism is that the guard is a **substitute for diagnosis**: not knowing why something breaks, then
writing three defensive branches hoping one covers it.

That distinction matters because it changes which rule should catch it, and neither did.

"Debug, don't guess" is the rule for not knowing, and it can't fire here — it triggers after *two
failed attempts*, while the scattergun guard usually happens on the first, appears to work, and never
registers a failed attempt at all. The counter never starts.

And the first version of this rule was too weak to catch it either. "Name the specific input the
code shows can occur" is satisfiable with a plausible guess — *"the API might return null"* names an
input without having seen one. Nameability isn't evidence.

So the test is now the **source**, not the name: the line that produces the case, the error actually
seen, the test covering it, the contract allowing it. And the unsourced guard is reframed as a
signal rather than a safeguard — it means you don't know what's wrong yet, which routes straight
into the diagnosis loop without waiting for two visible failures.

`task-review`'s matching line changed with it. It previously flagged speculative handling as
residue, filed with dead code and unused imports. It now asks where the case came from and says a
guard with no answer is a **correctness** finding, not a tidiness one — because what it's evidence
of is a cause nobody found.
