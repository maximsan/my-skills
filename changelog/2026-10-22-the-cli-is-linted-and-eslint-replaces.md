## 2026-10-22 — The CLI is linted, and eslint replaces prettier

`eslint.config.mjs` holds the CLI's house rules, taken from the `common-scripts` repo. Each rule has its reason
beside it. Two examples:

- A number or a regex inside a function moves to a named constant, so its meaning has a name.
- Every function's doc comment describes each parameter and the return value.

`npm run check` runs eslint before the type check and the tests.

eslint now also sets the layout: blank lines between the parts of a function, braces around every `if` body. The
one-off `npx prettier@3` check is gone. Two formatters on the same files would each undo the other's layout.

Four things differ from `common-scripts`:

- Strings keep this repo's double quotes.
- Only `run.mjs` reads the operating system and the home folder from the process. Every other file gets them from
  `run.mjs`, through the context object each command receives.
- `ui` is allowed as a name, although names must otherwise have at least three letters.
- `scripts/` is not linted: the changelog checker is a repo tool, not part of the CLI.
