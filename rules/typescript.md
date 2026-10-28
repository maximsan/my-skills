<!-- stack-rules: typescript · main copy: projects/prompts/rules/typescript.md -->

# TypeScript conventions

True of **all** my TypeScript, not of any one project. `claude-rules add-app` points each TypeScript app's
`CLAUDE.local.md` at it.

**Most type discipline is not in this file, and shouldn't be.** `strict`, `noUncheckedIndexedAccess`, no `any`, no
`@ts-expect-error`, and no non-null `!` are all `tsconfig` and eslint settings. A setting can't be skimmed past.
See [templates/typescript-setup.md](../templates/typescript-setup.md) to switch them on. What's below is only
what tooling can't decide for you.

---

## Types describe the domain, not the payload

`status: string` is the shape of the JSON. `status: "draft" | "sent" | "paid"` is the thing itself. It makes the
impossible state unrepresentable, not merely undocumented.

Prefer a discriminated union over an object where three fields are optional and only certain combinations are real.

## Parse at the boundary; don't assert past it

Anything crossing into your code untyped — a response, `JSON.parse`, `localStorage`, a query param — gets validated
once, at the edge, into a real type. After that it's trusted and needs no guards.

Use `unknown` and narrow it, never `any`. `any` disables checking everywhere the value travels. `unknown` forces the
question at the one place it matters.

## Never widen a type to make an error go away

An `as`, a `?`, a loosened union, or a `!` added because the compiler complained is the same failure as a guard you
can't source. In both, you didn't understand what was wrong and hedged instead. **The compiler was right.** Find out
what it knows that you don't.

A type assertion is a claim you know better than the checker. It needs the same evidence a guard does. Say what
makes it true, or don't write it.

## Derive types, don't restate them

Keep one source of truth, and derive the rest from it with `ReturnType`, indexed access, and `satisfies`. A
hand-written duplicate of a type that already exists is the same defect as a second file doing an existing file's
job. Both drift, and the stale one is believed.

## Tests run on Jest

Jest is the test runner unless the app's existing tests use another one. The nearest existing test file decides.
