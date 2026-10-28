## 2026-10-22 — Pick lists with arrow keys

The menu, the app list in `add-app` and the stack rules are now lists moved through with the arrow keys:

- Old: each asked for a number to type. The stack rules asked one yes/no question per stack.
- New: each is a pick list. The stack rules are one list, with the detected stacks already marked. The lines under
  the list say why the highlighted stack was detected.

This reverses the 2026-09-24 choice to leave arrow-key menus for later. The reason given then was raw mode, where
the terminal sends every key straight to the program. Raw mode is where "Ctrl+C doesn't work" and "my terminal is
broken" bugs come from. The list is taken from the `common-scripts` CLI, where it was tried in a real terminal and worked.
Here it has three guards:

- Ctrl+C in a list is passed on as a stop.
- Raw mode is switched off however the list ends, a crash included.
- Every line is cut to the terminal's width, so a redraw never leaves half a line behind.

Where the terminal refuses raw mode, or the input is a pipe, the list prints numbers to type instead. That keeps it
working in old consoles and in the tests.

Esc in a list stops the run, as Ctrl+C does, with exit code 130. Nothing has changed at that point: every list comes
before the plan's "Go ahead?".
