---
name: using-zod
description: Follow current Zod v4 docs (zod.dev) when authoring or editing schemas, parsing, and safeParse error handling—docs-first, no version-specific cheat sheets.
compatibility: Cursor and other Agent Skills–compatible agents. Intended for codebases on **Zod 4**; if the project is still on Zod 3, use the v3 docs instead of this skill’s v4 assumptions.
metadata:
  spec: https://agentskills.io/specification
  zod-docs: https://zod.dev/v4
---

# Using Zod (v4)

Treat **[Zod v4](https://zod.dev/v4)** and the **[changelog / migration notes](https://zod.dev/v4/changelog)** as the **source of truth** for APIs, formats, error helpers, and deprecations. **Default to what the installed major version’s docs show** for that repo—do not assume Zod 3 APIs or old blog examples.

When something is unclear, open the matching page on `zod.dev` (schemas, formats, error formatting, customization) instead of inventing or memorizing renames here.

## Principles

- **Formats and helpers** — Use **documented entry points** for the major you are on (for v4, that usually means top-level `z.*` helpers for URLs, emails, ISO types, UUIDs, etc., per the migration guide). Prefer current docs over chained `z.string().…()`-style format APIs when the docs mark them legacy.
- **Custom issues** — In `refine` / `superRefine`, follow the docs for `ctx.addIssue` (e.g. `code: 'custom'` where that is the current pattern).
- **Refinement / constraint messages** — Use the **option shapes the docs recommend** for the version you are on (e.g. `error` vs older `message`-only patterns where v4 has moved on).
- **`safeParse` errors** — Use **documented error-formatting helpers** for your major ([formatting errors](https://zod.dev/error-formatting) for v4). Do not assume old instance methods on `$ZodError`; confirm the current API in the docs for that version.

## Optional + preprocess

For trim-then-validate, coercion, or optional normalized input, follow the **preprocess + inner schema** pattern from the official guides for your Zod major.

## Conventions (adapt to each repo)

- **Placement** — Keep schemas next to the boundary they validate (e.g. `config/`, `validation/`, route modules)—follow the host repo’s structure; this skill does not prescribe folders.
- **Types** — Export inferred types with **`z.infer<typeof schema>`** when it improves readability at call sites.
- **Readability** — Use named constants for non-trivial bounds and magic numbers in schemas, per the host project’s style guide.
- **House style** — For “how we write Zod here,” **read existing schemas in that repository**; keep **syntax and deprecations** pinned to **that repo’s Zod version + zod.dev** for that major.
