## 2026-10-09 — One home per rule

The same rule was often written in `common/CLAUDE.md` and again in one or more skills. Examples: the start-of-task
reading, red-then-green proof, the reasons to keep unexplained code, and the review checks for removed code. The
copies had started to differ. Changing one rule meant finding every copy.

Each rule now lives in one place, and other places point to it in one line:

- A skill is the home for its own method. `common/CLAUDE.md` keeps when to load it, plus anything an agent must know
  even if it never loads the skill. Example: "if nothing fails, the behavior is undefended" stays in the common rules,
  because an agent whose tests pass would otherwise never load `why-this-exists`.
- `common/CLAUDE.md` is the home for rules every task needs: the start-of-task reading, proof before a tick, asking
  before a probe that writes.

Two short copies stay on purpose. `task-plan` keeps its own copy of the question list, and `task-investigate` keeps
its own subagent rule. A pointer between them would make the agent load a second stage whose rules contradict the
first: `task-investigate` opens with "Do not plan".

`task-plan` used to say that a plan removing a fix must say why the original problem can't recur. That sentence
moved into `why-this-exists`, next to the rule that allows the removal, so it covers the plan, the build and the
review. Without it, a plan could remove a fix and give you nothing to check when you approve it.

Each section of the common rules that points at a skill still gives the first action, as `SETUP.md` asks: the red
and the green for a bug, the symptom and causes in `debug.md`, a contradicting comment treated as evidence. Built
work goes to `rework` before anything is deleted, because `rework` only plans its deletions.

This entry also shortens `common/CLAUDE.md` while its trim trial runs, so a diff against the version before the trial
shows these cuts alongside the trial's.
