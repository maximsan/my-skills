## 2026-09-10 — Inline code that should have been a named value

Agent writing dense expressions inline instead of extracting named intermediates. Deliberately not a
new rule, for two reasons.

Most of it is lintable, and the repo's own escalation says to check that first: `no-magic-numbers`
for inline literals, `sonarjs/cognitive-complexity` and `complexity` for expressions doing too much,
`max-depth` and `max-nested-callbacks` for nesting, `max-len` to force long chains apart. Those go in
each app's eslint config, not here — a lint rule can't be skimmed past, and this is exactly the kind
of instruction that gets skimmed because it reads as taste. The rule list is recorded in SETUP.md
beside the "could eslint check it instead?" test, since the surprise is that readability is more
mechanically reachable than it looks.

What survives lint is whether a given expression has a concept behind it worth naming, which is
judgment. That extended the bullet already covering dense one-liners rather than adding a second
taste rule to a file with one line of headroom left. The old wording said such a line "should have
been plainer code" — a prohibition with no action attached. It now says the comment you'd write is
the name: extract it into a named value. Same observation, but it says what to do, and it can be
checked by pointing at an expression and asking what you'd call it.

Not added to `task-review`. It already warns that one real bug beats ten style notes, and a naming
check is the kind that generates volume and teaches people to skim review output. Lint does this job
without the noise.
