#!/usr/bin/env node
// @ts-check
// Entry point for `claude-rules`: checks the Node version, then loads the program in run.mjs.
//
// The check has to come before anything else loads. Node reads every static import before running a line, so on a
// Node too old for the rest of the CLI, a check inside the program itself would never get the chance to run. This
// file uses only built-in globals and constants.mjs, which has no imports, and loads the rest with import().
// It writes its one message straight to stderr, since lib/ui.mjs is part of what may not load.

import { COMMAND_NAME, MINIMUM_NODE_MAJOR } from "./lib/constants.mjs";

const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor < MINIMUM_NODE_MAJOR) {
  process.stderr.write(
    `${COMMAND_NAME} needs Node ${MINIMUM_NODE_MAJOR} or newer, and this is Node ${process.versions.node}.\n`
    + "Install a current Node from https://nodejs.org, open a new terminal, then run it again.\n",
  );

  // 1 is EXIT_CODES.FAILED, spelled out because errors.mjs is one of the files not loaded yet.
  process.exit(1);
} else {
  import("./run.mjs");
}
