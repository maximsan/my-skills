// @ts-check
// task-review's take-out-the-fix script, run as Claude runs it: `node <script> …` from the app's folder.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { EXIT } from "../../skills/task-review/scripts/take-out-the-fix.mjs";
import { makeApp, makeSandbox, REAL_REPO_ROOT, runGit, snapshotFolder } from "./helpers.mjs";

const SCRIPT = join(REAL_REPO_ROOT, "skills", "task-review", "scripts", "take-out-the-fix.mjs");

// A tiny app with a bug: add() subtracts. The test exits 1 while the bug is there.
const BUGGY = "export const add = (a, b) => a - b;\r\n";
const FIXED = "export const add = (a, b) => a + b;\r\n";
const CHECK = "import { add } from \"./math.mjs\";\nprocess.exit(add(2, 2) === 4 ? 0 : 1);\n";
const TEST_COMMAND = "node check.mjs";
const MEGABYTE = 1024 * 1024;

/** Where a diff's second hunk starts: the one for the change below the filler lines. */
const SECOND_HUNK = /\n(?=@@ -\d+,\d+ \+\d+,\d+ @@ \/\/ line)/;

/** @type {import("./helpers.mjs").Sandbox} */
let sandbox;

/** @type {string} */
let app;

/** @type {string} */
let base;

/** @type {string} */
let taskFolder;

beforeEach(() => {
  sandbox = makeSandbox();
  app = makeApp(sandbox, "web-shop", { files: { "math.mjs": BUGGY }, commit: ["math.mjs"] });
  base = runGit(["rev-parse", "HEAD"], app, sandbox.env).trim();
  taskFolder = join(sandbox.projectsDirectory, "investigations", "web-shop", "ORD-1");
  writeFileSync(join(app, "check.mjs"), CHECK);
});
afterEach(() => sandbox.cleanUp());

/**
 * Runs the script from the app's folder.
 * @param {string[]} files the fix's files
 * @param {{ testCommand?: string, extra?: string[], baseCommit?: string }} [options] what to change from the defaults
 * @returns {{ status: number | null, output: string }} the exit code and everything printed
 */
const run = (files, { testCommand = TEST_COMMAND, extra = [], baseCommit = base } = {}) => {
  const args = ["--base", baseCommit, "--task-folder", taskFolder, "--test", testCommand, ...extra, "--", ...files];
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: app, env: sandbox.env, encoding: "utf8" });

  return { status: result.status, output: `${result.stdout}${result.stderr}` };
};

test("an uncommitted fix: the test fails without it, and the fix is back byte for byte", () => {
  writeFileSync(join(app, "math.mjs"), FIXED);

  const statusBefore = runGit(["status", "--porcelain"], app, sandbox.env);
  const { status, output } = run(["math.mjs"]);

  assert.equal(status, EXIT.RED, output);
  assert.match(output, /The test FAILED without the fix \(exit code 1\)/);
  assert.equal(readFileSync(join(app, "math.mjs"), "utf8"), FIXED, "Windows line endings and all");
  assert.equal(runGit(["status", "--porcelain"], app, sandbox.env), statusBefore);
  assert.match(readFileSync(join(taskFolder, "scratch", "take-out-the-fix", "fix.patch"), "utf8"), /a \+ b/);
  assert.equal(existsSync(join(taskFolder, "scratch", "take-out-the-fix", "copies")), false, "copies go on success");
});

test("a committed fix is taken out the same way", () => {
  writeFileSync(join(app, "math.mjs"), FIXED);
  runGit(["commit", "-q", "-am", "fix"], app, sandbox.env);

  const { status, output } = run(["math.mjs"]);

  assert.equal(status, EXIT.RED, output);
  assert.equal(runGit(["status", "--porcelain"], app, sandbox.env), "?? check.mjs\n");
});

test("a test that passes without the fix is reported as not catching the bug", () => {
  writeFileSync(join(app, "math.mjs"), FIXED);

  const { status, output } = run(["math.mjs"], { testCommand: "node -e \"process.exit(0)\"" });

  assert.equal(status, EXIT.GREEN, output);
  assert.match(output, /The test PASSED without the fix, so it doesn't catch the bug/);
  assert.equal(readFileSync(join(app, "math.mjs"), "utf8"), FIXED);
});

test("a new file in the fix is gone during the test and back afterwards, still untracked", () => {
  writeFileSync(join(app, "math.mjs"), "export { add } from \"./add.mjs\";\r\n");
  writeFileSync(join(app, "add.mjs"), "export const add = (a, b) => a + b;\n");

  const statusBefore = runGit(["status", "--porcelain"], app, sandbox.env);
  const { status, output } = run(["math.mjs", "add.mjs"]);

  assert.equal(status, EXIT.RED, output);
  assert.equal(runGit(["status", "--porcelain"], app, sandbox.env), statusBefore);
  assert.match(readFileSync(join(taskFolder, "scratch", "take-out-the-fix", "fix.patch"), "utf8"), /add\.mjs/);
});

test("a cut-down patch takes out only its own lines", () => {
  // The file also holds an unrelated change further down. Cutting the patch down drops that change's hunk, so the
  // unrelated line stays in while the test runs, and check.mjs fails only if it's there and the bug is back.
  const filler = Array.from({ length: 10 }, (_unused, index) => `// line ${index}\r\n`).join("");
  const fixedWithUnrelated = `${FIXED}${filler}export const unrelated = 1;\r\n`;

  writeFileSync(join(app, "math.mjs"), `${BUGGY}${filler}`);
  runGit(["commit", "-q", "-am", "filler"], app, sandbox.env);

  const fillerBase = runGit(["rev-parse", "HEAD"], app, sandbox.env).trim();

  writeFileSync(join(app, "math.mjs"), fixedWithUnrelated);
  writeFileSync(join(app, "check.mjs"), [
    "import { add, unrelated } from \"./math.mjs\";",
    "process.exit(unrelated === 1 && add(2, 2) !== 4 ? 1 : 0);",
    "",
  ].join("\n"));

  const diff = runGit(["diff", fillerBase, "--", "math.mjs"], app, sandbox.env);
  const [firstHunk] = diff.split(SECOND_HUNK);
  const patch = join(sandbox.root, "cut.patch");

  writeFileSync(patch, `${firstHunk}\n`);

  const { status, output } = run(["math.mjs"], { baseCommit: fillerBase, extra: ["--patch", patch] });

  assert.equal(status, EXIT.RED, output);
  assert.equal(readFileSync(join(app, "math.mjs"), "utf8"), fixedWithUnrelated);
});

test("a patch that changes a file not listed is refused before anything changes", () => {
  writeFileSync(join(app, "math.mjs"), FIXED);

  const patch = join(sandbox.root, "fix.patch");

  writeFileSync(patch, runGit(["diff", base, "--", "math.mjs"], app, sandbox.env));

  const before = snapshotFolder(app);
  const { status, output } = run(["other.mjs"], { extra: ["--patch", patch] });

  assert.equal(status, EXIT.NOTHING_CHANGED, output);
  assert.match(output, /The patch changes files not listed after --: math\.mjs/);
  assert.deepEqual(snapshotFolder(app), before);
});

test("a wrong base commit, or a file outside the repository, changes nothing", () => {
  writeFileSync(join(app, "math.mjs"), FIXED);

  const before = snapshotFolder(app);

  for (const [files, baseCommit, message] of [
    [["math.mjs"], "0000000", /0000000 isn't a commit in this repository/],
    [["../outside.mjs"], base, /\.\.\/outside\.mjs is outside this repository/],
  ]) {
    const { status, output } = run(/** @type {string[]} */ (files), { baseCommit: String(baseCommit) });

    assert.equal(status, EXIT.NOTHING_CHANGED, output);
    assert.match(output, /** @type {RegExp} */ (message));
  }

  assert.deepEqual(snapshotFolder(app), before);
});

test("when the run leaves other changes, it says stop, names them, and keeps the copies", () => {
  writeFileSync(join(app, "math.mjs"), FIXED);

  // The test command leaves a new file behind, so git status differs afterwards.
  const testCommand = "node -e \"require('fs').writeFileSync('left.txt', '')\"";
  const { status, output } = run(["math.mjs"], { testCommand });

  assert.equal(status, EXIT.RESTORE_FAILED, output);
  assert.match(output, /The fix is back, but git status changed during the run, .*now: \?\? left\.txt\. Stop and tell/);
  assert.equal(readFileSync(join(app, "math.mjs"), "utf8"), FIXED);
  assert.ok(existsSync(join(taskFolder, "scratch", "take-out-the-fix", "copies", "math.mjs")), "the copies are kept");
});

test("a file of several MB is taken out and put back whole", () => {
  // Node keeps 1 MB of a command's output by default; past that, git's answer was lost.
  const padding = `// ${"x".repeat(3 * MEGABYTE)}\r\n`;

  writeFileSync(join(app, "math.mjs"), `${BUGGY}${padding}`);
  runGit(["commit", "-q", "-am", "big"], app, sandbox.env);

  const bigBase = runGit(["rev-parse", "HEAD"], app, sandbox.env).trim();

  writeFileSync(join(app, "math.mjs"), `${FIXED}${padding}`);

  // Red only when the file is there with the bug: a lost git answer used to delete it, which looked red too.
  writeFileSync(join(app, "check.mjs"), [
    "import { existsSync } from \"node:fs\";",
    "if (!existsSync(\"math.mjs\")) process.exit(0);",
    "const { add } = await import(\"./math.mjs\");",
    "process.exit(add(2, 2) === 4 ? 0 : 1);",
    "",
  ].join("\n"));

  const { status, output } = run(["math.mjs"], { baseCommit: bigBase });

  assert.equal(status, EXIT.RED, output);
  assert.equal(readFileSync(join(app, "math.mjs"), "utf8"), `${FIXED}${padding}`);
});

test("copies left by an earlier run are never overwritten", () => {
  const copies = join(taskFolder, "scratch", "take-out-the-fix", "copies");

  writeFileSync(join(app, "math.mjs"), FIXED);
  mkdirSync(copies, { recursive: true });
  writeFileSync(join(copies, "math.mjs"), "the only good copy\n");

  const { status, output } = run(["math.mjs"]);

  assert.equal(status, EXIT.NOTHING_CHANGED, output);
  assert.match(output, /An earlier run left copies of the fix's files in .*\. Stop and tell the user/);
  assert.equal(readFileSync(join(copies, "math.mjs"), "utf8"), "the only good copy\n");
});

test("a missing argument is named, with the usage line", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--base", base], { cwd: app, encoding: "utf8" });

  assert.equal(result.status, EXIT.NOTHING_CHANGED);
  assert.match(result.stderr, /Give --base, --task-folder, --test, and the fix's files after --\./);
});
