## 2026-09-23 — One idea per sentence, for everything written

A sentence in the new debug rule packed four ideas into one line. It said where the loop lives, that it's a file,
why it's a file, and when things get lost. The user couldn't parse it.

This was the second time. `rule-author` already had a "short sentences" bullet. It didn't help, because
`rule-author` wasn't loaded. Editing an existing rule didn't feel like writing a new one.

So it's an always-on rule now, not a skill line. Every task writes prose: replies, `findings.md`, comments. None of
those load `rule-author`. The `rule-author` bullet shrank to a pointer plus its rule-specific reason. The always-on
copy is the one that has to stand alone.

The test is concrete on purpose. Nobody can check "write clearly". Anyone can point at a dash, semicolon, or
"because" that opens a second idea. The rule doesn't ban dashes. The files use them everywhere for short asides.
It bans using one to add a second idea.

The example in the rule is the real sentence that failed, not an invented one. The new section was paid for by
joining paragraphs that belonged together, so `common/CLAUDE.md` stays at 199 lines.

A follow-up pass then rewrote the packed sentences already in the rules, skills, stack files, templates, and these
entries. It changed wording only, never meaning. Frontmatter descriptions were left alone, because their job is
keyword matching.
