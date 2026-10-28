// @ts-check
// The only module that starts other programs.
//
// Every child process gets the same three protections, because a CLI that hangs "for no reason" is almost always
// waiting on a child: no keyboard input (so it can't sit on a password prompt), a timeout (so it can't run forever),
// and the run's abort signal (so Ctrl+C reaches it). Output is capped, so a runaway child can't fill memory.

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

/** More output than any git command here produces. Past this, output is dropped and marked as truncated. */
const MAX_OUTPUT_CHARACTERS = 1_000_000;

/**
 * @typedef {object} ProcessResult
 * @property {number | null} code exit code, or null if the program never ran or was killed
 * @property {string} stdout what the program printed as normal output
 * @property {string} stderr what the program printed as errors; when it couldn't start, Node's error message
 * @property {boolean} timedOut the timeout fired and the program was killed
 * @property {boolean} aborted the run's signal fired (Ctrl+C) and the program was killed
 * @property {boolean} failedToStart the program couldn't be started, usually because it isn't installed
 * @property {boolean} truncated output passed the cap and was cut
 * @property {number} durationMs how long the program ran, in milliseconds
 */

/**
 * Adds a chunk of a program's output to what was collected so far, keeping the total under the cap.
 * @param {string} text the output collected so far
 * @param {Buffer} chunk the next piece of output
 * @returns {{ text: string, truncated: boolean }} the combined output, and whether some of it was cut
 */
const appendCapped = (text, chunk) => {
  if (text.length >= MAX_OUTPUT_CHARACTERS) {
    return { text, truncated: true };
  }

  const combined = text + chunk.toString("utf8");

  if (combined.length <= MAX_OUTPUT_CHARACTERS) {
    return { text: combined, truncated: false };
  }

  return { text: combined.slice(0, MAX_OUTPUT_CHARACTERS), truncated: true };
};

/**
 * Runs a program and resolves with what happened. It never rejects: a missing program, a timeout and Ctrl+C are all
 * reported in the result, so callers decide what each one means for their step.
 * @param {string} command the program to run, e.g. "git"
 * @param {string[]} args the arguments to pass it
 * @param {{ cwd: string, timeoutMs: number, signal?: AbortSignal, env?: NodeJS.ProcessEnv, input?: string,
 *   shell?: boolean }} options the folder to run it in, how long it may take, the run's abort signal, its environment
 *   variables, text for its standard input (empty by default), and whether to run `command` as one line for the
 *   system's shell, as Claude Code runs a hook
 * @returns {Promise<ProcessResult>} what happened, once the program has ended
 */
export const runProcess = (command, args, { cwd, timeoutMs, signal, env = process.env, input, shell = false }) =>
  new Promise((resolvePromise) => {
    const startedAt = Date.now();
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, { cwd, env, signal, shell, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });

    // Input is closed straight after `input`, so a program that asks for more, such as a password, reads the end and
    // gives up instead of waiting. A program that exits before reading it all makes the write fail; its exit code
    // still says what happened.
    child.stdin.on("error", () => {});
    child.stdin.end(input ?? "");

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    /**
     * Resolves the promise with the result, once.
     * @param {{ code: number | null, failedToStart?: boolean }} outcome the exit code, and whether the program never
     *   started
     */
    const finish = ({ code, failedToStart = false }) => {
      // 'error' and 'close' can both fire for one child; only the first one counts.
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolvePromise({
        code,
        stdout,
        stderr,
        timedOut,
        aborted: Boolean(signal?.aborted),
        failedToStart,
        truncated,
        durationMs: Date.now() - startedAt,
      });
    };

    child.stdout.on("data", (chunk) => {
      const next = appendCapped(stdout, chunk);

      stdout = next.text;
      truncated ||= next.truncated;
    });
    child.stderr.on("data", (chunk) => {
      const next = appendCapped(stderr, chunk);

      stderr = next.text;
      truncated ||= next.truncated;
    });
    child.on("error", (error) => {
      stderr ||= error.message;

      // An abort also arrives here, but it isn't a start failure: the program ran and we killed it.
      finish({ code: null, failedToStart: !signal?.aborted && !timedOut });
    });
    child.on("close", (code) => finish({ code }));
  });

/**
 * Finds a program on PATH the way the shell would, including Windows' `.cmd`/`.exe` variants.
 * @param {string} name the program's name, e.g. "git"
 * @param {{ env: NodeJS.ProcessEnv, platform: NodeJS.Platform }} options  the environment, which holds PATH, and
 *   the operating system, which decides the file extensions tried
 * @returns {string | null} the full path, or null if it isn't on PATH
 */
export const findExecutable = (name, { env, platform }) => {
  const directories = (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean);
  const extensions = platform === "win32" ? ["", ...(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")] : [""];

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension.toLowerCase()}`);

      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  return null;
};
