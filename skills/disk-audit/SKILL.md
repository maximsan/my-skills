---
name: disk-audit
description: "Audit disk space and propose a cleanup. Use when the disk is nearly full, a free-disk check fails, the user asks what takes space or grew, or asks which worktrees can go."
---

# Disk audit

Measure first, verify each candidate, ask, then delete and measure again. Both scripts only read.

## Steps

1. **Measure.** Run this in the background, because it takes minutes:

   ```bash
   node ~/.agents/skills/disk-audit/disk-audit.mjs
   ```

   Done when you can name what fills the disk, what grew, and how much stayed unmeasured.

2. **Sort the worktrees:**

   ```bash
   node ~/.agents/skills/disk-audit/worktree-audit.mjs [folder holding your repos ...]
   ```

   Done when each worktree has a status. Reference below says which statuses are candidates.

3. **Look for a project's own cleaner.** Each repo may already have one: search its `tool/` and `scripts/` folders and its `docs/` for disk or cache cleaning, and read the rules it enforces on worktree location. Prefer that tool over a hand-made command. Done when every repo holding a large candidate is checked.

4. **Verify every candidate** against the traps below, in the same turn you call it safe. Done when each candidate has a checked reason it is safe, or moves to the list that needs the owner's decision.

5. **Ask.** Show one list of rebuildable items and one of items that need a judgement, each with its size and what the owner loses. Delete only what the owner picks.

6. **Delete and report.** Read `df` before and after each group, and report those real differences as the saving. Name any estimate that missed, and confirm the affected tools still run.

## Worktree statuses

- `merged`: inactive for a week, and the work is in the default branch. The strongest candidate.
- `pushed, not merged`: inactive for a week and recoverable from GitHub, but possibly unfinished research or an open pull request. The owner decides.
- `recent`, `unpushed`, `has changes`, `in use`: keep the folder. A `recent` worktree may have just started, on a commit already in the default branch.
- A date in the Codex chat column means an open conversation points at the folder. Say so when asking.
- Remove with `git worktree remove <folder>`, without `--force`, so git refuses a folder holding changes. The branch stays.

## Traps

- **An updater process is running.** A `ShipIt` or similar process may be waiting to install the files you found. Read its state file and its process list before calling an update download a leftover.
- **Temp-folder clones.** `/private/tmp` may hold the only copy of an agent's commits, and `origin` there can be another temp clone. Have those commits pushed before any restart.
- **Swap.** A restart returns swap space, so advise it only after the temp clones are safe.
- **Shared disk blocks.** `du` counts blocks shared between clones of a file in full. Deleting `node_modules` or a package store can free far less than `du` showed, so treat those sizes as a ceiling.
- **Simulators.** `simctl` reports a smaller size than a deleted runtime can free, because part of it sits in protected folders.
- **History.** `~/.codex/sessions`, `~/.claude/projects` and app databases such as Cursor's `state.vscdb` hold conversations. List them as kept.
- **Personal folders.** Report sizes for `Documents`, `Pictures` and `Movies`, and leave each decision about them to the owner.
- **Unmeasured space.** Name the protected folders the first script lists. The owner can read them in System Settings, under General, then Storage.
