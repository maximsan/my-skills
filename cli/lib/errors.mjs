// @ts-check
// The exit codes, and the few error types the CLI treats differently from a bug.
//
// Expected problems (a missing tool, a folder we must not touch) are not exceptions at all: they are step results
// with a reason and a fix. `StepFailure` carries one of those out of a step or a git call. The other three
// unwind the whole run, so `run.mjs` can tell "you stopped it" from "it can't run here" from "something is broken".

/**
 * How a run ended, as the process exit code. 130 is the usual code for "stopped with Ctrl+C", so scripts that call
 * this can tell stopping apart from failing.
 */
export const EXIT_CODES = { OK: 0, FAILED: 1, USAGE: 2, STOPPED: 130 };

/** The user pressed Ctrl+C, or closed the input (Ctrl+D). Nothing after this point runs. */
export class StoppedError extends Error {
  constructor() {
    super("Stopped by you.");
    this.name = "StoppedError";
  }
}

/** A question needs an answer, but there is no terminal to ask in (piped input, CI). */
export class NeedsTerminalError extends Error {
  constructor() {
    super("This needs answers — run it in a terminal, or add --yes.");
    this.name = "NeedsTerminalError";
  }
}

/** The command line itself is wrong: an unknown command, flag, or a missing argument. */
export class UsageError extends Error {
  /**
   * Makes the error with the text shown to the user.
   * @param {string} message what is wrong with the command line, in plain words
   */
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/**
 * A step could not do its job for a reason we understand, with a fix the user can act on. Thrown from apply() it
 * becomes "✖ failed"; from check() it becomes "can't do"; from looking around or questions it ends the run before
 * anything changes.
 */
export class StepFailure extends Error {
  /**
   * Makes the failure from its reason and an optional fix.
   * @param {string} reason what went wrong, in plain words
   * @param {string} [fix] what the user can do about it
   */
  constructor(reason, fix) {
    super(reason);
    this.name = "StepFailure";
    this.fix = fix;
  }
}
