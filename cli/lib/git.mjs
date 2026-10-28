// @ts-check
// The git questions the CLI asks, as plain functions.
//
// The CLI only ever *reads* from git: it never runs a git command that changes anything. The one git-related write,
// adding lines to a repo's private ignore file, happens in add-app's `excludeFromGit` step, as an ordinary file write
// through `files.mjs`.
//
// A git command that fails in a way we don't expect is never read as an answer. It becomes a `StepFailure` that
// carries git's own message, so "git couldn't tell" never passes for "no" or "yes".

import { isAbsolute, resolve } from "node:path";
import { StepFailure, StoppedError } from "./errors.mjs";
import { runProcess } from "./exec.mjs";

/** What every command says when git can't be started, so setup, doctor and a failed step all agree. */
export const GIT_MISSING = {
  reason: "git isn't installed, or isn't on PATH",
  fix: "Install git from https://git-scm.com.",
};

/** Long enough for a slow network drive, short enough that a stuck git is reported rather than waited on. */
const GIT_TIMEOUT_MS = 15_000;

const MS_PER_SECOND = 1000;

/** A `git check-ignore -v` rule: "<source>:<line number>:<pattern>". The source may hold colons itself. */
const CHECK_IGNORE_RULE = /^(.*?):(\d+):(.*)$/;

/** What git says when it won't read a repository owned by another user. */
const DUBIOUS_OWNERSHIP = /dubious ownership/i;

/** What git says when a folder is outside every repository. */
const NOT_A_REPOSITORY = /not a git repository/i;

/** A version number such as "2.44" or "2.44.0" in `git --version` output. */
const VERSION_NUMBER = /\d+\.\d+(\.\d+)?/;

/** A line break in git's output, with or without the Windows carriage return. */
const LINE_BREAK = /\r?\n/;

/**
 * One line of `git check-ignore -v -n` output: whether a path is ignored, and by which rule.
 * @typedef {{ path: string, isIgnored: boolean, source: string, pattern: string }} IgnoreMatch
 */

/**
 * Reads one line of `git check-ignore -v -n` output.
 * @param {string} line "<source>:<line number>:<pattern>\t<path>", or "::\t<path>" when nothing matched
 * @returns {IgnoreMatch} the path, whether it is ignored, and the rule that decided it
 */
export const parseCheckIgnoreLine = (line) => {
  // The source can hold a colon itself (C:/Users/...), so match up to the first ":<digits>:" rather than splitting
  // on ":".
  const [rule = "", path = ""] = line.split("\t");
  const match = rule.match(CHECK_IGNORE_RULE);

  if (!match) {
    return { path, isIgnored: false, source: "", pattern: "" };
  }

  const [, source, lineNumber, pattern] = match;

  // A "!pattern" match means a rule deliberately un-ignores the path.
  return { path, isIgnored: !pattern.startsWith("!"), source: `${source}:${lineNumber}`, pattern };
};

/**
 * The requested paths git doesn't ignore. A path missing from git's answer counts as not ignored: silence is never
 * taken as a yes.
 * @param {string[]} requestedPaths the paths we asked git about
 * @param {IgnoreMatch[]} matches git's answers, from parseCheckIgnoreLine()
 * @returns {IgnoreMatch[]} one entry for each requested path that is not ignored
 */
export const notIgnoredPaths = (requestedPaths, matches) =>
  requestedPaths
    .map((path) => matches.find((match) => match.path === path) ?? { path, isIgnored: false, source: "", pattern: "" })
    .filter((match) => !match.isIgnored);

/**
 * The fix for a repository git refuses to read. "Dubious ownership" has a fix of its own, which changes your global
 * git config, so it's shown for you to run rather than run for you.
 * @param {string} directory the repository's folder, quoted in the fix
 * @param {string} stderr git's error output
 * @returns {string} what the user can do, in plain words
 */
const fixForUnreadableRepository = (directory, stderr) =>
  DUBIOUS_OWNERSHIP.test(stderr)
    ? `If this folder is yours, run this yourself: git config --global --add safe.directory "${directory}". `
    + "This tool never changes your git settings."
    : `Run  git status  in ${directory}  to see what git says, fix that, then run this again.`;

/**
 * What went wrong, from a git command's result: the first line of its error output, or its exit code if it printed
 * nothing.
 * @param {import("./exec.mjs").ProcessResult} result the finished git command's output and exit code
 * @returns {string} the reason to show the user
 */
const firstErrorLine = (result) => result.stderr.trim().split(LINE_BREAK)[0] || `exit code ${result.code}`;

/**
 * The git questions the CLI asks, all run with the same safe settings and the run's stop signal.
 * @param {{ env: NodeJS.ProcessEnv, signal: AbortSignal, onCommand?: (summary: string) => void }} options the
 *   environment variables git runs with, the run's stop signal, and a callback told about every git command run
 * @returns {Git} the git questions, each run in a folder you pass
 */
export const createGit = ({ env, signal, onCommand = () => {} }) => {
  // GIT_TERMINAL_PROMPT=0: if git ever wants a password, it fails at once instead of waiting for one.
  // LC_ALL=C: git's messages in English whatever the machine's language, so "not a git repository" can be recognised.
  const gitEnv = { ...env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };

  /**
   * Runs one git command and turns the ways it can go wrong into errors the runner understands.
   * @param {string[]} args the git arguments, e.g. ["rev-parse", "--git-dir"]
   * @param {string} cwd the folder git runs in
   * @returns {Promise<import("./exec.mjs").ProcessResult>} the command's output and exit code, whatever the code
   */
  const run = async (args, cwd) => {
    const result = await runProcess("git", args, { cwd, env: gitEnv, signal, timeoutMs: GIT_TIMEOUT_MS });

    onCommand(`git ${args.join(" ")} → ${result.code ?? "no exit code"} (${result.durationMs}ms)`);

    if (result.aborted) {
      throw new StoppedError();
    }

    if (result.failedToStart) {
      throw new StepFailure(`${GIT_MISSING.reason}.`, GIT_MISSING.fix);
    }

    if (result.timedOut) {
      throw new StepFailure(
        `git didn't answer within ${GIT_TIMEOUT_MS / MS_PER_SECOND}s (git ${args.join(" ")}).`,
        "Check the folder isn't on a disconnected network drive, then run this again.",
      );
    }

    return result;
  };

  /**
   * Like `run`, but any exit code outside `acceptedCodes` is a failure carrying git's own message.
   * @param {string[]} args the git arguments, e.g. ["rev-parse", "--git-dir"]
   * @param {string} cwd the folder git runs in
   * @param {number[]} [acceptedCodes] the exit codes that count as an answer; only 0 by default
   * @returns {Promise<import("./exec.mjs").ProcessResult>} the command's output, when its exit code is accepted
   */
  const runExpecting = async (args, cwd, acceptedCodes = [0]) => {
    const result = await run(args, cwd);

    if (result.code !== null && acceptedCodes.includes(result.code)) {
      return result;
    }

    throw new StepFailure(
      `git ${args[0]} failed in ${cwd}: ${firstErrorLine(result)}`,
      fixForUnreadableRepository(cwd, result.stderr),
    );
  };

  /**
   * The installed git's version number.
   * @param {string} cwd the folder git runs in
   * @returns {Promise<string | null>} e.g. "2.44.0", or null when running git fails or it prints no version number
   */
  const version = async (cwd) => {
    try {
      const result = await run(["--version"], cwd);

      return result.stdout.match(VERSION_NUMBER)?.[0] ?? null;
    } catch (error) {
      if (error instanceof StepFailure) {
        return null;
      }

      throw error;
    }
  };

  /**
   * Whether a folder is inside a repository's working folder. "Not a repository" is an answer; any other git error
   * is a failure.
   * @param {string} directory the folder to check
   * @returns {Promise<boolean>} true when the folder is inside a repository's working folder
   */
  const isRepository = async (directory) => {
    const result = await run(["rev-parse", "--is-inside-work-tree"], directory);

    if (result.code === 0) {
      return result.stdout.trim() === "true";
    }

    if (NOT_A_REPOSITORY.test(result.stderr)) {
      return false;
    }

    throw new StepFailure(
      `git can't read the repository at ${directory}: ${firstErrorLine(result)}`,
      fixForUnreadableRepository(directory, result.stderr),
    );
  };

  /**
   * The top folder of the repository a folder belongs to.
   * @param {string} directory inside a repository
   * @returns {Promise<string>} the top folder of the repository's working folder
   */
  const topLevel = async (directory) => (await runExpecting(["rev-parse", "--show-toplevel"], directory)).stdout.trim();

  /**
   * The repository's own folder (`.git`, or a worktree's folder inside the main clone's). It's outside the working
   * folder, so nothing put there ever shows in `git status`.
   * @param {string} directory inside a repository
   * @returns {Promise<string>} the repository's own folder, as an absolute path
   */
  const gitDirectory = async (directory) => {
    const path = (await runExpecting(["rev-parse", "--git-dir"], directory)).stdout.trim();

    return isAbsolute(path) ? path : resolve(directory, path);
  };

  /**
   * The repo's private ignore file. Asking git rather than assuming `.git/info/exclude` gets worktrees right: they
   * share the main clone's file.
   * @param {string} directory inside a repository
   * @returns {Promise<string>} the private ignore file's path, as an absolute path
   */
  const excludeFilePath = async (directory) => {
    const path = (await runExpecting(["rev-parse", "--git-path", "info/exclude"], directory)).stdout.trim();

    return isAbsolute(path) ? path : resolve(directory, path);
  };

  /**
   * Whether git tracks a file, that is, whether it is committed or staged.
   * @param {string} directory inside a repository
   * @param {string} relativePath the file, relative to `directory`
   * @returns {Promise<boolean>} true when git tracks the file
   */
  const isTracked = async (directory, relativePath) => {
    const result = await runExpecting(["ls-files", "--error-unmatch", "--", relativePath], directory, [0, 1]);

    return result.code === 0;
  };

  /**
   * The files git tracks under some paths.
   * @param {string} directory inside a repository
   * @param {string[]} relativePaths files or folders, relative to `directory`
   * @returns {Promise<string[]>} the tracked files under them
   */
  const trackedFiles = async (directory, relativePaths) =>
    (await runExpecting(["ls-files", "--", ...relativePaths], directory)).stdout.split(LINE_BREAK).filter(Boolean);

  /**
   * Asks git whether each path is ignored and which rule decided it. `-n` also lists paths that aren't ignored, so
   * every path should get an answer; compare against what you asked with `notIgnoredPaths`.
   * @param {string} directory inside a repository
   * @param {string[]} relativePaths the paths to ask about, relative to `directory`
   * @returns {Promise<IgnoreMatch[]>} one answer for each path git listed
   */
  const checkIgnore = async (directory, relativePaths) => {
    // Exit 1 means "none of them is ignored", which is an answer. Anything else (128) means git couldn't tell.
    const result = await runExpecting(["check-ignore", "-v", "-n", "--", ...relativePaths], directory, [0, 1]);

    return result.stdout.split(LINE_BREAK).filter(Boolean).map(parseCheckIgnoreLine);
  };

  return {
    version,
    isRepository,
    topLevel,
    gitDirectory,
    excludeFilePath,
    isTracked,
    trackedFiles,
    checkIgnore,
  };
};

/**
 * The git questions a command can ask. Written out, rather than taken from createGit(), so tests' fake git has one
 * shape to match.
 * @typedef {object} Git
 * @property {(cwd: string) => Promise<string | null>} version the installed git's version, or null when running git
 *   fails
 * @property {(directory: string) => Promise<boolean>} isRepository whether a folder is inside a repository
 * @property {(directory: string) => Promise<string>} topLevel the top folder of the repository
 * @property {(directory: string) => Promise<string>} gitDirectory the repository's own folder, such as `.git`
 * @property {(directory: string) => Promise<string>} excludeFilePath the repository's private ignore file
 * @property {(directory: string, relativePath: string) => Promise<boolean>} isTracked whether git tracks a file
 * @property {(directory: string, relativePaths: string[]) => Promise<string[]>} trackedFiles the tracked files
 *   under some paths
 * @property {(directory: string, relativePaths: string[]) => Promise<IgnoreMatch[]>} checkIgnore whether each path
 *   is ignored, and by which rule
 */
