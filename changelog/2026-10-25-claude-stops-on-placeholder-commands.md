## 2026-10-25 — Claude stops on placeholder commands

Claude can't check a change without an app's build and test commands, and it guessed them when `CLAUDE.local.md`
still held `<placeholders>`. Before its first edit in an app, the common rules now make it name the placeholders and
wait. `doctor` names them too, as a warning.

Rejected: stopping Claude, or blocking `add-app`, when an app has no stack rules. The skills are used on a managed Windows environment
for now, and rules about stacks must never block or stop anything. Warnings about other stacks, such as Vue, were
dropped for the same reason.
