# Reviewing the open FEEDBACK.md rows

1. Group every `open` row in the file by tag, including rows above the last `reviewed to here` line, and count
   them. Rows a past review didn't fix still count.
2. Take the tag with the most rows. That's the one worth fixing.
3. Suggest one change, to one file, with the exact wording.
4. In Step 6, also propose the line `--- reviewed to here: 2026-08-06 @ a3f9c21 ---`, as its own item, at the end
   of `## Corrections`. The user can accept the line and turn the change down.
5. Once the user approves the change in Step 6 and it is written, mark those rows `fixed: <what changed>`.

One change per review. Change five things at once and there's no knowing which one helped.

| Tag that keeps coming up | What it usually means |
|---|---|
| `shallow-read` | The "give the file and line" rule isn't binding — demand it earlier |
| `missing-rule` | The rule exists but isn't loading — check the three lines are being printed |
| `unclear-request` | The `task.md` files are too thin. That one's on the user |
| `wrong-assumption` | Not asking enough — widen the question list |
| `forgot-existing-file` | The diff check isn't happening — demand the artifacts list every step |
| `scope-creep` | The plan's "files to touch" isn't being treated as a limit |
| `said-done-but-wasnt` | "Done when" isn't specific enough to actually check |
| `wrong-convention` | The Exemplars table in `NOTES.md` is missing, or points at a file that's no longer typical |
