## 2026-09-23 — Every change of direction gets a written checkpoint

"Clean up after yourself" said what to *delete* when an approach is abandoned. `rework` covered finished work that
turned out wrong. Nothing covered the change of direction itself: what is still true afterwards, and where work
restarts. So the agent would change direction and carry on from its memory of the old one.

The checkpoint has three lines, written before the first action in the new direction:

- `↪ Pivot:` says from what, to what, and why.
- `Still true:` and `Now wrong:` sort the work already done.
- `Start from:` names the first step in the new direction.

`Now wrong:` doubles as the cleanup list. That's why the first paragraph of "Clean up after yourself" moved into the
new section. Its second paragraph, about reading the diff before calling anything finished, moved into "Done means
checked". Both still exist, word for word or close to it. The standalone heading is what went.

The `↪ Pivot:` token is easy to grep on purpose. `task-review` already looks for part-way changes of approach in
`progress.md`. Now it has something concrete to search for.

The new section also absorbed "When something already built turns out wrong". That case is a pivot where the wrong
thing is finished work. It keeps its own trigger to load `rework`. Merging the sections and tightening the probe
paragraphs made room for both new rules. `common/CLAUDE.md` stays at 199 lines without raising the cap.
