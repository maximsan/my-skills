#!/usr/bin/env node
/**
 * Packs this repo into a zip, for a computer that can't clone it, such as a managed Windows environment.
 *
 *   node scripts/zip.mjs           zip the current commit
 *   node scripts/zip.mjs <branch>  zip another branch or commit
 *
 * The zip is named after the commit, e.g. prompts-e4925ae.zip, so two builds can't be mixed up. Inside, everything
 * sits in one prompts/ folder, plus prompts/BUILT-FROM.txt naming the commit, to check on the other side. Only
 * committed files go in: uncommitted changes are left out, with a warning.
 */

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FOLDER = join(homedir(), "Downloads");
const BYTES_PER_KB = 1024;

/** Runs git in this repo and returns what it printed. */
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

const ref = process.argv[2] ?? "HEAD";
const hash = git("rev-parse", "--short", `${ref}^{commit}`);
const subject = git("log", "-1", "--format=%s", hash);
const zipPath = join(OUT_FOLDER, `prompts-${hash}.zip`);

git("archive", "--format=zip", "--prefix=prompts/", `--add-virtual-file=prompts/BUILT-FROM.txt:${hash} ${subject}\n`,
  "-o", zipPath, hash);

if (ref === "HEAD" && git("status", "--porcelain") !== "") {
  console.warn("! Uncommitted changes are not in the zip: only the commit is.");
}

console.log(`${zipPath} (${Math.round(statSync(zipPath).size / BYTES_PER_KB)} KB)`);
console.log(`Built from ${hash}: ${subject}`);
console.log("After unpacking it into the projects folder, check the version: cat prompts/BUILT-FROM.txt");
