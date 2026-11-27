/**
 * What the scripts share: running a program for its output, and telling a
 * script run from an import.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Runs `program` with `args` and returns what it printed. A program that
 * fails throws, with its own message.
 * @param {string} program the command to run, such as `git` or `gh`
 * @param {string[]} args the arguments passed to the program
 * @param {{ cwd?: string }} [options] `cwd`: the folder to run it in; the current folder by default
 * @returns {string} what the program printed to standard output
 */
export function outputOf(program, args, { cwd = process.cwd() } = {}) {
  return execFileSync(program, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: WHOLE_TRACKER_BYTES,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

/**
 * Room for a whole tracker's bodies in one listing; Node's default of one
 * megabyte stopped `gh` at a few hundred issues.
 */
const WHOLE_TRACKER_BYTES = 256 * 1024 * 1024;

/**
 * Whether the module at `importMetaUrl` is the script Node was started with,
 * rather than an import. Both paths are compared with links followed, so a
 * script started through a symlink counts.
 * @param {string} importMetaUrl the calling module's `import.meta.url`
 * @returns {boolean} true when Node was started with that module
 */
export function runsAsScript(importMetaUrl) {
  const [, started] = process.argv;

  try {
    return started !== undefined && realpathSync(started) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    // A start path that isn't a file means this module was imported.
    return false;
  }
}

/**
 * Prints a failure's message and returns the exit code a script should end
 * with; a script's `main` is wrapped in this.
 * @param {() => number} main the script's work, returning its exit code
 * @returns {number} the exit code `main` returned, or 1 when it threw
 */
export function exitCodeOf(main) {
  try {
    return main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));

    return 1;
  }
}
