// @ts-check
// Takes a bug fix out, runs the new test, and puts the fix back, byte for byte. The test must fail without the fix,
// or it isn't a regression test. See take-out-the-fix.md beside this folder for when task-review runs it.
//
// node take-out-the-fix.mjs --base <sha> --task-folder <folder> --test "<command>" [--patch <file>] -- <file>...
//
// Run it from the app's folder. Exit codes: 0 the test failed without the fix, as it should; 1 the test passed
// without the fix; 2 nothing was changed, see the message; 3 stop: the files or git status aren't as before, or the
// script failed.
//
// The fix comes back from a copy of each file's bytes, never from a patch. With git's line-ending conversion on
// Windows, a patch made from the working files may not apply back, or may apply with other line endings.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const EXIT = { RED: 0, GREEN: 1, NOTHING_CHANGED: 2, RESTORE_FAILED: 3 };

/** Where in the task folder the patch and the copies go. */
const SCRATCH = ["scratch", "take-out-the-fix"];

/** git prints paths with forward slashes on every system. */
const BACKSLASHES = /\\/g;

/** The most git may print, in bytes. Node's default of 1 MB would cut off a large file and fail the call. */
const MAX_GIT_OUTPUT = 1024 * 1024 * 1024;

/**
 * What one run needs.
 * @typedef {{ base: string, taskFolder: string, test: string, patch?: string, files: string[] }} Request
 */

/**
 * What one run did, for the caller to print.
 * @typedef {{ exitCode: number, message: string }} Outcome
 */

/**
 * A message that stops the run before anything was changed.
 */
class NothingChanged extends Error {}

/**
 * Runs git in a folder.
 * @param {string[]} args git's arguments
 * @param {string} cwd the folder to run it in
 * @returns {{ ok: boolean, stdout: Buffer, stderr: string }} what git printed, and whether it succeeded
 */
const git = (args, cwd) => {
  const result = spawnSync("git", args, { cwd, maxBuffer: MAX_GIT_OUTPUT });

  if (result.error) {
    throw result.error;
  }

  return { ok: result.status === 0, stdout: result.stdout, stderr: String(result.stderr) };
};

/**
 * The fix's files, each as git names it and as a full path.
 * @param {string} top the repository's top folder
 * @param {string} cwd the folder the paths were given from
 * @param {string[]} files the paths as given
 * @returns {{ gitPath: string, fullPath: string }[]} the files
 */
const resolveFiles = (top, cwd, files) =>
  files.map((file) => {
    const fullPath = resolve(cwd, file);
    const gitPath = relative(top, fullPath).replace(BACKSLASHES, "/");

    if (gitPath === "" || gitPath.startsWith("..") || isAbsolute(gitPath)) {
      throw new NothingChanged(`${file} is outside this repository.`);
    }

    return { gitPath, fullPath };
  });

/**
 * The fix as a patch, for reading and for cutting down to the fix's lines. New files are included.
 * @param {string} top the repository's top folder
 * @param {string} base the commit before the fix
 * @param {string[]} gitPaths the fix's files
 * @returns {Buffer} the patch
 */
const diffSinceBase = (top, base, gitPaths) => {
  const untracked = String(git(["ls-files", "--others", "--exclude-standard", "--", ...gitPaths], top).stdout)
    .split("\n")
    .filter(Boolean);

  // An intent-to-add entry puts a new file into the diff; it's taken out again straight after.
  if (untracked.length > 0) {
    git(["add", "--intent-to-add", "--", ...untracked], top);
  }

  const diff = git(["diff", "--binary", base, "--", ...gitPaths], top);

  if (untracked.length > 0) {
    git(["reset", "-q", "--", ...untracked], top);
  }

  return diff.stdout;
};

/**
 * Takes the fix out by writing each file as it was at the base commit, or by reversing a cut-down patch.
 * @param {string} top the repository's top folder
 * @param {Request} request what to take out
 * @param {{ gitPath: string, fullPath: string }[]} files the fix's files
 * @returns {void}
 */
const takeOut = (top, request, files) => {
  if (request.patch) {
    const reversed = git(["apply", "-R", resolve(request.patch)], top);

    if (!reversed.ok) {
      throw new Error(`the cut-down patch didn't come out: ${reversed.stderr.trim()}`);
    }

    return;
  }

  for (const { gitPath, fullPath } of files) {
    const object = `${request.base}:${gitPath}`;

    // A file the fix added isn't at the base commit, so it's removed while the test runs.
    if (!git(["cat-file", "-e", object], top).ok) {
      rmSync(fullPath, { force: true });
      continue;
    }

    // --filters gives the file as a checkout would write it, with the line endings this computer uses.
    const atBase = git(["cat-file", "--filters", object], top);

    if (!atBase.ok) {
      throw new Error(`git couldn't read ${object}: ${atBase.stderr.trim()}`);
    }

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, atBase.stdout);
  }
};

/**
 * Puts every file back from its copy, and removes the ones that didn't exist before.
 * @param {{ fullPath: string, copy: string | null }[]} saved each file and its copy, or null when it didn't exist
 * @returns {string[]} the files that don't match their copy afterwards
 */
const putBack = (saved) => {
  for (const { fullPath, copy } of saved) {
    if (copy === null) {
      rmSync(fullPath, { force: true });
    } else {
      mkdirSync(dirname(fullPath), { recursive: true });
      copyFileSync(copy, fullPath);
    }
  }

  return saved
    .filter(({ fullPath, copy }) =>
      copy === null ? existsSync(fullPath) : !readFileSync(fullPath).equals(readFileSync(copy)))
    .map(({ fullPath }) => fullPath);
};

/**
 * Checks the request and the repository before anything is changed.
 * @param {string} cwd the folder the script was run from
 * @param {Request} request what to take out
 * @returns {{ top: string, files: { gitPath: string, fullPath: string }[] }} the repository and the fix's files
 */
const prepare = (cwd, request) => {
  const topResult = git(["rev-parse", "--show-toplevel"], cwd);

  if (!topResult.ok) {
    throw new NothingChanged("This folder isn't inside a git repository. Run it from the app's folder.");
  }

  const top = String(topResult.stdout).trim();

  if (!git(["rev-parse", "--verify", "--quiet", `${request.base}^{commit}`], top).ok) {
    throw new NothingChanged(`${request.base} isn't a commit in this repository. Use the Commit: sha in plan.md.`);
  }

  const files = resolveFiles(top, cwd, request.files);

  if (request.patch) {
    const touched = String(git(["apply", "--numstat", resolve(request.patch)], top).stdout)
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t").at(-1));
    const listed = new Set(files.map(({ gitPath }) => gitPath));
    const unlisted = touched.filter((path) => path && !listed.has(path));

    if (unlisted.length > 0) {
      throw new NothingChanged(`The patch changes files not listed after --: ${unlisted.join(", ")}.`);
    }

    const check = git(["apply", "-R", "--check", resolve(request.patch)], top);

    if (!check.ok) {
      throw new NothingChanged(`The cut-down patch doesn't come out of the current files: ${check.stderr.trim()}`);
    }
  }

  return { top, files };
};

/**
 * Takes the fix out, runs the test, and puts the fix back.
 * @param {string} cwd the folder the script was run from: the app's folder
 * @param {Request} request what to take out and how to test
 * @param {(command: string, cwd: string) => number} runTest runs the test command and gives its exit code
 * @returns {Outcome} the result
 */
export const takeOutTheFix = (cwd, request, runTest) => {
  /** @type {{ top: string, files: { gitPath: string, fullPath: string }[] }} */
  let prepared;

  try {
    prepared = prepare(cwd, request);
  } catch (error) {
    if (error instanceof NothingChanged) {
      return { exitCode: EXIT.NOTHING_CHANGED, message: `Nothing was changed. ${error.message}` };
    }

    throw error;
  }

  const { top, files } = prepared;
  const scratch = join(resolve(cwd, request.taskFolder), ...SCRATCH);
  const copies = join(scratch, "copies");
  const patchFile = join(scratch, "fix.patch");

  // Copies left by an earlier run that went wrong may be the only good copy of the fix. Never overwrite them.
  if (existsSync(copies)) {
    return {
      exitCode: EXIT.NOTHING_CHANGED,
      message: `Nothing was changed. An earlier run left copies of the fix's files in ${copies}. Stop and tell the `
        + "user. Delete that folder only once the user has checked the files.",
    };
  }

  mkdirSync(copies, { recursive: true });

  if (!request.patch) {
    writeFileSync(patchFile, diffSinceBase(top, request.base, files.map(({ gitPath }) => gitPath)));
  }

  const saved = files.map(({ gitPath, fullPath }) => {
    if (!existsSync(fullPath)) {
      return { fullPath, copy: null };
    }

    const copy = join(copies, ...gitPath.split("/"));

    mkdirSync(dirname(copy), { recursive: true });
    copyFileSync(fullPath, copy);

    return { fullPath, copy };
  });

  // Read after the copies exist, so a task folder inside the repository looks the same before and after.
  const statusBefore = String(git(["status", "--porcelain"], top).stdout);

  /** @type {number | null} */
  let testExitCode = null;

  /** @type {unknown} */
  let runError = null;

  try {
    takeOut(top, request, files);
    testExitCode = runTest(request.test, cwd);
  } catch (error) {
    runError = error;
  }

  const differ = putBack(saved);
  const statusAfter = String(git(["status", "--porcelain"], top).stdout);

  if (differ.length > 0) {
    return {
      exitCode: EXIT.RESTORE_FAILED,
      message: `Putting the fix back went wrong: these files differ from their copies: ${differ.join(", ")}. Stop and `
        + `tell the user. The copies of the files, as they were before, are in ${copies}.`,
    };
  }

  if (statusAfter !== statusBefore) {
    const before = new Set(statusBefore.split("\n"));
    const after = new Set(statusAfter.split("\n"));
    const changes = [
      ...[...after].filter((line) => line && !before.has(line)).map((line) => `now: ${line}`),
      ...[...before].filter((line) => line && !after.has(line)).map((line) => `before: ${line}`),
    ];

    return {
      exitCode: EXIT.RESTORE_FAILED,
      message: `The fix is back, but git status changed during the run, so something else was written: `
        + `${changes.join("; ")}. Stop and tell the user. The copies of the fix's files are in ${copies}.`,
    };
  }

  rmSync(copies, { recursive: true, force: true });

  if (runError !== null) {
    const reason = runError instanceof Error ? runError.message : String(runError);

    return { exitCode: EXIT.NOTHING_CHANGED, message: `The fix is back as it was. The run stopped early: ${reason}.` };
  }

  const patchNote = request.patch ? "" : ` The fix as a patch is in ${patchFile}.`;

  if (testExitCode === 0) {
    return {
      exitCode: EXIT.GREEN,
      message: `The test PASSED without the fix, so it doesn't catch the bug. The fix is back.${patchNote}`,
    };
  }

  return {
    exitCode: EXIT.RED,
    message: `The test FAILED without the fix (exit code ${testExitCode}). Read the failure above: it must match the `
      + `reported symptom, not a compile error or "0 tests ran". The fix is back.${patchNote}`,
  };
};

/**
 * Runs the test command through the system's shell, with its output shown as it comes. Ctrl+C stops the test and
 * still lets the fix be put back.
 * @param {string} command the test command
 * @param {string} cwd the folder to run it in
 * @returns {number} the command's exit code, or 1 when it was stopped
 */
const runTestInShell = (command, cwd) => {
  const ignoreInterrupt = () => {};

  process.on("SIGINT", ignoreInterrupt);

  try {
    return spawnSync(command, { cwd, shell: true, stdio: "inherit" }).status ?? 1;
  } finally {
    process.off("SIGINT", ignoreInterrupt);
  }
};

/**
 * Reads the command line.
 * @param {string[]} args the arguments after the script's path
 * @returns {Request | string} the request, or what's wrong with the command line
 */
const parseRequest = (args) => {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        base: { type: "string" },
        "task-folder": { type: "string" },
        test: { type: "string" },
        patch: { type: "string" },
      },
    });
    const { base, test, patch } = values;
    const taskFolder = values["task-folder"];

    if (!base || !taskFolder || !test || positionals.length === 0) {
      return "Give --base, --task-folder, --test, and the fix's files after --.";
    }

    return { base, taskFolder, test, patch, files: positionals };
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const request = parseRequest(process.argv.slice(2));

  if (typeof request === "string") {
    console.error(`${request}\nUsage: node ${fileURLToPath(import.meta.url)} --base <sha> --task-folder <folder> `
      + "--test \"<command>\" [--patch <file>] -- <file>...");
    process.exit(EXIT.NOTHING_CHANGED);
  }

  // Any crash exits 3, never 1: 1 means the test passed without the fix, and a crash proves nothing either way.
  try {
    const { exitCode, message } = takeOutTheFix(process.cwd(), request, runTestInShell);

    console.log(`\n${message}`);
    process.exit(exitCode);
  } catch (error) {
    console.error(`\nThe script failed: ${error instanceof Error ? error.message : String(error)}. Stop and tell the `
      + "user. Check the fix's files with git status.");
    process.exit(EXIT.RESTORE_FAILED);
  }
}
