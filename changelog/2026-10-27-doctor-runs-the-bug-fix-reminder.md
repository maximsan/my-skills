## 2026-10-27 — doctor runs the bug-fix reminder

On a managed Windows environment the reminder failed on every message, and `doctor` still showed it as OK. It checked only that the
settings entry looked right. Claude Code 2.1.39 had dropped part of the entry, and the rest couldn't run.

Now `doctor` also runs the entry's command through the shell, as Claude Code does, with a test message about a bug.
The reminder must come back. If it doesn't, the line is a problem, with the error's own line and where to see more.

What it costs: `doctor` starts `node` once more, and waits up to the hook's 5-second timeout.
