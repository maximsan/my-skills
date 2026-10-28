## 2026-10-27 — Examples for `create` and `write-tests`

`create` and `write-tests` each have an `examples.md` now:
- `create`'s shows a component, its Storybook story, a hook that fetches with Apollo, and a Zustand store. A table says when to read a
  store through a selector, and when through `getState()`.
- `write-tests`' tests each of those three. The hook's test fakes Apollo's `useQuery`. The component's test fakes the
  app's own hook, the way the apps' tests do.

The old skill for writing tests had an example, and Claude wrote good tests with it. It was dropped because three of
its tests broke the skill's own rules, and Claude copies an example's shape before it follows written rules. The new
examples follow the patterns of real tests from the apps, with made-up names and data, for a made-up `web-shop` app.
They also follow the React, TypeScript and microfrontend rules where those real tests didn't.

The app's own model file still decides the paths, the imports and the helpers. The example only sets the shape.
**Where the two disagree, the app's file wins.** With no file of that kind in the app yet, the example is the
starting point.

The old example is deleted from `legacy/`. It was copied from work code, and this repo is public. Deleting it removes
it from the current files only: it's still in the git history.
