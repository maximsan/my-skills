<!-- stack-rules: react · main copy: projects/prompts/rules/react.md -->

# React conventions

True of **all** my React projects, not of any one of them. `claude-rules add-app` points each React app's
`CLAUDE.local.md` at it.

This file holds only what tooling can't express. See [CONTRIBUTING.md](../CONTRIBUTING.md#the-stack-files) before
adding anything.

---

## Components

- **A component renders; a hook holds behavior; a plain function transforms data.** If a component body is doing
  arithmetic or shaping data, that part belongs in a function you can test without rendering.
- **Props types are exported**, next to the component, so a test can type its fixtures from them.
- One concern per hook. A hook that fetches *and* formats *and* tracks is three hooks.

## State and data

- **No data fetching in a component body.** It goes in a hook or a service layer.
- **Server data and UI state stay apart.** Don't copy fetched data into local state so you can edit it. That makes
  two sources of truth, and the stale one eventually wins.
- **Every fetch renders a loading state and an error state.** Not "handles" — renders. A fetch with one branch is
  unfinished.
- **If the app uses a Zustand-style store**, stores have this shape: state and actions typed separately and combined
  at the end, `initialState` exported, and selector hooks so a consumer subscribes to what it uses rather than the
  whole store.

## Testing

- Components are tested with Jest and React Testing Library, unless the app's existing tests use other tools.
- **A test must fail when the behavior breaks.** If you can't say which line you'd break to make it fail, it isn't
  testing anything.
- Find elements the way a user would — by role, then label, then text. A test id is a last resort and needs a
  reason.
- Mock at the boundary — the network, the module edge. Never the thing under test.
- Don't test internal state, implementation details, or a snapshot in place of an assertion.

---

Nothing here yet covers effects, accessibility, or performance. Add rules for them once they've been corrected twice.
A rule you don't enforce teaches Claude that rules are optional.
