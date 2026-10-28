// @ts-check
// Names and numbers the whole CLI shares, with no imports of their own.
//
// main.mjs loads this file before it checks the Node version, so it must stay plain: no imports, and no syntax newer
// than the oldest Node that could still start it.

/** The command name `npm install -g` puts on PATH, from package.json's "bin". */
export const COMMAND_NAME = "claude-rules";

/** The oldest Node with everything used here: readline/promises with abort signals, util.parseArgs, node:test. */
export const MINIMUM_NODE_MAJOR = 18;
