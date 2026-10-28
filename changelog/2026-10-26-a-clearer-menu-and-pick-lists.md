## 2026-10-26 — A clearer menu and pick lists

- **Help in the menu prints the help and exits**, like `claude-rules --help`. Before, it showed the menu again below
  the help. That pushed the help's top off the screen, and each Help added another copy above the menu.
- **The pick lists are easier to read.** The highlighted line is bold cyan, and the keys in the key help are cyan.
  The description of the highlighted entry now sits beside it, in magenta. It used to be dim and under the list, and
  some terminals draw dim text almost invisible. In a terminal too narrow for it, it still goes under the list.
- **`add-app` asks about Exemplars in plain words:** "Name an existing file for Claude to copy for each new
  component, hook, store and test? You can skip this." The old question named the Exemplars table and the `create`
  skill without saying what they are.
