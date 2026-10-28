## 2026-09-01 — A consistency pass over v2

Seventeen files written over several sessions, never once read side by side. Six commits, each one
finding below.

### The three lines were sometimes five, sometimes a different three

`common/CLAUDE.md` and `GLOSSARY.md` fixed the opening block at `Skills:/Rules:/Context:`.
`task-investigate` asked for five lines and dropped `Context:`; `task-plan` asked for three but
also dropped `Context:`. So SETUP.md's install check — *"the rules loaded if it opens with three
lines"* — failed against its own skills if your first command happened to be `/task-investigate`.

Made the three a **floor** rather than a fixed set, since the extra lines the stages ask for are
genuinely useful and the alternative is deleting them. `Context:` is now in all three blocks, and
the two skills say "the three lines, plus" so it reads as an addition rather than a competing spec.

### One triage, two vocabularies

`task-investigate` sorted open questions into BLOCKER / ASSUMPTION / PROBE. `task-plan` sorted the
same three into "Hard blocker" / "Reasonable default exists" / "Probe" — while reading the
`findings.md` written in the first vocabulary and writing `plan.md` in the second. `task-learn` and
`rework` then read across both files.

Adopted `task-investigate`'s names, because it runs first and owns the file the words land in. Two
names for one bucket reads as two buckets.

### Two assumption markers, one of them never read

`common/CLAUDE.md` defines `⚠️ Assumed: <what> because <why>`, and `rework` re-checks assumptions by
grepping for exactly that token — the step that catches an assumption which was safe under the old
requirement and isn't under the new one.

`task-plan` invented a second marker, `⚠️ Needs your input:`, for the same job. So every assumption
made at planning time was invisible to the one step that exists to re-examine it. Not a wording
problem: a grep that silently returns nothing.

`task-plan` now leads with `⚠️ Assumed:` and keeps the question as a second line, so one grep finds
every assumption in the ticket folder.

### Three spellings of the diff base

`task-implement` Step 1 used `<base>..HEAD`, its Step 7 a bare `<base>`, and `task-review`
`<base>...HEAD`. Two dots and three dots are different operations — `...` is merge-base relative, so
on a branch that has had `main` merged into it the reviewer's diff hides changes the implementer's
diff showed. The reviewer is the one person who must see everything. Unified on `..HEAD`.

### Instructions stated twice, collapsed toward the rules

`task-implement` restated the six-step diagnosis loop, the "one file per purpose" rule, and two
aphorisms about leftover code and reading the diff — all near-verbatim from `common/CLAUDE.md`.
`task-investigate` restated the `docs/ai/` reading list and the closed-question rule.

Cut every copy from the skill, never from the rule. The direction is the point: a skill leaning on
an always-on rule is safe because the rule is already loaded, whereas a rule reduced to a pointer
does nothing on the days the pointer is ignored. What stayed in the skills is what is genuinely
stage-specific — the two-attempts trigger at the point of use, the `Artifacts:` list, `scratch/`,
and where a diagnosis gets recorded.

`task-implement` is 15 lines shorter and `common/CLAUDE.md` unchanged in substance.

### The inverse of the same problem

Deduplicating surfaced the opposite bug. `task-implement` and `task-review` each *enumerate* what
to read, and neither list included `docs/ai/` — and an enumeration reads as complete, so it
silently overrode the always-on rule that says to read it. Meanwhile `task-implement` Step 2 says
"write code that looks like the code around it", which is exactly what `PATTERNS.md` is for. Both
read lists now name it.

### Odds and ends

`scope-creep` was in `task-learn`'s tag list and in SETUP.md's table but missing from `task-learn`'s
own explanation table — seven tags, six explained. `per-project/CLAUDE.md.template` told you not to
repeat the shared rules and then repeated one. `README.md` still argued that only some loose skills
need explicit triggers, which stopped being true when `rework` got one.

### A size cap on the file that most needed one

`stacks/react.md` caps itself at 50 lines and the per-project template at 40, both for the same
stated reason: they load every turn and compete with the real work. `common/CLAUDE.md` loads on
every turn of *every* task, is the longest of the three, and had no cap — the two governed files
were the two small ones. Capped at 200, which is the honest current number rather than an
aspiration the file already breaks.

### Microfrontend rules got their own stack file

Written for Module Federation, which decides which rules matter: apps share dependencies at runtime,
so a singleton or a global from one app surfaces as a bug in another. Style escape, `window`, test-id
and i18n-namespace collisions, shared-package import direction, and defaults on shared contracts so
whoever deploys last isn't broken by a required new field.

Pointed at from each **app's own** `CLAUDE.md` rather than `projects/CLAUDE.md`, because not every
app there is a microfrontend and these cost attention on the ones that aren't. They're rules and not
a skill because they apply when editing existing code, not only when creating it.

### `stacks/react.md` filled in — and most of v1/scaffold deliberately left out

The file's own first rule is "could eslint check it instead?", and most of what v1/scaffold listed
can: `no-explicit-any`, `ban-ts-comment`, `no-nested-ternary`, `import/no-namespace`,
`no-restricted-imports` for lodash and moment, `no-console`, `react-hooks/*`, and the
`eslint-plugin-testing-library` rules covering `user-event` and screen queries. Those belong in each
app's lint config, where they can't be skimmed past, and were not copied here.

What landed is what tooling can't express: component vs hook vs plain function, server data kept
apart from UI state, every fetch rendering both a loading and an error state, the store shape, and
"a test must fail when the behavior breaks — if you can't say which line you'd break, it isn't
testing anything."

### Both stack files now actually obey the 50-line cap they declare

`react.md` declared a 50-line cap and was 103 lines. Two thirds of it wasn't rules at all: 38 lines
of maintenance guidance addressed to me about how to add to the file, and a closing table restating
the layering test — with the same "Named exports only" example README already uses. All of it loading
on every turn of every React task, which is the exact cost the cap exists to prevent.

The guidance moved to SETUP.md under "Maintaining the stack files", where the rest of the
read-it-occasionally material already lives, and now covers both stack files instead of one. The
duplicate table is gone. The empty `<placeholder>` bullets for effects, accessibility and performance
are gone too — an unfilled placeholder that loads every turn is pure cost — replaced by one line
saying what's deliberately absent and why.

`react.md` is 50 lines and `microfrontend.md` 44.

### `create`, replacing v1/scaffold

The problem with genericizing v1/scaffold is that stripping out the one app's names leaves "match the
local patterns" — which is precisely the instruction `rule-author` says not to write, because you
cannot tell from the result whether it was followed.

So convention discovery became an **output**, using the mechanism this repo already relies on. Before
any code: name the one model file being copied, then a fixed-row table giving the `file:line` each
convention was read from. Fixed rows so it can't be quietly trimmed to the two easy ones. `None` is
allowed only with the search that proved it — `grepped "useTranslation|i18n", 0 hits` can be checked,
"N/A" can't. Afterwards, a deviations list, where `None` is the expected answer.

**One model, never an average of two.** Averaging two patterns invents a third that exists nowhere.

The highest-value row is the one nobody would think to demand: *what else must be edited for this to
be reachable*. A file nothing imports is the most common way creating one goes wrong — the component
never added to `index.ts`, the route never registered, the locale key never added.

**No code templates.** v1/scaffold pasted four skeletons; those go stale and are the app-specific
content being removed in the first place. They become an Exemplars table in each app's
`PATTERNS.md` — kind of file → the real file here to copy — which `create` Step 1 reads. Pointing at
a file that has to keep working beats pasting a copy that doesn't.

Named `create` over `pattern-first` and `scaffold`. "Scaffold" means framework codegen — emit
boilerplate from a template — which is the opposite of the rule this skill enforces. `create`
collides with three siblings on the literal phrase ("create a plan", "create a skill", "create
tests"), handled the two ways `rule-author` prescribes: explicit "not for" clauses naming
`task-plan`, `rule-author` and `write-tests`, and the three-line header that already forces every
task to say which skills it picked *and rejected*.

It earns a file rather than lines inside `task-implement` because it contributes a procedure and a
required output that skill doesn't have, and because it fires on requests that never reach it —
"add a component for X", no ticket, no plan. `task-implement` Step 2's one-line rule stays and gains
a pointer, the same shape `why-this-exists` uses.

`task-plan` now names the model file for each step that creates one, since planning time is where a
wrong model is cheapest to correct. `task-review` gained the matching check, because a new file
matches no surrounding code and a convention breach in one is otherwise invisible.

### `write-tests`, and the line between it and `failing-test-first`

v1's "identify all branches, conditions, and user-visible outcomes" is a claim, not an output. It
became a behavior table written before any test code, with a column for what is deliberately **not**
covered and why — because a behavior missing from the table entirely is a gap nobody sees, whereas
"not covered — layout only" is a decision someone can disagree with.

The other addition is a mutation check: before calling it done, break the line of source the main
assertion defends, watch it fail, restore it. Nothing else distinguishes a test from a decoration.
That check also exists in `task-review` §7, and **both stay** — same reasoning `task-review` already
uses for re-running the stash check itself: the reviewer must not take the author's word for it.

The boundary sits in `write-tests`'s description only, following the `task-review`/`rule-author`
precedent. `failing-test-first` is untouched, because "write tests for this component" doesn't match
its triggers while a bare "write tests" would otherwise swallow a bug fix. It owns *when* a test is
written and whether a red is real; `write-tests` owns what goes inside it.

### The v1 example file was dropped, not rewritten

It contradicted three rules of the skill it illustrated: two tests asserting on Tailwind classes
under "don't test CSS", `should render correctly` under a rule demanding user-visible outcome names,
and two tests asserting only that a mock was called. A model copies the shape it sees before it obeys
the prose above it, so 143 lines of implicit instruction outweighed 15 lines of explicit rules.

Rewriting it generically doesn't work either, which was the deciding argument: a generic example has
to invent a fictional component, and a fictional convention is the exact thing both new skills exist
to prevent. `write-tests` Step 1 requires a real model test file from the repo being worked in
instead. Two four-line snippets survive inline, where the exact wording is the lesson — a good/bad
test name, and a mock assertion versus an outcome assertion.

### One thing worth remembering about v1

The v1 files are CRLF, because this whole system targets a managed Windows environment. Adding the deprecation banners
with a text-mode rewrite silently converted 372 lines to LF and turned a 14-line change into a
whole-file diff. Prepend to those files in binary mode, or check `git diff --stat` against what you
actually changed.
