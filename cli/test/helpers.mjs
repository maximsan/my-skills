// @ts-check
// Shared test setup: a throwaway projects folder, fake apps, and fakes for the terminal.
//
// Every test runs in its own temp folder with its own HOME and an empty global git config (GIT_CONFIG_GLOBAL), so
// no test can read or change your real setup, whatever it does.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import { createAsker } from "../lib/ask.mjs";
import { createFiles } from "../lib/files.mjs";
import { createGit } from "../lib/git.mjs";
import { resolveLayout } from "../lib/layout.mjs";
import { DEFAULT_SIZE, UNICODE_SYMBOLS as SYMBOLS, renderPlan, renderReport } from "../lib/ui.mjs";

/** The real repo, which the sandbox copies its rules, skills and templates from. */
export const REAL_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * A temp folder shaped like a real machine, made by `makeSandbox`.
 * @typedef {object} Sandbox
 * @property {string} root the temp folder that holds everything
 * @property {string} projectsDirectory the projects folder, which holds the repo copy and the apps
 * @property {string} repoRoot the copy of this repo
 * @property {string} home the fake home folder
 * @property {string} globalGitConfig the empty global git config file
 * @property {NodeJS.ProcessEnv} env the environment for git and the CLI, pointing at the fake home and config
 * @property {import("../lib/layout.mjs").Layout} layout every path the CLI uses, worked out from the repo copy
 * @property {() => void} cleanUp deletes the temp folder
 */

/**
 * A temp folder shaped like a real machine: projects/ with a copy of this repo in it, and a fake home.
 * @param {{ withCli?: boolean, folderName?: string }} [options]
 *   withCli: copy the CLI too, for tests that spawn it; folderName: the temp folder's prefix, e.g. with a space
 * @returns {Sandbox} the paths in the temp folder, and a way to delete it
 */
export const makeSandbox = ({ withCli = false, folderName = "claude-rules-test-" } = {}) => {
  // Windows can give the temp folder in its short form (RUNNER~1), while git reports the long one. Use the long one,
  // as a real projects folder has.
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), folderName)));
  const projectsDirectory = join(root, "projects");
  const repoRoot = join(projectsDirectory, "prompts");
  const parts = ["rules", "skills", "templates"];

  for (const part of [...parts, ...(withCli ? ["cli"] : [])]) {
    cpSync(join(REAL_REPO_ROOT, part), join(repoRoot, part), { recursive: true });
  }

  cpSync(join(REAL_REPO_ROOT, "package.json"), join(repoRoot, "package.json"));

  const home = join(root, "home");

  mkdirSync(home);

  const globalGitConfig = join(root, "gitconfig");

  writeFileSync(globalGitConfig, "");

  /** @type {NodeJS.ProcessEnv} */
  const env = {
    PATH: process.env.PATH,
    HOME: home,
    USERPROFILE: home,
    GIT_CONFIG_GLOBAL: globalGitConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };

  return {
    root,
    projectsDirectory,
    repoRoot,
    home,
    globalGitConfig,
    env,
    layout: resolveLayout(repoRoot),
    cleanUp: () => rmSync(root, { recursive: true, force: true }),
  };
};

/**
 * Runs git and returns what it printed.
 * @param {string[]} args the git arguments, e.g. ["status"]
 * @param {string} cwd the folder to run it in
 * @param {NodeJS.ProcessEnv} env the environment, usually the sandbox's
 * @returns {string} git's output
 */
export const runGit = (args, cwd, env) => execFileSync("git", args, { cwd, env, encoding: "utf8" });

/**
 * Creates an app folder next to the repo.
 * @param {Sandbox} sandbox the sandbox to create it in
 * @param {string} name the app's folder name
 * @param {{ packageJson?: object, files?: Record<string, string>, isRepository?: boolean, commit?: string[] }}
 *   [options]
 *   commit: files to commit after writing them, so they're tracked
 * @returns {string} the app's folder
 */
export const makeApp = (sandbox, name, { packageJson, files = {}, isRepository = true, commit = [] } = {}) => {
  const directory = join(sandbox.projectsDirectory, name);

  mkdirSync(directory, { recursive: true });

  if (isRepository) {
    runGit(["init", "-q"], directory, sandbox.env);
  }

  if (packageJson) {
    writeFileSync(join(directory, "package.json"), JSON.stringify(packageJson, null, 2));
  }

  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), text);
  }

  if (commit.length > 0) {
    runGit(["add", ...commit], directory, sandbox.env);
    runGit(["commit", "-q", "-m", "fixture"], directory, sandbox.env);
  }

  return directory;
};

/**
 * The recording terminal: a stand-in with every method of `Ui`, plus the lines it recorded.
 * @typedef {import("../lib/ui.mjs").Ui & { lines: string[], text: () => string }} RecordingUi
 */

/**
 * A stand-in for the terminal that records every line, laid out the way the real one prints them.
 * @returns {RecordingUi} the stand-in, with `lines` and `text()` to read what it printed
 */
export const makeRecordingUi = () => {
  /** @type {string[]} */
  const lines = [];

  /**
   * Adds lines to the record.
   * @param {string[]} added the lines to add
   */
  const record = (...added) => {
    lines.push(...added);
  };

  const line = (/** @type {string} */ text = "") => record(text);

  return {
    symbols: SYMBOLS,
    lines,
    text: () => lines.join("\n"),
    line,
    heading: (/** @type {string} */ text) => record("", text),
    finding: (/** @type {import("../lib/ui.mjs").Tone} */ tone, /** @type {string} */ text) =>
      record(`  ${SYMBOLS[tone]} ${text}`),
    report: (/** @type {import("../lib/ui.mjs").ReportRow[]} */ rows) => record(...renderReport(rows, SYMBOLS)),
    plan: (/** @type {import("../lib/ui.mjs").PlanRow[]} */ rows) => record(...renderPlan(rows)),
    progress: () => ({
      finish: (/** @type {import("../lib/ui.mjs").ReportRow} */ row) => record(...renderReport([row], SYMBOLS)),
    }),
    next: (/** @type {string} */ text) => record(`Next: ${text}`),
    warn: line,
    error: line,
    debug: () => {},
    dispose: () => {},
    paint: (_style, text) => text,
    size: () => ({ ...DEFAULT_SIZE }),
    liveBlock: () => ({ draw: (/** @type {string[]} */ drawn) => record(...drawn) }),
  };
};

/**
 * One scripted answer: a piece of the question it answers, and the answer. `{ "Go ahead": true }`. A pick list is
 * answered with a piece of the picked item's label, `{ "Which app?": "web-shop" }`. A list that picks several takes a
 * piece of each label, `{ "Stack rules": ["React"] }`, or true to keep the items marked from the start.
 * @typedef {Record<string, boolean | string | string[]>} ScriptedAnswer
 */

/**
 * The scripted asker: a stand-in with every method of `Asker`, plus what it was asked and what it has left.
 * @typedef {import("../lib/ask.mjs").Asker & { questions: string[], remaining: ScriptedAnswer[] }} ScriptedAsker
 */

/** Every scripted asker made in the current test, checked for unused answers once it ends. */
const scriptedAskers = new Set();

// An answer left over means a question the test expected was never asked, so the test is out of date.
afterEach(() => {
  const leftover = [...scriptedAskers].flatMap((asker) => asker.remaining);

  scriptedAskers.clear();

  if (leftover.length > 0) {
    throw new Error(`The test scripted answers that were never asked for: ${JSON.stringify(leftover)}`);
  }
});

/**
 * Answers questions from a script, in order. Each entry names part of the question it expects, so a test fails
 * loudly if the questions change order, if one it didn't expect comes up, if it asks more than the script covers, or
 * if a scripted answer is never asked for.
 * @param {ScriptedAnswer[]} answers the answers to give, in order
 * @returns {ScriptedAsker} the asker, with the questions it was asked and the answers left over
 */
export const makeScriptedAsker = (answers) => {
  /**
   * Finds the item a scripted answer names.
   * @param {import("../lib/picker.mjs").PickItem[]} items the list's items
   * @param {string} label a piece of the item's label
   * @returns {number} the item's place in the list
   */
  const findLabel = (items, label) => {
    const index = items.findIndex((item) => item.label.includes(label));

    if (index === -1) {
      throw new Error(`The test picked "${label}", but the list has: ${items.map((item) => item.label).join(", ")}`);
    }

    return index;
  };

  const remaining = [...answers];

  /** @type {string[]} */
  const questions = [];

  const next = (/** @type {string} */ question) => {
    questions.push(question);

    const entry = remaining.shift();

    if (!entry) {
      throw new Error(`The test didn't script an answer for: ${question}`);
    }

    const [[expected, answer]] = Object.entries(entry);

    if (!question.includes(expected)) {
      throw new Error(`The test expected a question about "${expected}", but was asked: ${question}`);
    }

    return answer;
  };

  /** @type {ScriptedAsker} */
  const asker = {
    questions,
    remaining,
    confirm: async (/** @type {string} */ question) => Boolean(next(question)),
    pickOne: async (title, items) => findLabel(items, String(next(title))),
    pickMany: async (title, items, marked) => {
      const answer = next(title);

      return answer === true ? [...marked] : [answer].flat().map((label) => findLabel(items, String(label)));
    },
    text: async (/** @type {string} */ question) => String(next(question)),
    close: () => {},
  };

  scriptedAskers.add(asker);

  return asker;
};

/**
 * A full command context over the sandbox, with the real files and git, and fakes for the terminal. With
 * `options.yes`, the asker is the real one in --yes mode, with no terminal, so the test sees what --yes really picks.
 * `scriptedAsk` is the scripted asker, for checking which questions came up. With `options.yes` it isn't used, so it
 * records nothing.
 * @param {Sandbox} sandbox the sandbox to run in
 * @param {{ answers?: ScriptedAnswer[], options?: Partial<{ yes: boolean, dryRun: boolean }>, args?: string[],
 *           cwd?: string, platform?: NodeJS.Platform }} [overrides] the answers, flags, arguments, folder and
 *   operating system to use instead of the defaults
 * @returns {{ context: import("../lib/contract.mjs").Context, ui: RecordingUi, scriptedAsk: ScriptedAsker,
 *   controller: AbortController }} the context, its recording terminal, the scripted asker, and the run's abort
 *   controller
 */
export const makeContext = (
  sandbox,
  { answers = [], options = {}, args = [], cwd = sandbox.projectsDirectory, platform = process.platform } = {},
) => {
  const controller = new AbortController();
  const ui = makeRecordingUi();
  const scripted = makeScriptedAsker(answers);
  const ask = options.yes
    ? createAsker({
        input: new PassThrough(),
        output: new PassThrough(),
        signal: controller.signal,
        isInteractive: false,
        assumeDefaults: true,
        onInterrupt: () => controller.abort(),
        ui,
      })
    : scripted;

  /** @type {import("../lib/contract.mjs").Context} */
  const context = {
    layout: sandbox.layout,
    files: createFiles({ platform }),
    git: createGit({ env: sandbox.env, signal: controller.signal }),
    ask,
    ui,
    signal: controller.signal,
    options: { yes: false, dryRun: false, debug: false, ...options },
    args,
    cwd,
    env: sandbox.env,
    platform,
    nodeVersion: process.version,
    homeDirectory: sandbox.home,
    isInteractive: true,
  };

  return { context, ui, scriptedAsk: scripted, controller };
};

/**
 * Every file under a folder with its content, for proving a run wrote nothing.
 * @param {string} directory the folder to read
 * @returns {Record<string, string>} each path, relative to the folder, with its text, "(folder)" or "(link)"
 */
export const snapshotFolder = (directory) => {
  /** @type {Record<string, string>} */
  const snapshot = {};

  const walk = (/** @type {string} */ current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      const stats = lstatSync(path);
      const key = relative(directory, path);

      if (stats.isSymbolicLink()) {
        snapshot[key] = "(link)";
      } else if (stats.isDirectory()) {
        snapshot[key] = "(folder)";
        walk(path);
      } else {
        snapshot[key] = readFileSync(path, "utf8");
      }
    }
  };

  walk(directory);

  return snapshot;
};
