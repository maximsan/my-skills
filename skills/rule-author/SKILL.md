---
name: rule-author
description: This skill should be used when the user asks to "create a skill" or a rule (CLAUDE.md), to "review this skill" or a rule, or asks "why isn't my skill loading". Writes and reviews agent rules and skills. Application code is reviewed with task-review.
---

# Writing a rule or a skill

Every added line costs attention. Rules and skill descriptions load into every session, and a skill's body loads
every time it runs. Spend that space on what changes the agent's behavior.

## 1. Rule or skill?

|  | Rule | Skill |
|---|---|---|
| **When it loads** | Every session, always | Only when it's started |
| **What it holds** | How to work, in general | What to do for one kind of task |
| **Where it lives** | `CLAUDE.md` | `SKILL.md` in the skills folder |
| **The test** | Would I want this on *every* task? | Does this fire on a task type I can name? |

A rule that only matters for one kind of task should be a skill. In `CLAUDE.md` it makes every other rule easier to
skim past.

If a procedure has real phases with files handed between them, it's a workflow: a skill that calls other skills.

## 2. Who starts the skill?

- **The agent** (the default). It reads the description and loads the skill when a request matches. Pick this when
  the agent must reach the skill on its own, or a rule or another skill sends it there ("load `debug`"). If the skill
  must wait for the user's approval, keep it here and make its first step find that approval in the chat.
- **Only the user.** Set `disable-model-invocation: true` in the frontmatter. The skill then starts only when someone
  types `/name`, and its description leaves the always-loaded context. Pick this for a skill that only ever starts by
  hand, and for one that must never start by itself, such as one that deploys or sends something. No rule or other
  skill can load it then, so first check that nothing says "load `name`".

## 3. The description

For a skill the agent starts, the description is the only thing it sees when choosing. It sits in context in every
session, so every word costs.

1. **Write it in the third person, starting with the cases:** "This skill should be used when the user asks to…".
2. **Give each case one quoted phrase**, the words people actually say: `"debug this"`. A case with no typical
   phrase is a plain clause: "or after two failed fixes". Two phrases for one case are that case written twice.
3. **Then say what it does, in one sentence.** The description says when to load the skill, not how it works.
4. **Name the other skill** when a similar request belongs there.
5. **Check every phrase against the other skills' descriptions.** A phrase in two descriptions, or inside a longer
   phrase of another, loads either skill.

```
Weak:   Helps with debugging.

Long:   Find the real cause of a bug by running evidence instead of guessing, keeping a
        ledger of every hypothesis and check, with tagged temporary logs filtered down.
        Triggers on "debug this", "find the cause", "what's going on here".

Strong: This skill should be used when the user asks "why does this happen", or after
        two failed fixes. Debugs a failure with probes and a ledger. For the regression
        test once the cause is known, use failing-test-first.
```

If a skill doesn't load when it should, sharpen the description's wording. If that isn't enough, add a one-line
trigger to `CLAUDE.md`, such as "**Load `debug`** after two failed fixes". The content stays in the skill.

## 4. The body

- **Give orders.** "Read the task file", not "you should read the task file" or "the agent should read it". The
  user is "the user". Keep "you" only in text the agent writes for someone to read: a reply to the user, a marker
  such as `Needs your input:`, or a note heading.
- **State the target behavior.** "Write one-line comments" works better than "don't write long comments". Naming a
  behavior makes it more likely, even inside a ban. Keep a ban only as a hard guardrail, and pair it with the target.
- **End every step on something the agent can check:** a file written, a section filled, a line printed. "Every
  caller listed with its file and line" can be checked. "Understand the code" can't. A strict, complete condition
  gets more thorough work than a loose one.
- **Ask for output, not for thinking.** Required sections in a report are the strongest instruction there is.
- **Use a word the model already knows instead of a list.** "Chesterton's fence" carries the whole idea of finding
  out why something exists before removing it. Repeat that same word every time. A synonym reads as a new idea.
- **Steps first, reference after.** Put the steps at the top, in order. Material that only some runs need goes in a
  separate file in the skill's folder, with one line saying when to read it. Material every run needs, such as the
  report template, stays in `SKILL.md`. Text two skills both need goes in `skills/shared/`, which no skill owns.
- **Keep the body at or under 2,000 words.** Past that, move the sections only some runs need into separate files.
  A short skill that covers its task is done: length is a ceiling, not a target.
- **Say each thing once.** If `CLAUDE.md` or another skill already covers it, point there.
- **Record only what the agent can't look up.** It can read `package.json` and run `--help`. Write down the reason
  behind a choice, the unwritten convention, the trap.
- **Give one short reason.** A rule whose reason is visible survives odd situations.
- **Keep only sentences that change behavior.** Ask of each one: would the agent act differently without it? If
  not, delete the whole sentence.
- **Keep project-specific paths out of a rule meant for every project.**

## 5. Check it

Run this list on every rule or skill being written. To review an existing rule or skill, run it on that file, and report
each unticked box with its line and a fix.

- [ ] Rule or skill, and who starts it: checked against sections 1 and 2
- [ ] The description is in the third person, gives each case at most one quoted phrase, says in one sentence what
  the skill does, and leaves the method out
- [ ] It can't be confused with an existing skill, and no quoted phrase appears in another description. List which
  ones were checked.
- [ ] Nothing here overlaps an existing rule or skill
- [ ] Every step ends on something checkable: a file, a section, a printed line
- [ ] Every instruction states a target. Each remaining ban is paired with its target.
- [ ] Nothing is said twice, here or in `CLAUDE.md`
- [ ] Every sentence changes behavior
- [ ] The body gives orders, uses "you" only in text written for a reader, and stays at or under 2,000 words
- [ ] Every file the skill points to exists, in its folder or in `skills/shared/`
- [ ] Every path, skill name and behavior it names still exists
- [ ] One example that should trigger it, and one near-miss that shouldn't

## What to hand back

For a review: each unticked box, with its line and the replacement wording.

For a new or changed file: the full file (path, frontmatter, body), plus:

```
Rule or skill:  which, and why not the other
Started by:     the agent or only the user, and why
Replaces:       any existing rule or skill this changes or supersedes
Why it exists:  the times this actually came up
Should fire on: <example>   Should not fire on: <near-miss>
Checklist:      the boxes above, ticked
```

Then stop. Suggest it, and let the user approve it before it goes in.
