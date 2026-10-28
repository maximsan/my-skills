## 2026-10-22 — Skill descriptions in the third person, one phrase per case

`rule-author` now teaches the skill format from Anthropic's plugin-dev `skill-development` skill:

- **Descriptions** start "This skill should be used when the user asks to…", in the third person.
- **Each case gets one quoted phrase.** Two phrases for one case are the same case written twice. They cost words
  in a description that loads on every turn. A phrase may appear in only one skill's description.
- **Bodies give orders**, with no "you".
- **Bodies stay at or under 2,000 words.** It's a ceiling, not a target: short skills aren't padded.

- Old: descriptions led with the key word ("Debug a failure. Use when…"). That saved the words of the third-person
  opening.
- New: the plugin-dev form. It costs those words. In return, the skills match what plugin-dev's `skill-reviewer`
  checks for.

Who starts a skill now follows one test. The agent starts it when the agent or another skill must reach it on its
own. Otherwise only the user starts it.
