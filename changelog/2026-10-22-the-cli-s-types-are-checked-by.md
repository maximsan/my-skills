## 2026-10-22 — The CLI's types are checked by `npm run check`

Every CLI file started with `// @ts-check`, but only an editor ever read it. The types live in doc comments, in the
JSDoc format. When one disagreed with the code, no check failed. `tsconfig.json` now turns on strict checking, and `npm run check` runs `tsc` before the tests.

This reverses the developer guide's "Nothing is installed into the repo" for people changing the CLI: `npm install` fetches TypeScript
once. People using the CLI still install nothing. `npm install -g <clone>` skips development packages, so it still
works behind any proxy. The setup comes from the `common-scripts` repo, where the same check runs.
