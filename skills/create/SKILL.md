---
name: create
description: This skill should be used when the user asks to "create a component", or when any new code file is added, including by a plan step. Creates the file from a named model file and the conventions read from it. For a plan, use task-plan. For tests of working code, use write-tests. For rules and skills, use rule-author.
---

# Creating a new file

New files are where conventions break. When editing, the surrounding code shows the pattern. When creating, there
is nothing in the file yet to copy. So "match the local style" has nothing to check it against.

So name the file being copied, and say where each convention came from, **before** writing anything.

---

## Step 1 — Name the model. One file.

```
Model: <path>
```

The nearest existing file of the same kind. Look in this order and stop at the first hit:

1. The **Exemplars** table in `docs/ai/NOTES.md`, if this repo has one
2. The same folder
3. The most recently *added* file of that kind. Run this from the app's folder, so other apps in the same repo stay
   out. It lists added files with their dates, newest first. Skip any path that no longer exists:
   `git log --diff-filter=A --name-only --format=%ad --date=short -- '*<suffix of that kind>' | head -15`

**One model, not an average of several.** Averaging two patterns invents a third that exists nowhere.

If two generations of the pattern are both present, name both with the dates they arrived, follow the newer, and say
so in one line.

**Then read the one example for the kind of file**, in `examples/`:

- a component: [component.md](examples/component.md), and [story.md](examples/story.md) for its story
- a story: [story.md](examples/story.md)
- a hook that fetches: [hook.md](examples/hook.md)
- a store: [store.md](examples/store.md)

It shows the shape the stack rules ask for: what renders, what a hook holds, which states a fetch shows. It never
replaces the model. Paths, imports, names and helpers come from the model file, and **where the two disagree, the
model wins.** With no file of that kind in the app yet, the example is the model, and the convention table names the
example's file in its last column.

## Step 2 — The convention table

Fill this in before any code. Every row gets a `file:line`, and the file has to already exist.

| Convention | What this repo does | Read from |
|---|---|---|
| Folder and filename casing | | |
| Export style — named or default, one per file | | |
| Naming of the thing itself | | |
| Public shape — params, props, types, exported or not | | |
| Errors and logging | | |
| Doc comments — where, and how much | | |
| Test file — location and name | | |
| **What else must be edited for this to be reachable** | | |

Plus these, if it renders UI:

| Convention | What this repo does | Read from |
|---|---|---|
| How styles are applied | | |
| How user-visible text is produced — mechanism and namespace | | |
| How tests hook onto elements | | |
| Where state lives, and the store's shape | | |

Three rules that keep the table honest:

- **`None` is allowed only with the search that proved it.** `None — grepped "useTranslation|i18n" across src/, 0
  hits`. That can be checked. "N/A" can't.
- **The reachability row is the one worth slowing down for.** A file nothing imports is the most common way this
  goes wrong: the component never added to `index.ts`, the route never registered, the locale key never added, the
  handler never wired to the router. Name every file that has to change for the new one to actually run.
- **If the model file and the nearest file in the same folder disagree**, print both rows, follow one, and give
  the reason — newer, same folder, or the plan says so.

## Step 3 — When there's no precedent

If a row has nothing to point at, say so plainly, name the closest analogue found, and state that this file sets the
precedent rather than following one. Don't quietly invent and present it as the local style.

Hand those lines to `task-learn` as Exemplars candidates. They're worth keeping.

## Step 4 — Write it

Copy the model's structure. Then run two checks, one in each direction:

- **Anything the model has that the new file leaves out is a deletion.** Name it and say why.
- **Anything in the new file the model doesn't have needs a reason** from the task. Otherwise it's an invention.

**If the new code has logic with statable inputs and outputs**, `failing-test-first` comes before this step, and
`write-tests` covers what goes inside the test.

## Step 5 — Deviations

Every place the finished file differs from its model, one line each with the reason. **`None` is the expected
answer.** A long list means either the model was wrong or the new file drifted.

## Step 6 — Prove it's wired up

Run this repo's type-check and lint, plus the one command that shows the new file is actually reached — its test, or
the import resolving. Paste the output. A file that compiles but nothing loads is not finished.

## Report

```markdown
## Model
<path> — why this one

## Conventions
<the table, every row with a file:line>

## No precedent for
<rows where this file sets the precedent. `None` if none.>

## Files created or changed
<including everything the reachability row named>

## Deviations from the model
<one line each with a reason. `None` expected.>

## Proof it's wired
<command → output>
```
