#!/usr/bin/env node
/**
 * Fails when a code generator rewrites, adds or deletes a generated file,
 * because then the committed one is stale. Run it in a repo's check command
 * after dependencies are installed and before format and lint, so those
 * read what the generators wrote.
 *
 * Usage: node check-generated.mjs --generator "<command>" [--generator ...]
 *          --pattern "<git pathspec>" [--pattern ...]
 * Example: --generator "npm run codegen" --pattern "src/generated/*"
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { exitCodeOf, outputOf, runsAsScript } from "./shared.mjs";

/**
 * Every generated file in the checkout at `cwd` matching `patterns`,
 * committed or not, with a digest of its bytes.
 * @param {string[]} patterns git pathspecs, such as `*.g.dart`
 * @param {{ cwd?: string }} [options] `cwd`: the checkout's folder; the current folder by default
 * @returns {Map<string, string>} path to digest
 */
export function generatedSources(patterns, { cwd = process.cwd() } = {}) {
  const listed = outputOf(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...patterns],
    { cwd },
  );
  const sources = new Map();

  for (const path of listed.split("\0").filter((path) => path !== "")) {
    const bytes = readFileSync(join(cwd, path));

    sources.set(path, createHash("sha256").update(bytes).digest("hex"));
  }

  return sources;
}

/**
 * The paths whose digest differs between `before` and `after`, a file only
 * one of them holds included.
 * @param {Map<string, string | undefined>} before path to digest, read before the generators ran
 * @param {Map<string, string | undefined>} after path to digest, read after the generators ran
 * @returns {string[]} the stale paths, sorted
 */
export function staleFiles(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);

  return [...paths].filter((path) => before.get(path) !== after.get(path)).sort();
}

/**
 * What the generators did to `path`: added, deleted or rewrote it.
 * @param {string} path a stale path, from `staleFiles`
 * @param {Map<string, string | undefined>} before path to digest, read before the generators ran
 * @param {Map<string, string | undefined>} after path to digest, read after the generators ran
 * @returns {"added" | "deleted" | "rewrote"} the verb for the report
 */
export function changeTo(path, before, after) {
  if (!before.has(path)) {
    return "added";
  }

  if (!after.has(path)) {
    return "deleted";
  }

  return "rewrote";
}

/**
 * Runs `command` through the shell, quietly; its output shows only if it
 * fails, and then the script stops.
 * @param {string} command a shell command that runs a generator, such as `npm run codegen`
 */
function runGenerator(command) {
  const finished = spawnSync(command, { shell: true, encoding: "utf8" });

  if (finished.status !== 0) {
    throw new Error(`✗ ${command} failed\n${finished.stdout}${finished.stderr}`);
  }
}

/**
 * Runs the generators and reports each generated file they changed.
 * @param {string[]} argv the command-line arguments after the script's path: `--generator` and `--pattern` pairs
 * @returns {number} the exit code: 1 when a generated file was stale, else 0
 */
export function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      generator: { type: "string", multiple: true, default: [] },
      pattern: { type: "string", multiple: true, default: [] },
    },
  });

  if (values.generator.length === 0 || values.pattern.length === 0) {
    throw new Error(
      "Usage: node check-generated.mjs --generator \"<command>\" --pattern \"<git pathspec>\"",
    );
  }

  const before = generatedSources(values.pattern);

  for (const generator of values.generator) {
    runGenerator(generator);
  }

  const after = generatedSources(values.pattern);
  const stale = staleFiles(before, after);

  if (stale.length === 0) {
    console.log("✓ every generated file is what the generators write");

    return 0;
  }

  for (const path of stale) {
    console.log(`✗ ${path} was stale: the generator ${changeTo(path, before, after)} it. Commit that.`);
  }

  return 1;
}

const [, , ...scriptArgs] = process.argv;

if (runsAsScript(import.meta.url)) {
  process.exitCode = exitCodeOf(() => main(scriptArgs));
}
