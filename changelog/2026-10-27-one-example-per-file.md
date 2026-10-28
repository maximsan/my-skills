## 2026-10-27 — One example per file

`create` and `write-tests` split their examples into one file per kind, in an `examples/` folder. Before, creating a
hook loaded the component, the story and the store too, and Claude copies the shape of whatever is in front of it.
Now each skill reads only the example for the file it's making.

- `create`: `component.md`, `story.md`, `hook.md` and `store.md`. A new component also reads `story.md`.
- `write-tests`: `hook-test.md`, `component-test.md` and `store-test.md`. A hook's test now has its own pointer:
  before, the skill said to read the examples only for a component or a store test.
