> **LEGACY — do not use.**
> Replaced by the `task-plan` skill: `skills/task-plan/SKILL.md`.
> Kept only as a record of the original prompt for creating an implementation plan.
>
> Every requirement below carried over into the new skill. What deliberately changed:
>
> - `plan.md` already exists: this prompt asked whether to overwrite or write `plan-v2.md`. The new skill updates it in place — forking documents was the problem being solved.
> - Subagents: this prompt handed *drafting* to one. The new skill uses them for reading code and for a hostile review of the finished draft, and keeps drafting in the main context.

---

Task Reference

<TASK>
@investigations/task.md
</TASK>

You need to create a clear, step-by-step implementation plan for that task. Do not implement anything — plan only.

Step 0 — Locate and Read the Task File





Resolve the task file path from the reference above.



If the file cannot be found or read, stop immediately and tell the user — this is a hard blocker on its own (see below). Do not guess at its contents or proceed.

File Placement





Save the plan as plan.md in the same folder as the task file.



If that folder can't be determined, use this priority order and pick the first that exists: investigations/ → docs/ (or documentation/) → project root.



If a plan.md already exists at the target path, stop and ask the user whether to overwrite it or save the new one under a different name (e.g. plan-v2.md).

Handling Questions, Doubts, and Blockers

Distinguish two kinds of open issues:





Hard blocker — no reasonable plan is possible without an answer. Examples: contradictory requirements, missing access/permissions, a decision only the user can make where different answers lead to materially different plans, or the task file itself being missing/unreadable. Stop and ask the user in chat before creating any plan file. Do not write plan.md yet.



Open question with a reasonable default — an assumption can be made that lets planning continue, and if the assumption turns out wrong, it just means revising the plan later, not wasted implementation work. Don't stop for these — log them and proceed.

Every logged question or doubt must include three things: the question itself, your proposed answer or assumption, and a short reason it matters (what would change in the plan if the answer were different). This section is placed first in the file, before the plan itself.

Anything that genuinely needs the user's input — as opposed to an assumption you're comfortable proceeding on — must be visually flagged using this convention, applied consistently:

⚠️ Needs your input: [question] — proceeding with [assumption] for now because [reason].

Drafting the Plan





Hand off the actual drafting to a separate agent or subagent, if your environment supports spawning one (e.g. a Task/subagent tool). Give it the full task file contents, the resolved file paths, and relevant repo context — existing related code, the project's test framework and conventions, and any CI/test-running configuration you can find. Don't let it plan from the task text alone.



If your environment has no real mechanism for an independent agent, say so explicitly to the user, and instead do a distinct, deliberate self-review pass after drafting — clearly separated from the drafting itself, not silently merged into one pass.

Reviewing the Draft

Before presenting anything to the user, check the draft against:





Every item in Requirements for Plan Content below, treated as a literal checklist.



This litmus test: could a competent engineer with no other context execute this plan without needing to ask a single question? If not, something is missing, or a question needs to move into Questions/Blockers.

Only present the plan once it passes this review. If the "review" is done by the same underlying model that drafted it — i.e. no truly independent agent was available — treat it as a completeness and formatting check rather than a substitute for the blind spots an independent reviewer might catch, and say so if relevant.

Requirements for Plan Content





Use checkboxes for every step, verification item, and test item.



Every Definition of Done must be falsifiable: an observable, checkable outcome — not a vague quality claim. ("Endpoint returns 201 with orderId in the response body," not "the endpoint works correctly.")



Include only actions required to complete the stated task. No unrelated improvements, refactoring, or scope the task doesn't call for.



If something is a reasonable implementation detail required by the task — even if task.md doesn't spell it out — include it explicitly rather than leaving it implicit.



Include a Verification Plan: manual/functional checks confirming the change behaves correctly once implemented.



Include a Test Plan, grounded in the actual project: inspect the existing test setup, framework, and conventions before drafting this section, then specify unit test updates/additions plus any other project-required test updates (integration, e2e — whatever this project actually requires to call the feature done). Avoid generic test boilerplate disconnected from how this repo actually tests things.



Verification and testing are not the same thing: Verification confirms the behavior is correct, often manually and once. The Test Plan is the automated coverage that keeps it correct going forward. Don't collapse one into the other.

Simple vs. Complex Tasks





If the task is simple and straightforward, say so plainly when presenting the finished plan (e.g. "this is a small, well-scoped change — here's the plan"), and go ahead and write plan.md directly.



If the task is long, difficult, or ambiguous, suggest — but don't unilaterally create — an HTML version alongside plan.md (e.g. with a table of contents, collapsible sections, or clickable checkboxes). plan.md stays the source of truth either way; HTML is a navigation convenience, not a replacement. Wait for a yes before creating it. Requirements to the html file: 
  3 colors:                                                                                                                           
  - Slate (neutrals) — backgrounds, text, borders, muted elements                                                                   
  - Blue #38bdf8 — headings, links, accent highlights, info callouts                                                                  
  - Amber #f59e0b — subheadings, inline code, emphasis, warn callouts                                                                 
3 fonts:
  - Segoe UI (sans-serif) — body text, paragraphs, list items
  - Georgia (serif) — headings, table headers, card labels
  - Consolas (monospace) — code blocks, file references, flow diagram

Required Output Format for plan.md

## Questions / Blockers
List questions/assumptions here, each with your proposed answer and why it matters. If genuinely none, write: `None`.

## Implementation Plan
- [ ] Step 1: ...
  - Definition of Done: ...
- [ ] Step 2: ...
  - Definition of Done: ...

## Verification Plan
- [ ] Verification step 1: ...
  - Expected result: ...
- [ ] Verification step 2: ...
  - Expected result: ...

## Test Plan
- [ ] Unit test update/addition: ...
  - Definition of Done: ...
- [ ] Other required test update/addition: ...
  - Definition of Done: ...

## Final Summary
- What will be changed:
- What will be tested:
- Risks, assumptions, or suggestions: