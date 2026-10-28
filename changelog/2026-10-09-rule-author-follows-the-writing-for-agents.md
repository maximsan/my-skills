## 2026-10-09 — rule-author follows the writing-for-agents guide

`rule-author` is what every new rule and skill is written with, so its advice shows up in all of them. Two parts of
it caused the long descriptions that the `writing-for-agents` review found:

- It said to include the "sloppy versions" of each trigger phrase. That lists one case several times.
- It said "Length isn't the problem." A description loads in every session, so every word costs.

It now asks for steps that end on something checkable, such as a file written or a line printed. When a
description isn't enough to load a skill, the fallback is a one-line "load" trigger in `CLAUDE.md`, as the common
rules already use.

It also asks who starts a skill. The default is the agent. Only a skill that must never start by itself, such as
one that deploys, is set to start only by `/name`.

The guide itself lives outside this repo, so `rule-author` states its points in a short form rather than linking to
it.
