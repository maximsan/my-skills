# Fixing review findings

1. Read `review.md`, and `progress.md` for what was already known.
2. **Fix only the findings marked "fix now".** Not the backlogged ones, not the ones marked won't-fix, and nothing
   else noticed on the way. Put that in Backlog like anything else out of scope.
3. **Re-verify each fix with the check that caught it.** If the reviewer took the fix out and ran a test, do the same.
   If it named a failing input, run that input. Paste the output.
4. Record each one in `progress.md`: the finding, what changed, and the proof.
5. Update `review.md`: mark each finding `fixed: <what changed>`, so it's a record of what was decided rather than
   a snapshot of one moment.

Don't re-run the whole review afterwards. The sections that were clean are still clean, and a full re-review mostly
re-confirms them at full cost. If the fixes touched something the review hadn't looked at, say so and let the user
decide whether that part needs another pass.
