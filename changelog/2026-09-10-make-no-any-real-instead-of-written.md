## 2026-09-10 — Make "no `any`" real instead of written down

There was no rule against `any` anywhere in v2. It appeared once, as an *example* inside SETUP.md's
"could eslint check it instead?" list — routed to lint by an earlier change and then never written. Total
TypeScript coverage was two bullets in `react.md`. This closes that.

### Banning the word isn't banning the unsoundness

`any` mostly doesn't arrive by someone typing it. It arrives from `JSON.parse`, a `catch` clause, an
untyped dependency, an `axios` response — and `no-explicit-any` sees none of that. Catching the rest
needs the type-aware `no-unsafe-*` family, which needs `parserOptions.project` and runs slower. That
cost is the point of the exercise; without it the config looks finished and isn't.

Banning `any` while leaving `as` and `!` open just relocates the hole to `as unknown as Foo`, which
is harder to grep and easier to wave through. The escape hatches are closed in the same block.

### Two profiles, not one

Turning full strict on in a mature codebase surfaces hundreds of errors at once, which is how this
kind of change gets abandoned; insisting on a gentle ratchet in a greenfield app gives away
something free. So `per-project/typescript-setup.md` has both: everything on from day one for a new
app, and for an existing one a ratchet where new and changed code is clean while existing violations
are baselined and the baseline may only shrink.

There's a deliberate escape hatch. An absolute ban with no valve gets worked around silently and the
workaround is worse — so the rare genuine case goes through a disable line carrying a reason, which
is visible and greppable. A bare disable is a review finding.

### The written rule is deliberately thin

`stacks/typescript.md` holds only what tooling can't decide: types describing the domain rather than
the payload, parsing at the boundary instead of asserting past it, deriving types rather than
restating them, and **never widening a type to make an error go away** — which is the same failure as
a guard you can't source, wearing type clothing. You didn't understand, so you hedged. The compiler
was right.

Split out of `react.md` rather than added to it: that file was at its 50-line cap, and TypeScript
applies beyond React anyway. Both are now comfortably under.

### The smallest change here is probably the most useful

`task-implement` Step 8 said to run build, lint and type-check and *"report each"* — which permits
handing over a red type-check with the failure noted politely underneath. For "all changes must be
correctly written" that has to be a gate, so it now says a failing type-check is unfinished work
rather than a finding. The per-project template gained the real commands, because "run whatever this
repo needs" is unactionable without them.

Everything in tiers one to three lives in the app repos. Until someone switches it on there, this is
the same documented-but-inert state it replaced.
