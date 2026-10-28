# Turning on TypeScript enforcement

Copy these into an app. This is where "we mustn't use `any`" actually gets enforced. A written rule asking for it
is the weakest version. It can be skimmed, and nothing fails when it is.

**Two profiles, because a new app and a five-year-old one need different answers.** Pick before you start.

---

## Why `no-explicit-any` on its own doesn't work

This is worth knowing before you configure anything, because the half-measure looks finished.

`any` mostly doesn't arrive by someone typing it. It arrives from `JSON.parse`, a `catch` clause, an untyped
dependency, an `axios` response. `no-explicit-any` sees none of that. It bans the *word*, not the unsoundness.

Catching the rest needs the **type-aware** `no-unsafe-*` rules. Those need `parserOptions.project`, and they're
slower. That's the real cost of this, and it's the part worth paying for.

Ban the escape hatches together, or don't bother. Banning `any` while leaving `as` and `!` open just relocates it.
`as unknown as Foo` is the same hole, and it's harder to grep and easier to wave through in review.

---

## Profile A — a new project

Everything on from day one. There's no existing code, so it costs nothing now and is unaffordable later.

```jsonc
// tsconfig.json — compilerOptions
{
  "strict": true,                          // the big one: noImplicitAny, strictNullChecks, and six more
  "noUncheckedIndexedAccess": true,        // arr[i] is T | undefined. Highest-value non-default flag.
  "exactOptionalPropertyTypes": true,      // `foo?: string` stops silently accepting `undefined`
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noImplicitOverride": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

```js
// eslint — needs type information, so set parserOptions.project first
"@typescript-eslint/no-explicit-any": "error",
"@typescript-eslint/no-unsafe-assignment": "error",   // the five that catch `any` arriving
"@typescript-eslint/no-unsafe-member-access": "error", // from outside your own annotations
"@typescript-eslint/no-unsafe-call": "error",
"@typescript-eslint/no-unsafe-return": "error",
"@typescript-eslint/no-unsafe-argument": "error",
"@typescript-eslint/ban-ts-comment": "error",          // closes @ts-ignore / @ts-expect-error
"@typescript-eslint/no-non-null-assertion": "error",   // closes `!`
"@typescript-eslint/consistent-type-assertions": ["error", { "assertionStyle": "as", "objectLiteralTypeAssertions": "never" }],
"@typescript-eslint/no-unnecessary-condition": "error" // finds guards for cases that can't happen
```

That last rule is worth noticing. It's the lint version of "don't handle a case you haven't seen". It can prove the
case is impossible, where a written rule can only ask.

## Profile B — an app that already exists

This reaches the same destination without a stop-the-world cleanup. Turning all of the above on in a mature
codebase surfaces hundreds of errors at once. That is how this kind of change gets abandoned.

**The rule: new and changed code is clean; existing violations are recorded, not fixed.**

1. **`strict: true` first, alone.** Everything else waits. If even this is too big, `noImplicitAny` and
   `strictNullChecks` can go on separately. Those two are most of the value.
2. **Baseline what's already broken** rather than fixing it. Use whatever your linter offers:
   `--suppress`, an ignore file, or a committed error snapshot. The baseline may only shrink. A CI check that it
   never grows is the whole mechanism.
3. **Add the eslint rules as `warn`, then promote to `error`** once the count for that rule reaches zero.
4. **Then the extra `tsconfig` flags, one per cycle**, in this order: `noUncheckedIndexedAccess`,
   `exactOptionalPropertyTypes`, then the rest. Each is its own piece of work with its own baseline.
5. **Delete baseline entries as you touch those files.** Never delete them in a batch. Each deletion belongs to
   whoever is already in that file.

Record which stage you're at in the app's `CLAUDE.local.md`, or the next session re-litigates it.

---

## The escape hatch, on purpose

An absolute ban with no escape hatch gets worked around silently. The workaround is always worse than what was banned.

The rare genuine `any` — some generic constraints, some declaration merging — goes through a disable line **with a
reason on it**:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <lib> types this as any; narrowed at the caller
```

Visible, greppable, and reviewable. Bare disables with no reason are a review finding.

---

## Then make it a gate

Configuration nobody runs is documentation. Type-check and lint must **fail the build**, not print a warning
someone scrolls past. The same applies to Claude. A failing type-check is unfinished work, not a note in a report.

Put the real commands in the app's `CLAUDE.local.md` Commands block, so "run whatever this repo needs" has an answer:

```
<type-check>          e.g. npx tsc --noEmit
<lint>                e.g. npx eslint . --max-warnings 0
```
