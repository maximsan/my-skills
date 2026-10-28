// @ts-check
// The structure rules from docs/cli/developer-guide.md, checked on every test run so they can't quietly erode.
//
// Each side effect has exactly one home. That's what lets a reader know where to look for anything that touches
// their machine, and what lets tests swap one module for a fake.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REAL_REPO_ROOT } from "./helpers.mjs";

const CLI = join(REAL_REPO_ROOT, "cli");

/**
 * Every source file of the CLI, tests excluded, as paths relative to cli/.
 * @returns {{ path: string, text: string }[]} each file's path and text
 */
const sourceFiles = () =>
  [
    "main.mjs",
    "run.mjs",
    ...["lib", "commands"].flatMap((folder) => readdirSync(join(CLI, folder)).map((name) => `${folder}/${name}`)),
  ]
    .filter((path) => path.endsWith(".mjs"))
    .map((path) => ({ path, text: readFileSync(join(CLI, path), "utf8") }));

/** @type {{ rule: string, pattern: RegExp, onlyIn: string[] }[]} */
const SINGLE_HOMES = [
  { rule: "console.* only in lib/ui.mjs", pattern: /console\./, onlyIn: ["lib/ui.mjs"] },

  // main.mjs writes its one "Node is too old" message itself, because ui.mjs may not load on that Node.
  {
    rule: "writing to the terminal only in lib/ui.mjs, and main.mjs's Node version message",
    pattern: /(stdout|stderr|output)\.write\(/,
    onlyIn: ["lib/ui.mjs", "main.mjs"],
  },
  { rule: "readline only in lib/ask.mjs", pattern: /node:readline/, onlyIn: ["lib/ask.mjs"] },
  { rule: "child processes only in lib/exec.mjs", pattern: /node:child_process/, onlyIn: ["lib/exec.mjs"] },
  {
    rule: "file writes only in lib/files.mjs",
    pattern:
      /\b(writeFileSync|appendFileSync|renameSync|mkdirSync|symlinkSync|rmdirSync|unlinkSync|copyFileSync|rmSync)\b/,
    onlyIn: ["lib/files.mjs"],
  },
  {
    rule: "process exit and signals only in the entry files, main.mjs and run.mjs",
    pattern: /process\.(exit|on|off)\b/,
    onlyIn: ["main.mjs", "run.mjs"],
  },
];

for (const { rule, pattern, onlyIn } of SINGLE_HOMES) {
  test(rule, () => {
    const offenders = sourceFiles()
      .filter(({ path, text }) => !onlyIn.includes(path) && pattern.test(text))
      .map(({ path }) => path);

    assert.deepEqual(offenders, []);
  });
}

test("dependencies point one way: lib never imports commands, commands never import the entry files", () => {
  for (const { path, text } of sourceFiles()) {
    if (path.startsWith("lib/")) {
      assert.doesNotMatch(text, /from "\.\.\/commands\//, path);
    }

    if (path.startsWith("commands/")) {
      assert.doesNotMatch(text, /from "\.\.\/(main|run)\.mjs"/, path);
    }
  }
});

test("main.mjs loads nothing but constants.mjs before its Node check, and constants.mjs imports nothing", () => {
  const files = sourceFiles();
  const staticImports = (/** @type {string} */ path) =>
    [...(files.find((file) => file.path === path)?.text ?? "").matchAll(/^import .* from "(.+)";$/gm)].map(
      (match) => match[1],
    );

  assert.deepEqual(staticImports("main.mjs"), ["./lib/constants.mjs"]);
  assert.deepEqual(staticImports("lib/constants.mjs"), []);
});

test("every file is type-checked and starts by saying why it exists", () => {
  for (const { path, text } of sourceFiles()) {
    // A Windows checkout ends lines with \r\n.
    const lines = text.split(/\r?\n/).filter((line) => !line.startsWith("#!"));

    assert.equal(lines[0], "// @ts-check", `${path} must start with // @ts-check`);
    assert.match(lines[1], /^\/\/ \S/, `${path} needs a header comment saying what it's for`);
  }
});

/**
 * The description at the top of the doc comment that ends on `endIndex`: its lines before the first `@` tag.
 * @param {string[]} lines the file's lines
 * @param {number} endIndex the line the comment ends on
 * @returns {string[]} the description's lines, trimmed; empty when the comment has only tags
 */
const descriptionLines = (lines, endIndex) => {
  let start = endIndex;

  while (start > 0 && !lines[start].includes("/**")) {
    start -= 1;
  }

  const body = lines.slice(start, endIndex + 1).map((line) =>
    line
      .replace("/**", "")
      .replace("*/", "")
      .replace(/^\s*\*/, "")
      .trim(),
  );
  const firstTag = body.findIndex((line) => line.startsWith("@"));

  return body.slice(0, firstTag === -1 ? body.length : firstTag).filter(Boolean);
};

test("every export has a doc comment that says what it is in words, not only its types", () => {
  /** @type {string[]} */
  const undocumented = [];

  for (const { path, text } of sourceFiles()) {
    const lines = text.split("\n");

    lines.forEach((line, index) => {
      if (!/^export (const|class) /.test(line)) {
        return;
      }

      const hasComment = lines[index - 1]?.trimEnd().endsWith("*/");

      if (!hasComment || descriptionLines(lines, index - 1).length === 0) {
        undocumented.push(`${path}: ${line.slice(0, 60)}`);
      }
    });
  }

  assert.deepEqual(undocumented, []);
});
