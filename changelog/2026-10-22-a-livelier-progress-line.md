## 2026-10-22 — A livelier progress line

The progress line now looks like the one in the `common-scripts` CLI:

- Old: the line sat still for its first second, then counted seconds.
- New: a symbol turns about eight times a second, the step's first word is pink, and the time so far is dimmed.

A step that waits on git now shows it is alive at once.

Where the output is a pipe or a log file, the line can't be redrawn. There, a plain line every 5 seconds says the
step is still running.

Colours now follow Node's own check, `hasColors()`. It reads `NO_COLOR`, `FORCE_COLOR`, and whether the terminal
shows colour at all.
