## 2026-10-27 — Skill links through the projects folder count as this repo's

The manual setup on a managed Windows environment linked apps to the skills through the projects folder's skills link,
`projects\.claude\skills`, not straight to `prompts\skills`. `add-app` and `doctor` compared only the straight path,
so they misread those links:

- one link for a whole app's `.claude\skills` was called the app's own, and its skills were skipped;
- one link per skill was called a link not to this repo's skills, and `doctor` failed.

Now a link into `projects\.claude\skills` counts as one into `prompts\skills`. `setup` points the first at the second.

- **One link per skill through it is kept as it is.** It works, and nothing is gained by asking you to remake it.
- **One link for the whole folder through it is blocked,** with the command that removes only the link. That's what
  a straight one already got: each skill needs its own link, so a team's own skills can sit beside them.

What it costs: those per-skill links work only while `projects\.claude\skills` points at `prompts\skills`. `doctor`
checks that link.
